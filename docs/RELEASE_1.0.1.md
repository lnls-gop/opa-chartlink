# ChartLink 21 — revisão de implantação 1.0.1

## Base e preservação

O ChartLink_21.zip enviado nesta etapa tem SHA-256 de88dd97ea4f53d59d3842df3c406d931a0a117ff824059fb8017543510fa8b4 e é idêntico ao arquivo que serviu de base ao pacote de produção anterior. O nome externo não representa uma nova diferença no código.

Esta entrega mantém os arquivos src/ do pacote de produção 1.0.0 sem alterações. A interface não foi redesenhada nesta etapa. O arquivo original foi preservado no ambiente de trabalho. A revisão distribuída é limpa para publicação: dados privados e dependências instaladas não acompanham o código.

O banco validado com 904 links permanece um arquivo separado, a ser transferido da linac-opi2 e importado na fac6. Nenhum banco do ZIP antigo é usado automaticamente.

## Alterações

- Compose de execução usa apenas imagens locais e mantém nome explícito opa-chartlink.
- Compilação foi separada em compose.build.yaml e no comando build.
- Exportação e carregamento de imagens com verificação SHA-256 antes do carregamento.
- start não compila nem baixa imagens. Falta de imagem interrompe a operação.
- Limites iniciais de memória e CPU separados para API e frontend.
- Dados e backups em diretórios locais exclusivos de /home/sirius, externos ao código.
- Importação recusa destino existente, preserva a origem e prepara permissões para UID 10001.
- Guia específico da fac6 e do repositório lnls-gop/opa-chartlink.
- Workflow preparado para disponibilizar imagens linux-amd64 após seus testes, sem banco de dados.
- Versão técnica 1.0.1 no package.json, lockfile e endpoint de saúde.

## Validação realizada nesta revisão

| Verificação | Resultado |
| --- | --- |
| TypeScript estrito, sem emissão | Passou |
| Build frontend Vite 4.5.14 | Passou |
| Testes de interface e utilitários | 9 passaram |
| Testes do worker regex compilado | 2 passaram |
| Testes Python de metadados, migração e persistência | 6 passaram |
| Testes do script de implantação com Docker simulado | 7 passaram |
| Sintaxe shell, YAML e consistência das versões | Passou |

Total: 24 testes automatizados. O build apresentou um aviso de base Browserslist antiga, sem impedir a compilação. O lockfile não foi atualizado indiscriminadamente para remover esse aviso.

## Limitações explícitas

Não havia daemon Docker disponível no ambiente de validação. Não foram executados aqui builds das imagens, Compose real, Nginx, Gunicorn, GitHub Actions nem implantação remota. Os sete testes shell usam um executável Docker simulado: verificam argumentos, escopo e interrupções de segurança, não compatibilidade real do daemon.

Os testes backend locais usaram Python 3.12 com Flask 2.0.3 disponível no ambiente legado. As imagens/CI especificam Python 3.12 e Flask 3.1.3; essa combinação precisa passar no workflow real antes da instalação. O frontend foi compilado com o Node disponível localmente; a imagem e o CI fixam a linha Node 22.

Não foram executados testes visuais de navegador nesta etapa. Os limites de memória são valores iniciais e precisam ser acompanhados com os dados e usuários reais. A arquitetura da fac6 ainda deve ser confirmada por uname -m.

Este ZIP não contém imagens Docker prontas e não representa uma implantação concluída. Não houve push para o GitHub nem alteração no container kind_newton. O pacote também não instala autenticação corporativa ou agendamento de backups.
