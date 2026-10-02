> Histórico das melhorias da interface. Para instalar esta versão de produção, siga README.md e docs/PRODUCAO.md; as instruções de instalação abaixo descrevem entregas anteriores.

# ChartLink — ordenação, busca por pasta e arte da Lista

Esta entrega corrige a ordenação e a navegação por pastas e aplica a arte da Grade ao modo Lista. Inclui o projeto completo, com os ajustes anteriores de `visualização.docx`. Não requer novas dependências de produção. React 18, TypeScript estrito, Vite 4, Tailwind CSS 3, Motion/Framer Motion, lucide-react e Fetch foram mantidos.

## Ajustes desta versão

- **Ordenação por título dentro da pasta:** A → Z e Z → A usam comparação em português, sem distinguir maiúsculas/acentos e sem dar prioridade à pontuação. A ordem é natural: `Temp 2` precede `Temp 10`. Espaços externos são desconsiderados somente na comparação, sem alterar o título salvo.
- **Mais recentes (criação):** data de criação decrescente; em caso de empate, título em A → Z. A última edição continua no painel de informações e não determina essa opção. A mesma regra escolhida ordena os cards e os links diretos dentro de cada pasta expandida.
- **Busca limitada à seleção:** primeiro seleciona a pasta e seus descendentes, depois aplica a pesquisa textual ou regex e finalmente ordena os títulos resultantes. Links copiados de outra categoria entram pela associação da pasta; a categoria principal não os exclui.
- **Navegação cancela a pesquisa anterior:** clicar no nome de uma pasta, em uma subcategoria ou em Todos os Links limpa o campo e mostra os links daquele destino. Clicar somente na seta expande a árvore sem mudar a seleção nem limpar a pesquisa. O modo regex escolhido é preservado.
- **Limpar busca:** botão X à direita do campo e tecla Escape. Mantêm a pasta e a ordenação atuais. O botão devolve o foco ao campo para outra pesquisa; navegar pelas pastas não força esse foco.
- **Lista com arte contínua:** mesmo gradiente, padrão de pontos, órbitas e ícone da categoria da Grade, ocupando todo o fundo da linha. Categoria em negrito e subcategorias como caminho separado por setas, com letras pretas e sem caixas ou contornos em volta do texto. A área inteira continua abrindo o link em nova aba, exceto os botões de ação.

A busca global é possível em **Todos os Links**. O cabeçalho informa **Busca em: [pasta]** durante uma pesquisa. Esse comportamento evita mostrar uma pasta como selecionada enquanto os resultados pertencem a outro contexto.

## Atualizar a versão anterior sem mexer no banco

Se você já instalou a entrega anterior com paleta, regex e informações dos links:

1. Extraia este ZIP em uma pasta separada.
2. Copie **a pasta `src/` completa** para a instalação em uso, substituindo os arquivos do frontend. Para executar os testes desta revisão, atualize também `tests/`.
3. **Não copie `backend/` por cima da instalação.** Esta revisão não exige trocar `server.py` nem `chartlink.db`; assim seu banco permanece no lugar.
4. Na pasta que contém `package.json`, execute `npm run build`. Reinicie `npm run dev` se usa o modo de desenvolvimento; se usa frontend estático, publique os novos arquivos de `dist/` pelo procedimento habitual.

As dependências continuam nas mesmas versões fixadas da entrega anterior. As instruções abaixo de reinstalação completa se aplicam a instalações mais antigas ou novas.

## Melhorias anteriores preservadas

- **Grade e Lista sem endereços visíveis:** removidos hostname, URL completa e a linha reservada a esses dados. A descrição aparece somente quando cadastrada. O endereço continua no painel de informações e na ação Copiar URL; a busca por URL continua funcionando.
- **Grade mais compacta:** cabeçalho ilustrado com altura mínima de 108 px (antes 190 px), ícone e nomes lado a lado, decoração mais suave, colunas com largura mínima de 14 rem e espaços de 12 px. Removidos o rótulo repetido “CATEGORIA” e o marcador “Visão geral”. Nomes longos usam até duas linhas; o painel de informações mantém os nomes completos. Os títulos dos links continuam com a mesma fonte e tamanho nos dois modos.
- **Seleção de categoria sem cunha:** retiradas a borda lateral e a regra de sombra da seleção da árvore. O fundo suave continua indicando a pasta ativa. As bordas coloridas dos cards permanecem.
- **Pastas preenchidas:** ícones abertos e fechados recebem a cor escolhida ou herdada no interior, inclusive no gerenciador, no seletor de destino e na prévia da paleta. Um contorno discreto preserva a forma nas cores claras.
- **Dependências fixadas:** `package.json` e `package-lock.json` consistentes, com React 18.3.1, Vite 4.5.14, TypeScript 5.4.5 e Tailwind 3.4.19. O projeto continua usando o comando `npm run build`, sem “t” no final.

## Instalação completa ou migração de uma versão mais antiga

