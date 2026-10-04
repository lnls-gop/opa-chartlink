# ChartLink na fac6 — primeira instalação

Este roteiro preserva o container kind_newton e separa os dados do código. Não execute todos os blocos sem conferir cada etapa. Os caminhos com CAMINHO_REAL precisam ser substituídos antes da execução.

## 1. O que já sabemos e o que falta

- Servidor: fac6, IP interno informado 10.20.31.21, Docker e Compose instalados.
- Banco original: linac-opi2, dentro de ChartLink_21/backend/chartlink.db.
- Backup validado na origem: /home/sirius/chartlink-backup-qrR1zk/chartlink.db, 904 links.
- Ainda precisamos confirmar o caminho da cópia recebida na fac6 e comparar os hashes SHA-256 das duas cópias.
- A fac6 tinha cerca de 1 GiB de memória disponível. O Firefox era o principal consumidor, não kind_newton.
- A arquitetura da CPU ainda não foi confirmada.

Na fac6, execute:

```bash
hostname
uname -m
free -h
df -h / /home
```

O artefato do GitHub Actions deste pacote exige resultado x86_64. Para outra arquitetura, pare e ajuste a compilação. Feche apenas abas/aplicativos dispensáveis; não encerre processos desconhecidos. Não compile na fac6 enquanto a disponibilidade de recursos não tiver sido avaliada.

O código e o banco ficarão em /home, mas imagens e camadas Docker continuarão em /var/lib/docker. Portanto, o espaço em /home não elimina a necessidade de espaço livre em /.

## 2. Prepare o código em uma pasta nova

Na fac6, extraia este ZIP em um local novo dentro de /home/sirius. Ele cria a pasta ChartLink_21_v1.0.8. Não extraia por cima de uma instalação em uso. Entre nessa pasta; os comandos seguintes devem ser executados nela.

```bash
pwd
ls compose.yaml scripts/chartlink.sh
cp -n .env.example .env
```

Abra .env em um editor e confira:

```dotenv
CHARTLINK_DATA_DIR=/home/sirius/opa-chartlink-data
CHARTLINK_BACKUP_DIR=/home/sirius/opa-chartlink-backups
CHARTLINK_IMAGE_TAG=1.0.8
CHARTLINK_SECRET_KEY=CHAVE_ALEATORIA_EXCLUSIVA
CHARTLINK_BIND_IP=127.0.0.1
CHARTLINK_PORT=8080
```

Gere a chave diretamente na fac6 e cole o resultado no `.env`:

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Essa chave mantém as sessões válidas entre reinicializações. Não a publique no GitHub e não use uma senha pessoal.

Os diretórios de dados e backups devem ser exclusivos do ChartLink e residir em disco local, não em NFS/SMB. Não indique /home/sirius, / ou a pasta de outro aplicativo como destino. Se já existir um banco nessa instalação, pare e siga o roteiro de atualização, não de primeira importação.

Não é necessário manter VS Code aberto. Pode usar outro editor. Não publique o .env real no GitHub.

## 3. Obtenha as imagens — escolha uma alternativa

### A. Compilação pelo GitHub Actions

Siga [GITHUB.md](GITHUB.md) para enviar o código para lnls-gop/opa-chartlink, respeitando as permissões da organização. Confirme com TI se runners hospedados são permitidos.

Na aba Actions, aguarde sucesso no workflow Verificar ChartLink da revisão aprovada. Baixe o artefato opa-chartlink-1.0.8-linux-amd64. A retenção solicitada é de três dias. Extraia o ZIP do artefato: uma mesma pasta deve conter opa-chartlink-images.tar e SHA256SUMS.

Isso não instala o ChartLink na fac6 e não envia seu banco ao GitHub. Se o workflow falhar, leia o erro; não pule os testes para gerar uma imagem não validada.

### B. Compilação em outra máquina Linux com Docker

Use uma máquina autorizada, com a mesma arquitetura da fac6 e recursos suficientes. Não presuma que a linac-opi2 já tem Docker. Nessa máquina, extraia o pacote e entre na pasta ChartLink_21_v1.0.8:

```bash
cp -n .env.example .env
sh scripts/chartlink.sh build
sh scripts/chartlink.sh save-images
```

build baixa dependências; save-images cria uma pasta nova chartlink-imagens-XXXXXX e informa seu caminho. Transfira essa pasta completa por um meio autorizado para a fac6. Não precisa iniciar o aplicativo ou copiar o banco na máquina de compilação.

### Carregar na fac6

Use apenas imagens da revisão aprovada e de origem confiável. Dentro da pasta do código na fac6, substitua o caminho entre aspas pelo diretório REAL contendo TAR e SHA256SUMS:

