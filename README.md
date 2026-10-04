# ChartLink — v 1.0.8

Organizador de links e dashboards: React 18, TypeScript, Vite 4, Tailwind CSS 3, Flask e SQLite. Esta revisão adiciona autenticação local, autorização por perfil, proteção CSRF, logs e lixeira recuperável.

## Comece aqui

- [Instalação na fac6, passo a passo](docs/FAC6.md)
- [Enviar o código para lnls-gop/opa-chartlink](docs/GITHUB.md)
- [Operação, backups e atualizações](docs/PRODUCAO.md)
- [Autenticação local e criação do primeiro administrador](docs/AUTENTICACAO_LOCAL.md)
- [Alterações de segurança da revisão 1.0.8](docs/RELEASE_1.0.8.md)
- [Correções de contraste do tema escuro na revisão 1.0.7](docs/RELEASE_1.0.7.md)
- [Tema claro, escuro e automático da revisão 1.0.6](docs/RELEASE_1.0.6.md)
- [Responsividade e árvore de categorias da revisão 1.0.5](docs/RELEASE_1.0.5.md)
- [Alterações visuais da revisão 1.0.4](docs/RELEASE_1.0.4.md)
- [Alterações da área de links não classificados](docs/RELEASE_1.0.3.md)
- [Correção para uso via HTTP por IP](docs/RELEASE_1.0.2.md)
- [Alterações e limites da validação 1.0.1](docs/RELEASE_1.0.1.md)
- [Histórico da interface](MELHORIAS_INTERFACE.md)

O GitHub guarda o código e pode compilar as imagens. A aplicação roda na fac6. O servidor precisa permanecer ligado, conectado à rede e com Docker ativo. Serviços parados manualmente precisam ser iniciados novamente.

## Separação entre código e dados

| Caminho | Função |
| --- | --- |
| src/ | Interface |
| backend/ | API e migrações SQLite |
| compose.yaml | Execução com imagens locais, volumes e limites de recursos |
| compose.build.yaml | Configuração adicional para compilar imagens |
| deploy/ | Dockerfiles, Gunicorn e Nginx |
| scripts/chartlink.sh | Compilação, transporte de imagens e operação |
| scripts/database.py | Importação e snapshots consistentes, sem sobrescrever destino |
| tests/ | Testes com dados artificiais |

Os dados de produção ficam em diretórios locais externos ao código. Não coloque o banco SQLite ativo em compartilhamento de rede.

## Desenvolvimento local

Para reproduzir as imagens: Node 22 e Python 3.12.

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

O backend de desenvolvimento usa backend/chartlink.db. Para outro arquivo, configure CHARTLINK_DATABASE e CHARTLINK_SECRET_KEY. Nunca aponte os testes para o banco real.

## Testes

```bash
npm run build
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

O workflow do GitHub também testa containers e persistência com um banco temporário. Somente após sucesso exporta imagens linux-amd64 como artefato. Não publica a aplicação nem envia o banco para o servidor. Consulte as limitações locais nas notas da versão.
