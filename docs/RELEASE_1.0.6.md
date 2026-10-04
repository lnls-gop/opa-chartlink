# ChartLink 1.0.6 — temas Claro, Escuro e Automático

Esta revisão adiciona controle de aparência sem modificar a estrutura de dados ou a persistência SQLite.

## Funcionamento

- **Claro:** mantém a apresentação tradicional da aplicação.
- **Escuro:** usa fundos e superfícies escuras com textos e controles de alto contraste.
- **Automático:** acompanha `prefers-color-scheme` do sistema operacional e reage a alterações enquanto a aplicação está aberta.

A preferência fica armazenada no navegador em `chartlink.theme`. Um script executado antes da inicialização do React aplica o tema imediatamente e evita a exibição momentânea do tema claro ao abrir a página.

## Legibilidade preservada

- As artes de categoria dos cards permanecem claras e suavemente coloridas no tema escuro.
- Os nomes de categoria, subcategoria e demais etiquetas sobre essas artes continuam pretos.
- Títulos e descrições da área inferior dos cards em Grade mudam para tons claros.
- A linha completa do modo Lista permanece clara, mantendo sua identidade visual e contraste.
- Sidebar, cabeçalho, controles, formulários, menus contextuais e diálogos usam superfícies escuras próprias.
- Estados de foco, seleção, erro, alerta e ação destrutiva continuam distintos por cor e não dependem apenas de luminosidade.

## Atualização no FAC6

Use `CHARTLINK_IMAGE_TAG=1.0.6` no `.env`, carregue ou compile as imagens da revisão e execute:

```bash
sh scripts/chartlink.sh check
sh scripts/chartlink.sh update
```

O comando `update` cria um backup antes de iniciar os novos containers. Não execute `import-db` nem `init-empty` em uma instalação já existente.
