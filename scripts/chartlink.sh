#!/bin/sh
set -eu
caller_dir=$(pwd)
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
action=${1:-help}

if [ "$action" = help ]; then
    cat <<'HELP'
Uso: sh scripts/chartlink.sh COMANDO
  build               Compila as imagens; use em máquina com recursos disponíveis.
  save-images         Exporta imagens e checksum para uma nova pasta no local atual.
  load-images PASTA   Verifica checksum e carrega as imagens recebidas.
  check               Valida configuração e presença das imagens locais.
  import-db CAMINHO   Faz backup e importa o banco, sem sobrescrever destino.
  init-empty          Cria instalação SEM links antigos (somente instalação nova/CI).
  start               Inicia em segundo plano, SEM compilar ou baixar imagens.
  status              Mostra o estado dos serviços deste projeto.
  logs                Acompanha logs (Ctrl+C fecha somente a visualização).
  stop                Para somente opa-chartlink, mantendo os dados.
  backup              Cria snapshot consistente do banco.
  update              Com imagens já carregadas: para, faz backup e inicia a versão nova.
  create-admin        Cria um administrador; solicita login, nome e senha no terminal.
HELP
    exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
    echo 'Docker não encontrado. Consulte a equipe responsável pelo servidor.' >&2
    exit 1
fi
docker compose version >/dev/null
if [ ! -f .env ]; then
    echo 'Crie .env a partir de .env.example e confira os caminhos e o IP.' >&2
    exit 1
fi

# Escopo explícito: não depende do diretório do terminal nem de COMPOSE_FILE.
compose() {
    docker compose --project-name opa-chartlink --project-directory "$project_dir" \
        --env-file "$project_dir/.env" -f "$project_dir/compose.yaml" "$@"
}

require_images() {
    image_refs=$(compose config --images)
    for image_ref in $image_refs; do
        if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
            echo "Imagem ausente: $image_ref. Execute load-images ou build antes de continuar." >&2
            exit 1
        fi
    done
}

case "$action" in
    build)
        compose -f "$project_dir/compose.build.yaml" build --pull
        ;;
    save-images)
        require_images
        umask 077
        output_dir=$(mktemp -d "$caller_dir/chartlink-imagens-XXXXXX")
        # As referências retornadas pelo Compose não contêm espaços.
        set -- $image_refs
        docker image save --output "$output_dir/opa-chartlink-images.tar" "$@"
        (cd "$output_dir" && sha256sum opa-chartlink-images.tar > SHA256SUMS)
        printf 'Imagens exportadas: %s\n' "$output_dir"
        ;;
    load-images)
        if [ "$#" -ne 2 ]; then echo 'Informe a pasta com o TAR e SHA256SUMS.' >&2; exit 1; fi
        case "$2" in /*) input_dir=$2 ;; *) input_dir=$caller_dir/$2 ;; esac
        if [ ! -f "$input_dir/opa-chartlink-images.tar" ] || [ ! -f "$input_dir/SHA256SUMS" ]; then
            echo 'A pasta deve conter opa-chartlink-images.tar e SHA256SUMS.' >&2
            exit 1
        fi
        expected_checksum=$(cat "$input_dir/SHA256SUMS")
        actual_checksum=$(cd "$input_dir" && sha256sum opa-chartlink-images.tar)
        if [ "$expected_checksum" != "$actual_checksum" ]; then
            echo 'Checksum inválido. Nenhuma imagem foi carregada.' >&2
            exit 1
        fi
        docker image load --input "$input_dir/opa-chartlink-images.tar"
        require_images
        ;;
    check)
        compose config --quiet
        require_images
        echo 'Configuração válida e imagens presentes. Os containers não foram iniciados.'
        ;;
    import-db|init-empty)
        require_images
        if [ -n "$(compose ps --status running -q api)" ]; then
            echo 'Pare apenas o ChartLink antes de preparar o banco: sh scripts/chartlink.sh stop' >&2
            exit 1
        fi
        if [ "$action" = import-db ]; then
            if [ "$#" -ne 2 ]; then echo 'Informe o caminho do backup recebido entre aspas.' >&2; exit 1; fi
            case "$2" in /*) source_file=$2 ;; *) source_file=$caller_dir/$2 ;; esac
            if [ ! -r "$source_file" ] || [ ! -f "$source_file" ]; then
                echo "Banco não encontrado ou sem leitura: $source_file" >&2
                exit 1
            fi
            source_dir=$(CDPATH= cd -- "$(dirname -- "$source_file")" && pwd)
            source_name=$(basename -- "$source_file")
            compose run --rm --no-deps --pull never --user 0:0 --entrypoint python \
                -v "$source_dir:/source:ro" api /app/scripts/database.py import-db \
                --source "/source/$source_name" --owner 10001
        else
            compose run --rm --no-deps --pull never --user 0:0 --entrypoint python \
                api /app/scripts/database.py init-empty --owner 10001
        fi
        ;;
    start)
        require_images
        compose up -d --no-build --pull never --wait
        ;;
    status) compose ps -a ;;
    logs) compose logs -f --tail 100 ;;
    stop) compose stop ;;
    backup)
        require_images
        compose run --rm --no-deps --pull never --entrypoint python api /app/scripts/database.py backup
        ;;
    create-admin)
        if [ -z "$(compose ps --status running -q api)" ]; then
            echo 'Inicie o ChartLink antes: sh scripts/chartlink.sh start' >&2
            exit 1
        fi
        compose exec api flask --app server create-admin
        ;;
    update)
        require_images
        compose stop
        compose run --rm --no-deps --pull never --entrypoint python api /app/scripts/database.py backup
        compose up -d --no-build --pull never --wait
        ;;
    *) echo 'Comando inválido. Use: sh scripts/chartlink.sh help' >&2; exit 1 ;;
esac
