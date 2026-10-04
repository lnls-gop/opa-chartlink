# ChartLink 1.0.7 — correção de contraste do tema escuro

Esta revisão corrige problemas de legibilidade identificados após a implantação inicial do modo escuro.

## Correções

- Cards em Lista e as artes dos cards em Grade agora usam uma base escura opaca. O gradiente da categoria é aplicado sobre essa base sem revelar cores claras ou criar zonas de baixo contraste.
- Títulos dos links, categorias, subcategorias e caminhos hierárquicos passam a usar texto claro no modo escuro.
- As etiquetas de subcategorias da barra superior recebem fundo, borda e texto específicos para o tema, inclusive quando as cores são definidas dinamicamente no JSX.
- A janela **Categorias e Subcategorias** usa texto claro nas duas colunas, nos itens da árvore e no destino selecionado.
- Estados selecionados em verde, alertas e etiquetas informativas usam fundos escuros tonalizados e texto claro.
- As demais janelas herdam corretamente as cores de texto do tema. As únicas exceções com texto preto são prévias deliberadamente claras, como a amostra da paleta de cores.

## Atualização no FAC6

Defina `CHARTLINK_IMAGE_TAG=1.0.7`, prepare as novas imagens e execute:

```bash
sh scripts/chartlink.sh check
sh scripts/chartlink.sh update
```

Não reimporte o banco. O comando `update` preserva o diretório de dados configurado e cria um backup antes da troca dos containers.
