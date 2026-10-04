# ChartLink 1.0.5 — lista responsiva e árvore de categorias

Esta revisão preserva a arquitetura React, TypeScript, Framer Motion, Tailwind e `chartlink-modern.css` e trata os cinco pontos de interface observados com zoom acima de 110%.

## Alterações

1. A arte da categoria ganhou uma coluna própria no modo Lista. O caminho de subcategorias usa largura limitada e reticências, com o conteúdo completo disponível ao manter o cursor sobre ele. Em larguras reduzidas, o emblema decorativo é ocultado antes de disputar espaço com o conteúdo funcional.
2. A barra lateral passa a usar 380 px por padrão e não pode ser reduzida abaixo de 320 px. Larguras anteriormente salvas abaixo desse limite são ajustadas automaticamente.
3. O menu de ações das pastas é renderizado em um portal e aberto 8 px à direita do botão de três pontos, sem ocupar nem cobrir o título da árvore.
4. O menu fecha ao sair com o cursor. Uma tolerância de 180 ms permite atravessar o pequeno intervalo entre o botão e o menu sem fechamento acidental. Clique fora e tecla Escape continuam funcionando.
5. O resumo da árvore mostra separadamente a quantidade de categorias raiz e a quantidade de subcategorias, com singular e plural corretos.

## Compatibilidade

O pacote mantém o banco de dados fora das imagens e do código. A atualização usa as imagens `opa-chartlink-api:1.0.5` e `opa-chartlink-web:1.0.5` com o mesmo diretório persistente configurado por `CHARTLINK_DATA_DIR`.
