#!/bin/sh
set -eu
caller_dir=$(pwd)
project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_dir"
action=${1:-help}

if [ "$action" = help ]; then
    cat <<'HELP'
Uso: sh scripts/chartlink.sh COMANDO
  import-db CAMINHO  Faz backup e importa o banco atual, sem sobrescrever destino.
  init-empty        Cria explicitamente uma instalação SEM os links antigos.
  start             Compila e inicia em segundo plano; aguarda os healthchecks.
  status            Mostra o estado dos serviços.
  logs              Acompanha logs (Ctrl+C fecha somente a visualização).
  stop              Para os serviços, mantendo os dados.
  backup            Cria snapshot consistente do banco em execução.
  update            Compila, para, faz backup e inicia a versão atual do código.
HELP
    exit 0
fi

if ! command -v docker >/dev/null 2>&1; then
    echo 'Instale Docker Engine e o plugin Compose v2 neste servidor.' >&2
    exit 1
fi
docker compose version >/dev/null
if [ ! -f .env ]; then
    echo 'Crie .env a partir de .env.example e configure os caminhos e o IP.' >&2
    exit 1
fi

case "$action" in
    import-db|init-empty)
        if [ -n "$(docker compose ps --status running -q api)" ]; then
            echo 'Pare a API antes de preparar o banco: sh scripts/chartlink.sh stop' >&2
            exit 1
        fi
        if [ "$action" = import-db ]; then
            if [ "$#" -ne 2 ]; then echo 'Informe o caminho do banco atual entre aspas.' >&2; exit 1; fi
            case "$2" in /*) source_file=$2 ;; *) source_file=$caller_dir/$2 ;; esac
            if [ ! -r "$source_file" ] || [ ! -f "$source_file" ]; then
                echo "Banco não encontrado ou sem leitura: $source_file" >&2
                exit 1
            fi
            source_dir=$(CDPATH= cd -- "$(dirname -- "$source_file")" && pwd)
            source_name=$(basename -- "$source_file")
            docker compose build api
            docker compose run --rm --no-deps --user 0:0 --entrypoint python \
                -v "$source_dir:/source:ro" api /app/scripts/database.py import-db \
                --source "/source/$source_name" --owner 10001
        else
            docker compose build api
            docker compose run --rm --no-deps --user 0:0 --entrypoint python \
                api /app/scripts/database.py init-empty --owner 10001
        fi
        ;;
    start) docker compose up -d --build --wait ;;
    status) docker compose ps ;;
    logs) docker compose logs -f --tail 100 ;;
    stop) docker compose stop ;;
    backup)
        docker compose run --rm --no-deps --entrypoint python api /app/scripts/database.py backup
        ;;
    update)
        docker compose build --pull
        docker compose stop
        docker compose run --rm --no-deps --entrypoint python api /app/scripts/database.py backup
        docker compose up -d --wait
        ;;
    *) echo 'Comando inválido. Use: sh scripts/chartlink.sh help' >&2; exit 1 ;;
esac
