# ChartLink 1.0.0

Aplicação para organizar links, dashboards e ferramentas por categorias. Frontend React 18, TypeScript, Vite 4 e Tailwind CSS 3; API Flask e SQLite.

## GitHub e execução contínua

O GitHub armazena e versiona o código. A aplicação é executada em um servidor Linux da sua rede, com Docker Compose. Depois da instalação, você pode fechar o terminal e o VS Code: Docker mantém os serviços ativos e os inicia novamente quando o servidor reinicia, desde que o serviço Docker esteja habilitado. O servidor precisa permanecer ligado e conectado à rede.

- [Instalar e operar em produção](docs/PRODUCAO.md)
- [Publicar o código no GitHub](docs/GITHUB.md)
- [Alterações da versão e validação](docs/RELEASE_1.0.0.md)
- [Histórico da interface](MELHORIAS_INTERFACE.md)

## Estrutura

| Caminho | Função |
| --- | --- |
| `src/` | Interface finalizada, busca, árvore, cards e importação |
| `backend/` | API, migração SQLite e entrada WSGI |
| `compose.yaml` | Nginx e Gunicorn, volumes e reinício automático |
| `deploy/` | Imagens Docker e configurações de produção |
| `scripts/chartlink.sh` | Iniciar, parar, importar banco, atualizar e fazer backup |
| `scripts/database.py` | Snapshot consistente, validação e proteção contra sobrescrita |
| `tests/` | Testes com dados artificiais, sem banco da instalação |

Este pacote não contém `chartlink.db`, backups, ambientes virtuais, `node_modules`, CSVs de dados ou URLs do catálogo privado. A importação de favoritos consulta os links já existentes na instalação como referência e mantém as regras de classificação por subsistema. Os dados entram pelo banco importado no servidor, não pelo GitHub.

## Desenvolvimento local

Requer Node 22 e Python 3.12 para reproduzir os ambientes das imagens. As versões do frontend permanecem fixadas no lockfile.

```bash
npm ci --include=dev
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
.venv/bin/python backend/server.py
```

Em outro terminal:

```bash
npm run dev
```

O backend de desenvolvimento usa `backend/chartlink.db`, com caminho absoluto independente da pasta do terminal. Para outro arquivo, configure `CHARTLINK_DATABASE`. Nunca aponte os testes para o banco de produção.

## Verificação

```bash
npm run build
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

O workflow do GitHub executa essas verificações e constrói os containers com um banco temporário, conferindo persistência após reiniciar a API. Ele não implanta nada no seu servidor.
