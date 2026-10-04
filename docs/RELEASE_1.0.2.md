# ChartLink 21 — correção 1.0.2

## Correção principal

A versão 1.0.1 chamava `crypto.randomUUID()` no navegador antes de cadastrar ou importar links. Essa API não está disponível em páginas HTTP abertas por um endereço IP, como `http://10.20.31.21:8080`, e produzia `TypeError: crypto.randomUUID is not a function` antes do envio ao Flask.

Na versão 1.0.2:

- o Flask gera todos os IDs persistentes de links;
- o cadastro individual não depende mais de `crypto.randomUUID()`;
- a importação CSV envia os registros sem IDs definidos pelo navegador;
- a revisão de favoritos usa identificadores temporários, apenas em memória;
- os identificadores temporários não são salvos no banco;
- falhas no cadastro aparecem no formulário, além de serem registradas no console;
- o botão indica `Salvando...` e impede envios duplicados durante a requisição.

O banco e seu esquema não foram recriados nem incorporados ao pacote. A atualização deve reutilizar os diretórios externos configurados por `CHARTLINK_DATA_DIR` e `CHARTLINK_BACKUP_DIR`.

## Atualização da 1.0.1 na fac6

Extraia esta versão em uma pasta nova. Copie o `.env` da instalação atual para a nova pasta, mantendo os caminhos de dados, backups, IP e porta, mas alterando `CHARTLINK_IMAGE_TAG` para `1.0.2`.

Compile ou carregue as imagens 1.0.2 e execute `check`. Em uma janela de manutenção, execute `update`: o script para somente o projeto `opa-chartlink`, cria um snapshot consistente do banco e inicia a nova imagem. Se o backup falhar, a aplicação permanece parada e a atualização não continua.

Não execute `import-db` nem `init-empty` durante essa atualização. Preserve a pasta e as imagens 1.0.1 até validar cadastro individual, CSV, favoritos e a contagem dos links na 1.0.2.

## Validação local

- TypeScript estrito e build Vite: passaram;
- testes de interface/utilitários: 10 passaram;
- testes do worker regex: 2 passaram;
- testes Python do backend, persistência e implantação simulada: 14 passaram;
- total: 26 testes automatizados.

O ambiente local não possui daemon Docker. As imagens e o fluxo Compose real ainda precisam ser validados na fac6. Os testes Python locais usam o Flask legado disponível no ambiente; a imagem de produção instala as versões fixadas em `backend/requirements.txt`.
