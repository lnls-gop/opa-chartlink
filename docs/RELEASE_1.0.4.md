# ChartLink 21 — revisão 1.0.4

Esta revisão implementa os 11 pontos do documento `Upgrade_ChartLink.docx` sem alterar o formato do banco de dados.

## Interface — 11 pontos implementados

1. Favicon próprio do ChartLink para abas e favoritos do navegador.
2. Controle “Selecionar” mais curto.
3. Ordenação por categoria, novo rótulo de data de criação e agrupamento visual por tags primárias.
4. Menu contextual de três pontos na árvore, sem reservar a largura dos quatro botões quando fechado.
5. Botão “Novo Link” no padrão verde da aplicação.
6. Texto correto conforme o nível pai ao criar uma subcategoria; botão “Criar subcategoria”.
7. Rótulo “Nome da categoria” e botão “Criar categoria” ao criar uma raiz.
8. Ícone de pasta com sinal de adição e dica “Adicionar subcategoria”.
9. Borda colorida nos quatro lados dos cards em grade.
10. Emblemas por categoria no círculo decorativo da lista, incluindo o trifólio de radiação para RAD.
11. Linhas da lista mais compactas, sem reduzir as fontes.

## Compatibilidade e atualização

Não existe migração de banco nesta revisão. Preserve os mesmos valores de `CHARTLINK_DATA_DIR`, `CHARTLINK_BACKUP_DIR`, `CHARTLINK_BIND_IP` e `CHARTLINK_PORT` no `.env`; altere apenas `CHARTLINK_IMAGE_TAG=1.0.4`. Gere ou carregue as imagens da revisão, execute `sh scripts/chartlink.sh check` e depois faça a atualização em uma janela combinada com os usuários.

O pacote de código não contém banco, backups, `.env`, `node_modules` ou `.venv`.
