# ChartLink Manager 1.0.8

O ChartLink é uma aplicação web interna para organizar e acessar links de gráficos, dashboards e outras páginas usadas na operação do Sirius.

Os links podem ser separados por categorias e subcategorias, pesquisados por texto ou expressão regular e exibidos nos modos Grade ou Lista. A aplicação também oferece temas claro, escuro e do sistema, autenticação local, permissões por perfil, log de ações e lixeira recuperável.

## Documentação

- [Instalação na FAC6](docs/FAC6.md)
- [Operação, backup e atualização](docs/PRODUCAO.md)
- [Autenticação e primeiro administrador](docs/AUTENTICACAO_LOCAL.md)
- [Envio do código para o GitHub](docs/GITHUB.md)
- [Alterações da versão 1.0.8](docs/RELEASE_1.0.8.md)

## Estrutura

| Caminho | Conteúdo |
| --- | --- |
| `src/` | Interface React e TypeScript |
| `backend/` | API Flask e banco SQLite |
| `deploy/` | Dockerfiles, Gunicorn e Nginx |
| `scripts/` | Build, backup e operação |
| `tests/` | Testes do frontend e do backend |
| `compose.yaml` | Execução dos containers |
| `compose.build.yaml` | Compilação das imagens |

## Desenvolvimento local

O ambiente de referência utiliza Node.js 22 e Python 3.12.

```bash
npm ci --include=dev
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
```

Inicie o backend:

```bash
.venv/bin/python backend/server.py
```

Em outro terminal, inicie o frontend:

```bash
npm run dev
```

O desenvolvimento usa `backend/chartlink.db`. Para escolher outro banco, configure `CHARTLINK_DATABASE` e `CHARTLINK_SECRET_KEY`. Nunca execute testes usando o banco de produção.

## Testes

```bash
npm run build
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

O workflow do GitHub também testa os containers com um banco temporário. Quando tudo passa, as imagens Linux AMD64 ficam disponíveis como artefato.

## Produção
A aplicação roda na FAC6. O servidor precisa permanecer ligado, conectado à rede e com o Docker ativo.

Os dados de produção ficam fora do diretório do código. O banco SQLite ativo, o arquivo `.env` e os backups não devem ser enviados ao GitHub.