```bash
sh scripts/chartlink.sh load-images "/CAMINHO_REAL/pasta-das-imagens"
sh scripts/chartlink.sh check
```

O script confere o checksum antes de carregar. check não inicia containers. Se faltar imagem, ele para em vez de compilar ou baixar automaticamente. Se houver erro de permissão no Docker, consulte TI; não altere grupos ou permissões do socket por conta própria.

## 4. Confirme o backup transferido

Na linac-opi2:

```bash
sha256sum /home/sirius/chartlink-backup-qrR1zk/chartlink.db
```

Na fac6, use o caminho REAL que foi informado quando a transferência terminou:

```bash
sha256sum "/CAMINHO_REAL/chartlink-importacao-XXXXXX/chartlink.db"
```

Os hashes devem ser idênticos. O caminho do backup na linac-opi2 NÃO é automaticamente um caminho disponível na fac6. Se a transferência ainda não aconteceu, faça-a por canal autorizado antes de continuar. Não use o banco antigo de outro ZIP.

Combine a mudança com os usuários. Esse backup é um retrato do momento da cópia: edições posteriores na instalação antiga não serão levadas junto. Se houver novos dados, pause as edições e gere/transfira um novo snapshot consistente antes da importação final.

## 5. Importe os 904 links e inicie

Ainda na fac6, com imagens carregadas e hashes conferidos, substitua o caminho abaixo pelo backup REAL recebido:

```bash
sh scripts/chartlink.sh import-db "/CAMINHO_REAL/chartlink-importacao-XXXXXX/chartlink.db"
```

Espere uma resposta JSON com links: 904 para o backup informado. A rotina valida o banco, cria uma cópia adicional em backups e importa para o diretório de dados. Ela não sobrescreve um banco existente. /data e /backups na resposta são caminhos internos do container, mapeados pelos diretórios do .env.

Se a contagem divergir, interrompa e confira a origem. Não execute init-empty: esse comando serve apenas para instalações novas sem dados e para CI.

```bash
sh scripts/chartlink.sh start
sh scripts/chartlink.sh status
curl -f http://127.0.0.1:8080/api/health
```

Crie o primeiro administrador sem colocar a senha no histórico do terminal:

```bash
sh scripts/chartlink.sh create-admin
```

O comando solicitará login, nome e senha duas vezes. A senha deve ter ao menos 12 caracteres e será trocada no primeiro acesso.

No navegador da própria fac6, abra http://127.0.0.1:8080. Confira os 904 links, categorias, cores, busca e abertura em nova aba. Os testes automatizados não substituem essa conferência com os dados reais.

Se start falhar, não repita importações nem remova dados. Use status e logs, copie a mensagem do erro e resolva antes de publicar na rede. Ctrl+C em logs encerra apenas a visualização dos logs.

## 6. Disponibilize para a rede interna

Somente após aprovação da rede e validação local, altere no .env:

```dotenv
CHARTLINK_BIND_IP=10.20.31.21
```

Execute novamente:

```bash
sh scripts/chartlink.sh start
```

Acesse http://10.20.31.21:8080 a partir de uma máquina autorizada. Com o bind específico no IP LAN, a porta pode deixar de responder em 127.0.0.1; isso é esperado. Não exponha a porta à Internet. A autenticação local protege operações, mas o HTTP não criptografa senhas e cookies; use somente senhas exclusivas do ChartLink e mantenha o acesso restrito à rede interna.

## 7. Depois da instalação

- Pode fechar VS Code e terminal. A fac6 precisa continuar ligada e Docker ativo.
- start atua apenas no projeto opa-chartlink; não reinicie o serviço Docker nem pare kind_newton.
- API tem limite inicial de 512 MiB e web de 128 MiB, sem swap adicional. Isso não garante capacidade do host; monitore uso real e erros de falta de memória.
- sh scripts/chartlink.sh backup cria um snapshot validado. Configure com TI uma rotina e cópia externa protegida; o pacote não cria agendamentos automaticamente.
- Preserve o original e o backup da linac-opi2 até concluir a validação e a política de retenção.
- Permissões dos dados são preparadas para UID 10001. Não use chmod 777 ou chown recursivo em pastas amplas.
- Consulte [PRODUCAO.md](PRODUCAO.md) antes de atualizar. Não publique banco ou backups no GitHub.

Este ZIP contém código/configuração. As imagens ainda precisam ser compiladas pelo workflow ou em máquina autorizada. Nenhuma implantação na fac6 foi executada pelo assistente.
