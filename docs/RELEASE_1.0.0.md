# ChartLink 1.0.0 — preparação para produção

Pacote de publicação preparado em 02/09/2026. Contém o código da interface finalizada e a configuração para executar a aplicação em um servidor Linux com Docker Compose. O envio ao GitHub e a instalação no servidor ainda precisam ser realizados; este pacote não representa uma implantação concluída.

## Alterações para publicação

- Frontend compilado e servido por Nginx; API executada por Gunicorn, sem modo de depuração.
- Reinício dos serviços pelo Docker e endpoint `/api/health` para verificação do acesso ao banco.
- Caminho do banco configurável e independente do diretório em que o processo é iniciado.
- Banco e backups em diretórios persistentes fora do código; ausência do banco impede a inicialização em produção.
- Importação inicial com snapshot SQLite verificado, incluindo dados confirmados em WAL. A operação recusa substituir um banco já existente.
- Comandos para iniciar, consultar logs, parar, fazer backup e atualizar com backup antes das migrações.
- Publicação sem bancos, backups, ambientes locais, dependências instaladas ou catálogo estático de URLs internas. A classificação de favoritos usa os links carregados da instalação como referência, mantendo as regras e a revisão antes de importar.
- Workflow do GitHub Actions para compilar, executar testes e conferir os containers com dados artificiais.

As versões de React 18, Vite 4 e Tailwind CSS 3 foram mantidas. As imagens usam Node 22 e Python 3.12. As dependências diretas de produção do Python estão fixadas em `backend/requirements.txt`; o frontend usa `package-lock.json`.

## Verificações realizadas

| Verificação | Resultado |
| --- | --- |
| TypeScript estrito e build Vite | Aprovados |
| Testes da interface e do worker de regex | 11 aprovados |
| Testes da API, migração, importação e backup SQLite | 6 aprovados com o Flask 2.0.3 disponível no ambiente local |
| Sintaxe dos scripts shell e dos arquivos YAML | Aprovada |
| Conteúdo do pacote e exclusão dos dados locais pelo Git | Conferidos |

Não foi possível executar Docker, Nginx ou Gunicorn neste ambiente. A instalação das novas dependências Python também não pôde ser concluída por restrição de acesso à rede. Portanto, os testes locais da API não confirmam ainda a execução com o Flask 3.1.3 declarado para produção. O workflow incluído instala essas dependências e testa os containers quando for executado no GitHub; seu resultado ainda não está disponível.

## Antes da mudança definitiva

Siga [GITHUB.md](GITHUB.md) e [PRODUCAO.md](PRODUCAO.md). Importe uma cópia do banco atual e confira links, pastas e cores. Mantenha a instalação anterior e o snapshot até confirmar a nova execução. O banco presente na instalação original não foi alterado por esta preparação.

A aplicação permanece sem autenticação. Esta configuração se destina à intranet autorizada. O computador servidor precisa ficar ligado; fechar o VS Code não interfere nos serviços iniciados pelo Docker.
