# Enviar para lnls-gop/opa-chartlink

Use sua conta com acesso concedido pela organização. Não envie o ZIP como único arquivo: o repositório deve conter package.json, src/, backend/, compose.yaml e os demais arquivos diretamente na raiz.

Não inclua banco, backups, .env real, senhas, tokens, CSVs internos, node_modules, .venv ou imagens TAR. O pacote já contém .gitignore e .dockerignore; revise os arquivos antes do commit. Não use git add -f para contornar as exclusões.

## Se o repositório já tem arquivos

Não substitua o histórico. Clone o repositório e crie uma branch:

```bash
git clone https://github.com/lnls-gop/opa-chartlink.git
cd opa-chartlink
git switch -c deploy/chartlink-21
```

Copie o conteúdo da pasta ChartLink_21_producao para esse clone, incluindo os arquivos ocultos de configuração, preservando a pasta .git. Compare as alterações. Se houver trabalho recente de colegas, integre-o antes de continuar.

```bash
git status --short
git diff
git add .
git diff --cached --stat
git diff --cached
git commit -m "Prepara ChartLink 21 para Docker na fac6"
git push -u origin deploy/chartlink-21
```

Abra um pull request no GitHub e siga as regras de revisão da organização. Não use force-push.

## Somente se o repositório estiver vazio

Dentro da pasta extraída ChartLink_21_producao, e somente se ela ainda não for um repositório Git:

```bash
git init -b main
git add .
git diff --cached --stat
git diff --cached
git commit -m "Adiciona ChartLink 21 com implantação Docker"
git remote add origin https://github.com/lnls-gop/opa-chartlink.git
git push -u origin main
```

Se o Git solicitar identidade, configure seu nome e e-mail institucionais nessa pasta. Autentique pelo método aprovado pela organização. Nunca cole tokens no código ou na URL do remote. Se o push for negado ou indicar histórico remoto existente, pare e confira permissões/histórico; não force.

## Gerar imagens pelo GitHub Actions

Após o envio, abra a aba Actions e o workflow "Verificar ChartLink". Ele instala dependências, testa o código, compila imagens, testa a persistência e disponibiliza o artefato:

opa-chartlink-1.0.8-linux-amd64

Baixe apenas o artefato da execução bem-sucedida da revisão que você aprovou. Ele contém opa-chartlink-images.tar e SHA256SUMS, sem seu banco de dados. A retenção solicitada é de três dias; políticas e cotas da organização podem limitar o recurso.

Confirme com TI se código e builds podem ser processados em runners hospedados no GitHub. Se não puderem, use uma máquina de compilação autorizada conforme FAC6.md. Permissões ou políticas bloqueadas devem ser resolvidas com a organização, sem contornar controles.

As imagens do workflow são para Linux x86_64/amd64. Confira uname -m na fac6 antes de utilizá-las. O workflow não altera o container kind_newton, não acessa a fac6 e não faz implantação automática.

Referência dos parâmetros de artefatos: [actions/upload-artifact](https://github.com/actions/upload-artifact).
