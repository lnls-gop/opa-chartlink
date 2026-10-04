# ChartLink 21 — revisão 1.0.3

## Área de links não classificados

A área virtual chamada “Sem categoria” passa a se chamar **“Links não classificados”**. O novo nome descreve sua função: preservar links que ainda não pertencem a uma pasta e permitir sua organização posterior.

- o seletor do formulário agora define corretamente `folderId = null`, categoria “Links não classificados” e subcategoria vazia;
- novos links criados sem uma pasta selecionada entram nessa área;
- links afetados pela exclusão de categorias ou pastas continuam preservados nessa área;
- registros antigos realmente sem pasta são renomeados automaticamente durante a inicialização;
- a migração ocorre depois da associação das categorias legadas, evitando remover classificações válidas;
- o aviso para criar subcategorias não aparece ao selecionar essa área virtual;
- ícone, realces e arte dos respectivos links usam vermelho `#ef4444`;
- o texto permanece preto para preservar a legibilidade.

“Links não classificados” não é criada como uma pasta raiz e não aceita subcategorias. O banco continua externo ao pacote e não é substituído durante a atualização.

## Atualização

Para atualizar uma instalação existente, preserve os caminhos de dados, backups, IP e porta no `.env`, alterando apenas `CHARTLINK_IMAGE_TAG=1.0.3`. Compile ou carregue as novas imagens, execute `check` e depois `update` em uma janela de manutenção.

Não execute `import-db` nem `init-empty`. O comando `update` cria um backup antes de iniciar a nova versão; se o backup falhar, a aplicação permanece parada.

## Validação local

- TypeScript estrito e build Vite: passaram;
- testes de interface, cores e filtros: 10 passaram;
- testes do worker regex: 2 passaram;
- testes Python de migração, persistência e implantação simulada: 14 passaram;
- total: 26 testes automatizados.

O build Docker e a execução real do Compose precisam ser validados na fac6. O pacote não contém o banco da instalação.
