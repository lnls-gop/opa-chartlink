# Autenticação local do ChartLink

## Permissões

| Operação | Visitante | Usuário | Administrador |
| --- | ---: | ---: | ---: |
| Consultar, pesquisar e abrir links | Sim | Sim | Sim |
| Incluir um link individual | Sim | Sim | Sim |
| Editar, mover e copiar links | Não | Sim | Sim |
| Importar vários links | Não | Sim | Sim |
| Enviar links para a lixeira | Não | Sim | Sim |
| Restaurar links | Não | Sim | Sim |
| Criar e alterar categorias | Não | Sim | Sim |
| Excluir categorias | Não | Não | Sim |
| Excluir definitivamente da lixeira | Não | Não | Sim |
| Gerenciar usuários e consultar auditoria | Não | Não | Sim |

## Primeiro administrador

Com os containers em execução:

```bash
sh scripts/chartlink.sh create-admin
```

A senha não aparece na tela e não entra no histórico do shell. Use uma senha exclusiva do ChartLink, com ao menos 12 caracteres e sem o nome do usuário. O primeiro login exige a substituição da senha temporária.

Depois disso, entre pelo botão **Entrar** do cabeçalho. Administradores encontram **Usuários e auditoria** no menu do próprio nome e podem criar outras contas, alterar perfis, desativar contas e redefinir senhas temporárias.

O sistema impede a desativação ou rebaixamento do último administrador ativo.

## Sessão e tentativas

- A sessão expira após 30 minutos de inatividade por padrão.
- Não existe opção “Lembrar-me”.
- Após cinco falhas consecutivas, a conta fica bloqueada por 15 minutos.
- A redefinição feita pelo administrador desbloqueia a conta e exige troca da senha no próximo acesso.
- Toda chamada que altera dados exige um token CSRF associado à sessão do navegador.

Os valores podem ser ajustados no `.env`, usando as variáveis documentadas em `.env.example`.

## Lixeira e auditoria

Excluir um link apenas preenche `deleted_at` e `deleted_by`; o conteúdo continua no banco e pode ser restaurado. A exclusão física é exclusiva de administradores e exige nova confirmação.

A auditoria registra inclusões, edições, movimentações, importações, exclusões, restaurações, logins e administração de contas. Ela registra usuário, horário, endereço IP observado pela aplicação e tipo da operação. O histórico é consultado na interface administrativa.

Categorias e subcategorias não vão para a lixeira: somente administradores podem removê-las. Os links afetados são enviados para **Links não classificados**.

## Limite da inclusão pública

Visitantes podem incluir, por padrão, até 30 links em uma janela de dez minutos por endereço IP. Usuários autenticados não usam esse limite. A API rejeita protocolos executáveis e limita o tamanho dos campos e da requisição.

Como o Nginx é o único caminho publicado, o Flask confia em exatamente um proxy para identificar o endereço de origem. Não publique a porta interna da API diretamente.

## Limitação do HTTP

A autenticação local controla permissões, mas não criptografa o tráfego HTTP. Não reutilize senha corporativa, bancária ou pessoal. Restrinja a porta à rede interna e não publique o ChartLink na Internet. Se futuramente houver HTTPS, defina `CHARTLINK_COOKIE_SECURE=1` no serviço da API.

## Recuperação administrativa

Se nenhum administrador conseguir entrar, não crie senhas em arquivos ou comandos visíveis. Pare e faça um backup validado do banco antes de qualquer intervenção. Um segundo administrador ativo reduz esse risco operacional.