1. Atualize a pasta `src/`, `backend/server.py`, `package.json`, `package-lock.json` e `tsconfig.json`. Os componentes novos fazem parte da atualização; não copie somente `App.tsx`.
2. **Preserve o `backend/chartlink.db` da instalação em uso.** O banco incluído no ZIP é a cópia original recebida, não uma versão atualizada dos seus dados de produção.
3. Reinicie o Flask pelo procedimento habitual. `init_db()` cria automaticamente as colunas e os triggers necessários, preservando os links e pastas existentes. Em uma inicialização WSGI própria, execute `init_db()` antes de atender as requisições, como já ocorre ao iniciar `python server.py`.
4. Reinicie o Vite no desenvolvimento, ou execute `npm run build` e atualize o frontend compilado se você utiliza produção.

Para reinstalar as dependências, use `npm ci --include=dev` e o ambiente Python da própria instalação. Os diretórios `node_modules` e `.venv` do ZIP foram conservados do arquivo original e não substituem a instalação de dependências compatíveis com seu sistema.

Depois de copiar os arquivos para a instalação, execute na pasta que contém `package.json`:

```bash
npm ci --include=dev
node ./node_modules/vite/bin/vite.js --version
npm run build
npm run dev
```

A versão exibida deve ser `vite/4.5.14`. O lockfile deve acompanhar o `package.json`; não instale `vite@latest` por cima deste projeto.

## Como usar

### 1. Paleta de cores por pasta

Passe o mouse sobre uma pasta na barra lateral ou leve o foco a seus controles com Tab. Clique no ícone de paleta **Alterar cor da pasta**. Escolha entre as cores sugeridas, utilize o seletor de cor personalizado ou informe um código hexadecimal completo, como `#56aeff`. Clique em **Salvar cor**.

As cores são gravadas no SQLite pelo Flask, não apenas no navegador. Valem para os usuários da mesma instalação. Uma subpasta sem cor própria herda a cor do ancestral mais próximo com uma cor definida. A opção **Herdar a cor da pasta superior** remove uma personalização; na raiz, **Usar a cor padrão da categoria** restaura a paleta original.

A escolha acompanha o ícone da pasta, os destaques e os cards associados. Links classificados em mais de uma pasta usam a classificação exibida pelo filtro atual; na visão global, usam sua pasta principal. Alterar a cor não registra uma edição do conteúdo do link.

### 2 e 3. Nova aba e clique na linha

Toda a área do card e da linha em Lista possui uma âncora HTML com `target="_blank"` e `rel="noopener noreferrer"`. O título, o fundo e os detalhes abrem o endereço. Os controles de seleção, copiar, editar, excluir e informações ficam separados e não acionam a abertura.

