# Instalação e operação na intranet

## Arquitetura

| Serviço | Execução | Acesso |
| --- | --- | --- |
| Frontend | Nginx servindo os arquivos compilados pelo Vite | Porta 8080 do servidor, configurável |
| Backend | Gunicorn, 1 processo e 4 threads, API Flask | Somente pela rede interna dos containers |
| Banco | SQLite em diretório persistente do servidor | `/var/lib/chartlink/data/chartlink.db` por padrão |
| Backups | Snapshots SQLite fora do código | `/var/backups/chartlink` por padrão |

Esta versão não tem autenticação de usuários. Disponibilize-a na rede interna autorizada; uma publicação na internet exige controle de acesso e HTTPS antes de abrir o serviço ao público. Repositório privado no GitHub não controla o acesso à aplicação em execução.

## 1. Preparar o servidor

Use um Linux com Docker Engine e plugin Docker Compose v2 (2.24 ou superior). Confirme:

```bash
docker version
docker compose version
```

Em um servidor com systemd, habilite o Docker no boot:

```bash
sudo systemctl enable --now docker
```

Se o comando Docker indicar falta de permissão, use os mesmos comandos precedidos por `sudo`, conforme a política da equipe. Não use `chmod 777` no banco ou no socket Docker.

Instalação oficial por distribuição: [Debian](https://docs.docker.com/engine/install/debian/), [Ubuntu](https://docs.docker.com/engine/install/ubuntu/). A compatibilidade depende da versão real do sistema. Os builds precisam de acesso aos registros das imagens, ao npm e ao PyPI; configure o proxy institucional no Docker quando necessário. Não é preciso instalar Node ou Python na máquina de produção.

## 2. Colocar o código em uma pasta nova

Extraia este pacote em uma pasta separada da instalação antiga, ou clone o repositório após publicá-lo. Entre na pasta que contém `compose.yaml`.

Crie a configuração local sem sobrescrever uma configuração existente:

```bash
cp -n .env.example .env
nano .env
```

Confira os diretórios, que devem ficar em disco local e fora da pasta do código. Mantenha `CHARTLINK_BIND_IP=127.0.0.1` para validar no próprio servidor. Para acesso por outros computadores, coloque nesse campo o IP LAN atual do servidor e mantenha `CHARTLINK_PORT=8080`, ou escolha uma porta livre. Use `hostname -I` para consultar os endereços e selecione o da rede utilizada pelos usuários.

O arquivo `.env` não é enviado ao GitHub. Não coloque o banco SQLite em compartilhamento de rede para esta implantação; os backups podem ser copiados para outro equipamento depois de concluídos.

## 3. Importar seu banco atual uma única vez

Pare o Flask da instalação antiga antes da mudança definitiva, para evitar novas edições na base antiga após a cópia. O comando de importação usa a API de backup do SQLite e também inclui dados já confirmados em WAL, quando houver.

Localize o arquivo real utilizado pela instalação atual. No comando abaixo, substitua o caminho entre aspas pelo caminho existente no seu computador; o exemplo não é um caminho pronto para uso:

```bash
sh scripts/chartlink.sh import-db "/caminho/real/da/instalacao/backend/chartlink.db"
```

O comando compila a imagem da API, confere a origem, prepara os diretórios, cria um backup verificado e copia os dados para o novo local. Ele informa a quantidade de links encontrada e os caminhos do banco e do backup dentro do container. Os diretórios correspondentes no servidor são os configurados em `.env`. Os arquivos ficam com leitura e escrita restritas ao usuário do serviço (UID 10001) e ao administrador.

Se o arquivo não existir, a operação para com uma mensagem explícita. Se já houver um banco no destino, ele é preservado e a importação é recusada. Não execute `init-empty` para contornar esses erros: essa opção destina-se apenas a uma instalação nova que não precisa de links anteriores.

Para uma instalação realmente vazia, o comando explícito é:

```bash
sh scripts/chartlink.sh init-empty
```

Os containers de produção recusam iniciar sobre um arquivo ausente, para evitar criar uma base vazia acidentalmente em caso de caminho configurado incorretamente.

## 4. Iniciar e acessar

```bash
sh scripts/chartlink.sh start
sh scripts/chartlink.sh status
```

Os dois serviços devem aparecer saudáveis. No próprio servidor, com o IP padrão, abra `http://127.0.0.1:8080`. Se configurou o IP LAN, use `http://IP_DO_SERVIDOR:8080` nos computadores da rede, substituindo o marcador pelo IP real. A porta precisa estar liberada para a rede autorizada conforme a política local.

Confira a quantidade de links, categorias e cores antes de desativar definitivamente a versão antiga. Nesta execução não é necessário usar `npm run dev` nem `python server.py`.

Agora você pode fechar o terminal e o VS Code. A política `restart: unless-stopped` mantém os containers após reinício do Docker/servidor. Se você executar o comando `stop`, eles permanecem parados até um novo `start`.

## 5. Operação diária

| Necessidade | Comando |
| --- | --- |
| Ver estado | `sh scripts/chartlink.sh status` |
| Acompanhar logs | `sh scripts/chartlink.sh logs` |
| Fazer backup | `sh scripts/chartlink.sh backup` |
| Parar deliberadamente | `sh scripts/chartlink.sh stop` |
| Iniciar novamente | `sh scripts/chartlink.sh start` |

Ctrl+C durante a visualização dos logs fecha apenas essa visualização. Os arquivos de log têm rotação configurada. O healthcheck informa falhas; Docker reinicia um processo que encerra, mas não reinicia automaticamente um container apenas por estar marcado como unhealthy.

O backup cria um arquivo com data UTC e identificador único, sem substituir cópias anteriores. A verificação inclui integridade SQLite e contagem de links. Faça backups periódicos e copie-os também para outro armazenamento; manter uma cópia no mesmo disco não protege de falha desse disco.

## 6. Atualizar o código

Depois de confirmar que suas alterações locais estão versionadas:

```bash
git pull --ff-only
sh scripts/chartlink.sh update
```

O comando compila primeiro. Se a compilação passar, para os serviços, faz um backup consistente e inicia as novas imagens. Os dados permanecem nos diretórios configurados. Não execute `import-db` novamente a cada atualização e não substitua o diretório de dados por arquivos do repositório.

Se a atualização falhar depois de parar os serviços, veja os logs e corrija a causa antes de iniciar novamente. Para retornar a uma versão anterior, use uma cópia do código naquela tag com a mesma configuração; mudanças futuras de schema podem exigir restaurar o snapshot correspondente.

## 7. Restaurar um backup sem apagar a instalação anterior

Pare os serviços. Em `.env`, aponte `CHARTLINK_DATA_DIR` para um **novo diretório vazio**, mantendo o diretório anterior intacto. Execute `import-db` informando o caminho de um snapshot válido em `/var/backups/chartlink` (use `sudo` se precisar de acesso aos arquivos do serviço), depois `start`. Confirme os dados restaurados antes de remover qualquer cópia antiga.

## Diagnóstico

- **Cannot connect to Docker / permission denied:** verifique o serviço Docker e a autorização do usuário no servidor.
- **Banco de origem não encontrado:** confira o caminho real; espaços no caminho devem permanecer dentro das aspas.
- **API não inicia / unable to open database file:** confira `.env`, faça a importação inicial e confirme as permissões. Não crie outro banco por tentativa.
- **Só funciona no próprio servidor:** confira `CHARTLINK_BIND_IP`, a porta e as regras de acesso da rede.
- **502 no navegador:** use `status` e `logs`; confira `/api/health`.

Referências: [Flask com Gunicorn](https://flask.palletsprojects.com/en/stable/deploying/gunicorn/), [reinício automático do Docker](https://docs.docker.com/engine/containers/start-containers-automatically/), [persistência com bind mounts](https://docs.docker.com/engine/storage/bind-mounts/).
