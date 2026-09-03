# Publicar ChartLink 1.0.0 no GitHub

## O que publicar

Use esta pasta limpa de código. Não envie o ZIP antigo completo, `node_modules`, ambientes virtuais, banco, backups, CSVs ou exportações. O `.gitignore` já exclui esses itens. O pacote também remove o catálogo estático com URLs internas: o classificador usa os links que a própria API carregou do banco.

Crie um repositório chamado `chartlink` na conta ou organização apropriada. A sugestão inicial é **Private**, por se tratar de uma ferramenta interna. Crie o repositório vazio, sem README, licença ou gitignore automáticos, porque os arquivos de configuração já estão neste projeto.

## Primeiro envio

No terminal, entre na pasta deste pacote que contém `package.json` e `compose.yaml`:

```bash
git init -b main
git add .
git status --short
git diff --cached --stat
```

Confira a lista preparada: não deve haver banco, dados da instalação ou ambientes locais. O pacote não contém histórico Git prévio.

Se o Git solicitar sua identidade, configure nome e e-mail **neste repositório**, usando seus dados ou o endereço noreply do GitHub:

```bash
git config user.name "SEU NOME"
git config user.email "SEU EMAIL DO GITHUB"
```

Crie o commit:

```bash
git commit -m "Release inicial do ChartLink 1.0.0"
```

Copie a URL SSH ou HTTPS exibida pelo GitHub. Substitua os marcadores `SUA_CONTA` e `chartlink` pelo destino real:

```bash
git remote add origin https://github.com/SUA_CONTA/chartlink.git
git push -u origin main
```

O envio exige autenticação da sua máquina no GitHub. Use o gerenciador de credenciais, chave SSH configurada ou `gh auth login` se já tiver o GitHub CLI. Não coloque tokens no código nem na URL do remoto.

Depois que o workflow em **Actions** concluir com sucesso, marque a versão:

```bash
git tag -a v1.0.0 -m "ChartLink 1.0.0"
git push origin v1.0.0
```

Se o repositório já existir e tiver histórico, clone-o primeiro e copie este código para ele. Não use force push para resolver diferenças de histórico.

## O que acontece depois do push

O workflow verifica TypeScript, frontend, API, importação/backup e a execução dos containers com dados artificiais. O teste de containers escreve um link de exemplo, reinicia a API e confere a persistência. O workflow não publica os dados e não acessa seu servidor.

O código no GitHub não coloca automaticamente a API Flask em execução. Siga [PRODUCAO.md](PRODUCAO.md) no servidor Linux para disponibilizar a aplicação à equipe.

Referência: [GitHub — adicionar código local a um repositório](https://docs.github.com/en/migrations/importing-source-code/using-the-command-line-to-import-source-code/adding-locally-hosted-code-to-github).
