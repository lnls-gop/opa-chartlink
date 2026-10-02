# Operação em produção

Para a primeira instalação na máquina informada, siga [FAC6.md](FAC6.md). O projeto Compose chama-se opa-chartlink e possui dois serviços: web (Nginx) e api (Gunicorn/Flask). O banco fica em diretório local externo às imagens.

## Compilar é diferente de iniciar

```bash
sh scripts/chartlink.sh build
```

Execute build somente em uma máquina autorizada com memória e disco disponíveis. Esse comando precisa baixar dependências. Os limites de memória do compose.yaml se aplicam à execução, não à compilação.

```bash
sh scripts/chartlink.sh save-images
```

Exporta as imagens para uma nova pasta, com SHA256SUMS. Transfira a pasta completa para o servidor. Use apenas imagens de origem confiável: checksum detecta alterações, mas não comprova autoria.

No servidor, após preparar .env e substituir o caminho abaixo pelo diretório real:

```bash
sh scripts/chartlink.sh load-images "/CAMINHO_REAL/pasta-das-imagens"
sh scripts/chartlink.sh check
```

Importe o banco antes do primeiro start. O script exige imagens presentes e recusa importação sobre um destino existente. Não use init-empty para migrar uma instalação existente.

## Operação diária

Execute na pasta do projeto que contém o .env da instalação:

```bash
sh scripts/chartlink.sh start
sh scripts/chartlink.sh status
sh scripts/chartlink.sh logs
```

Para criar o primeiro administrador depois que a API estiver em execução:

```bash
sh scripts/chartlink.sh create-admin
```

start usa imagens locais, sem compilar ou baixar, e espera as verificações de saúde. Ctrl+C em logs fecha somente a visualização. Para parar exclusivamente este projeto:

```bash
sh scripts/chartlink.sh stop
```

Não execute limpeza global do Docker nem remova volumes de outros projetos. A política unless-stopped reinicia serviços após falhas/reinício do daemon, exceto quando foram parados manualmente. Isso não substitui supervisão, backups nem disponibilidade do servidor.

## Backup

```bash
sh scripts/chartlink.sh backup
```

O comando utiliza a API de backup SQLite e valida a cópia, incluindo alterações já confirmadas em WAL. Imprime o nome do arquivo no diretório /backups do container, correspondente a CHARTLINK_BACKUP_DIR no host. O usuário interno é UID/GID 10001; os arquivos não são públicos. Para acesso no host, pode ser necessário sudo autorizado. Não use chmod 777.

Configure, com TI, uma rotina de backup e cópia para outro armazenamento protegido. Ela não é instalada automaticamente por este pacote. Teste restauração em uma instalação separada. Um backup no mesmo disco não protege contra perda desse disco.

## Atualização com imagens já geradas

1. Conserve o código/configuração anterior, as imagens anteriores e um backup validado.
2. Gere as imagens da nova revisão em máquina apropriada, atribuindo uma nova CHARTLINK_IMAGE_TAG. Ajuste também nomes/tags do workflow se usá-lo. Não reutilize uma tag para revisões distintas.
3. Coloque o novo código em pasta separada. Copie seu `.env` para ela e altere apenas a tag, mantendo os caminhos dos dados, a mesma `CHARTLINK_SECRET_KEY` e o mesmo projeto `opa-chartlink`. Ao migrar de uma revisão anterior à 1.0.8, gere a chave porque ela ainda não existia.
4. Carregue as novas imagens nessa configuração e execute check.
5. Em janela combinada com os usuários:

```bash
sh scripts/chartlink.sh update
```

update para somente opa-chartlink, cria backup e então inicia com as imagens já carregadas. Se o backup falhar, o serviço permanece parado e a nova versão não é iniciada; resolva o erro antes de prosseguir. Não há rollback automático.

O backend pode aplicar migrações na primeira inicialização. Para reverter após uma migração, não presuma que basta trocar a imagem: preserve o banco atual e prepare uma cópia do backup pré-atualização em diretório NOVO, usando a versão anterior e uma janela de manutenção. Nunca sobrescreva o único banco disponível.

## Rede e segurança

O padrão publica somente em 127.0.0.1:8080. Para rede interna, defina o IP LAN do host no .env e autorize acesso com TI. A API não publica uma porta própria no host; o Nginx encaminha /api.

Esta versão implementa autenticação local para edição e exclusão, mas continua operando em HTTP. Rede interna, IP privado e senha local não criptografam o tráfego. Use senhas exclusivas do ChartLink, mantenha sessões curtas e não exponha a porta à Internet. O banco e os backups agora também contêm hashes de senha e auditoria, portanto devem ter acesso restrito. Não suponha que uma regra UFW sozinha filtre portas publicadas pelo Docker.

Veja as ressalvas oficiais sobre [Docker e firewalls](https://docs.docker.com/engine/network/packet-filtering-firewalls/).

## Limites e acompanhamento

API: até 512 MiB e 1 CPU. Web: até 128 MiB e 0,5 CPU. Swap dos containers limitada ao mesmo total de memória, desabilitando swap adicional quando suportado pelo host. São limites iniciais, não reservas nem medição do consumo real. O host e os builds precisam de recursos adicionais. Falta de memória pode encerrar um processo no container.

Acompanhe uso e logs após implantar; ajuste somente com evidência e capacidade disponível. Os logs Docker têm rotação. Nenhum comando do pacote move /var/lib/docker ou modifica o container kind_newton.

Referências: [Compose services](https://docs.docker.com/reference/compose-file/services/), [Docker image save](https://docs.docker.com/reference/cli/docker/image/save/), [Docker image load](https://docs.docker.com/reference/cli/docker/image/load/).