Os links da árvore e do painel de informações também usam nova aba. A aplicação solicita um novo contexto de navegação; abrir como aba ou janela, a posição da aba e sua ativação dependem das preferências do navegador. Referência: [MDN — Window.open e contextos de navegação](https://developer.mozilla.org/en-US/docs/Web/API/Window/open).

Endereços HTTP/HTTPS sem o esquema, quando reconhecidos como hostname/IP, recebem `http://`. Valores quebrados e esquemas executáveis não são usados como destino. **Quatro registros do arquivo original contêm texto no campo URL em vez de um endereço válido**: aparecem como “Endereço a revisar”. Use o botão Editar para corrigir esses registros; os dados originais foram mantidos.

### 4. Letras pretas nas categorias e etiquetas

As etiquetas, os nomes de categoria na arte, as subcategorias e os nomes das pastas permanecem pretos, inclusive quando selecionados. A cor escolhida permanece no fundo suave, nos ícones e nas bordas.

### 5. Arte no modo Grade e tipografia

Cada card recebe uma composição com ícone relacionado à categoria, órbitas, pontos, fundo em gradiente e os nomes de categoria/subcategoria. A arte é feita com CSS e ícones SVG do lucide-react: acompanha mudanças de nome e cor automaticamente, sem imagens externas fixas.

O título usa a mesma classe tipográfica na grade e na lista, com a família local `Aptos Display`/`Segoe UI` e alternativas de sistema. A fonte exata depende das fontes instaladas. Na grade há também a descrição, quando cadastrada. O hostname fica no painel de informações. Gradientes e demais acabamentos ficam em `chartlink-modern.css`.

### 6. Espaço útil no modo Lista

A linha distribui o conteúdo entre seleção, título/descrição, categoria/caminho de subcategorias e ações, sobre a arte contínua da categoria. O texto da classificação fica livre de caixas arredondadas. O título mantém o mesmo tamanho e família da grade. Em áreas menores, os detalhes passam para outra linha; os botões continuam acessíveis.

### 7. Expressões regulares

Ative o botão **Usar expressão regular** à direita de “Buscar links”. Desativado, o campo continua sendo uma busca textual normal.

| Expressão | Resultado |
| --- | --- |
| `^LI_` | Campos começando com `LI_` |
| `Temperatura\|Vácuo` | Temperatura ou Vácuo |
| `/^SI_.*Temp/i` | Campos começando com SI_ e contendo Temp, sem diferenciar maiúsculas |
| `/Pressure$/` | Campos terminando em Pressure, diferenciando maiúsculas |
| `/\bRF\b/i` | RF como palavra inteira |

Sem delimitadores, a expressão usa a flag `i`. Com `/expressão/flags`, as flags são as informadas pelo usuário. A busca verifica cada título, URL, descrição e caminho de pasta individualmente, somente nos links da seleção atual, preservando a utilidade das âncoras `^` e `$`. Para pesquisar todas as categorias, selecione **Todos os Links** antes de digitar. Navegar para outra pasta limpa a consulta anterior.

Expressões inválidas exibem uma mensagem. A execução ocorre em Worker, com cancelamento ao mudar a busca e limite de um segundo, evitando que uma expressão lenta trave a interface. O limite é de 512 caracteres por expressão. Referência: [MDN — Worker.terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate).

### 8. Informações do link

O ícone **ⓘ** abre uma janela com título, data de criação, última edição registrada, URL, hostname, todas as classificações e descrição. A janela mantém o foco do teclado, fecha com Escape e permite abrir o link em nova aba.

A criação já armazenada é preservada. As futuras edições de conteúdo, movimentações e alterações de classificação passam a registrar `updated_at`. Para links antigos sem histórico, a janela informa **Nenhuma edição registrada**; não inventa uma data anterior. Datas são exibidas em português, no fuso do navegador.

## Arquitetura

- `src/components/LinkCard.tsx`: mesma estrutura de navegação e ações nos dois modos.
- `src/components/CategoryArtwork.tsx`: decoração e identidade compartilhadas entre Grade e Lista.
- `src/components/LinkSearchInput.tsx`: campo de busca, alternância regex, botão Limpar e Escape.
- `src/utils/linkView.ts`: filtro por associações da árvore e ordenação natural por título ou data de criação.
- `src/components/CategoryFolderIcon.tsx`: ícone preenchido consistente na árvore e nos diálogos.
- `src/components/FolderColorDialog.tsx`: paleta, herança, prévia e salvamento.
- `src/components/LinkInfoDialog.tsx` e `AppDialog.tsx`: informações e diálogo acessível.
- `src/styles/categoryStyles.ts`: paleta, herança por ID de pasta e variáveis CSS estritamente tipadas.
- `src/hooks/useLinkSearch.ts` e `src/search/`: busca textual e Worker de regex.
- `src/utils/linkUrl.ts`: normalização dos endereços e apresentação de datas.
- `backend/server.py`: migração aditiva, persistência da cor e registro de edição.

Nova rota: `PUT /api/folders/<id>/color`, com `{"color":"#56aeff"}` ou `{"color":null}`. O Flask valida o formato e retorna a pasta atualizada.

A migração adiciona `folders.color` e `links.updated_at`. É idempotente. Datas e cores são retornadas pelas rotas existentes. A integração continua usando Fetch, com o proxy `/api` original. A sidebar e os wrappers dos cards conservam as animações da refatoração anterior.

## Validação

- TypeScript com `strict: true`: aprovado.
- Build Vite 4: aprovado, incluindo o Worker separado.
- 3 testes Python mantidos da entrega anterior (o backend não mudou nesta revisão): migração idempotente sobre cópia do banco original, HTTP das rotas, validação/persistência/restauração de cor, criação/edição/cópia/movimentação/exclusão de classificação e preservação de `created_at`.
- 8 testes React/TypeScript: navegação em grade/lista, paleta, regex, URLs, datas e regressões de ordenação natural, desempate por título, inclusão de cópias/descendentes e busca restrita à pasta.
- A verificação TypeScript e o build foram executados após as alterações. Os testes de renderização estática não substituem a conferência visual nem simulam todos os cliques.
- 2 testes de Worker: resposta do código compilado e interrupção de uma expressão com backtracking excessivo sem bloquear a thread principal.
- O banco original foi preservado byte a byte; os testes de escrita usam bancos temporários.
- A inspeção visual e os cliques reais no navegador não foram confirmados nesta revisão. Nas tentativas anteriores, o navegador disponível bloqueou o acesso à aplicação local. Os testes de âncoras verificam o HTML renderizado, não a configuração de abas do navegador do usuário.

Comandos de verificação (testes Node exigem Node 18 ou superior):

```bash
npm run lint
npm run build
npm test
python -m unittest discover -s tests -p 'test_*.py'
```

O build mantém os avisos já existentes de base Browserslist antiga e bundle principal acima de 500 kB. Eles não impedem a geração dos arquivos. As cópias históricas `App_.tsx`, `App__.tsx` e `App___.tsx` continuam excluídas do TypeScript; `src/App.tsx` é o componente ativo.
