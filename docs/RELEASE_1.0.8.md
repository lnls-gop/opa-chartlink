# ChartLink 1.0.8 — autenticação local e lixeira

## Entregue nesta revisão

- Login local com senha protegida por Argon2id.
- Perfis `user` e `admin`, com autorização validada no Flask.
- Inclusão individual preservada para visitantes.
- Edição, movimentação, cópia, importação e organização protegidas por login.
- Exclusão de categorias e exclusão definitiva restritas a administradores.
- Lixeira de links com restauração e autoria da exclusão.
- Sessões curtas, sem “Lembrar-me”, e troca obrigatória de senha temporária.
- Proteção CSRF para toda requisição de alteração.
- Bloqueio temporário após tentativas de login consecutivas.
- Limite de inclusões anônimas por IP.
- Auditoria de autenticação, links, categorias e administração de usuários.
- Painéis responsivos para login, senha, lixeira, usuários e auditoria, incluindo tema escuro.
- Comando `sh scripts/chartlink.sh create-admin`.

## Migração do banco

A inicialização adiciona as tabelas `users`, `audit_log` e `rate_limits`, além dos campos `deleted_at` e `deleted_by` em `links`. A migração é idempotente e não recria, substitui nem apaga links existentes.

Antes de atualizar, execute um backup pelo pacote anterior. A nova versão exige `CHARTLINK_SECRET_KEY` no `.env`; gere-a na fac6 e preserve o valor entre reinicializações.

## Atualização da 1.0.7

1. Extraia a 1.0.8 em uma pasta nova.
2. Copie o `.env` da instalação anterior para a nova pasta.
3. Altere `CHARTLINK_IMAGE_TAG=1.0.8`.
4. Gere e acrescente `CHARTLINK_SECRET_KEY` ao `.env`.
5. Carregue as imagens 1.0.8 e execute `sh scripts/chartlink.sh check`.
6. Execute `sh scripts/chartlink.sh update`; o comando para somente o ChartLink, faz backup e inicia a revisão.
7. Execute `sh scripts/chartlink.sh create-admin`.
8. Valide o login, a troca obrigatória de senha, a lixeira e os 904 links.

O banco permanece nos diretórios externos definidos por `CHARTLINK_DATA_DIR` e `CHARTLINK_BACKUP_DIR`.
