# Neon Community Suite

Sistema profissional e original de bot unico para Discord com arquitetura moderna, dashboard administrativo, PostgreSQL, Redis, Prisma, Docker, logs, auditoria, permissoes e visual premium preto/rosa neon.

## Stack

- Node.js + TypeScript
- Discord.js v14
- PostgreSQL + Prisma ORM
- Redis para cache, cooldowns e protecao anti-abuso
- Next.js + TailwindCSS + componentes estilo Shadcn/UI + Framer Motion
- Pino para logs estruturados
- Canvas + Sharp para cards de estatisticas
- JWT/OAuth2 preparado para o painel
- Docker Compose para infraestrutura local e deploy

## Estrutura

```txt
apps/
  moderation-bot/     Modulos legados reutilizados pelo bot unico: groles, role history, voice stats e cards
  info-bot/           Modulos legados reutilizados pelo bot unico: paineis, tickets, areas e componentes
  security-bot/       Bot unico em execucao: moderacao, tickets, blacklist, ban, logs, anti-raid, anti-nuke e anti URL
  dashboard/          Painel web Next.js
packages/
  core/               Config, logger, Redis, guards, embeds, services e managers
  database/           Prisma schema, seed e client compartilhado
scripts/
  deploy-commands.ts  Publicacao dos comandos slash
```

## Instalacao

1. Instale Node.js 22+, Docker Desktop e PostgreSQL/Redis via Docker.
2. Copie `.env.example` para `.env`.
3. Preencha `DISCORD_SECURITY_TOKEN` e `DISCORD_SECURITY_CLIENT_ID` com o bot unico.
4. Suba a infraestrutura:

```bash
docker compose up -d postgres redis
```

5. Instale dependencias:

```bash
npm install
```

6. Gere o Prisma Client e rode migrations:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

O script `db:migrate` ja usa o nome `init`, entao ele nao abre prompt interativo na primeira migration.

7. Publique comandos slash:

```bash
npm run commands:deploy
```

8. Rode tudo em desenvolvimento:

```bash
npm run dev
```

Dashboard: `http://localhost:3000`.

## Variaveis `.env`

```env
DATABASE_URL=postgresql://neon:neon@localhost:5433/neon_community
REDIS_URL=redis://localhost:6379
DISCORD_CLIENT_ID=
# Campos antigos opcionais, mantidos apenas para compatibilidade.
DISCORD_MODERATION_CLIENT_ID=
DISCORD_INFO_CLIENT_ID=
DISCORD_SECURITY_CLIENT_ID=
DISCORD_GUILD_ID=
DISCORD_MODERATION_TOKEN=
DISCORD_INFO_TOKEN=
DISCORD_SECURITY_TOKEN=
DISCORD_OAUTH_CLIENT_SECRET=
DISCORD_OAUTH_REDIRECT_URI=http://localhost:3000/api/auth/callback
JWT_SECRET=change-me-with-a-long-random-secret
INTERNAL_WS_SECRET=change-me-too
BOT_PREFIX=2mg!
```

## Discord Developer Portal

1. Crie uma aplicacao no Discord Developer Portal.
2. Crie uma unica aplicacao/bot para o projeto.
   - Use o Application ID em `DISCORD_SECURITY_CLIENT_ID` ou em `DISCORD_CLIENT_ID`.
   - Use o token em `DISCORD_SECURITY_TOKEN`.
   - Os campos `DISCORD_MODERATION_*` e `DISCORD_INFO_*` ficaram opcionais apenas para compatibilidade com codigo legado.
3. Ative os intents: Server Members, Message Content e Presence se necessario.
   - Para comandos por prefixo como `2mg!ban`, `2mg!groles` e `2mg!ticket`, o bot unico precisa do **Message Content Intent** ativo.
4. Configure OAuth2 com scopes `bot`, `applications.commands`, `identify` e `guilds`.
5. Permissoes recomendadas: Manage Roles, Manage Channels, Ban Members, Kick Members, Moderate Members, View Audit Log, Send Messages, Embed Links, Attach Files, Read Message History.
6. Convide o bot com o escopo `applications.commands`.
7. Garanta que o cargo do bot esteja acima dos cargos que ele precisa gerenciar.

## Banco de Dados

O schema Prisma inclui:

- `users`, `guilds`
- `tickets`, `ticket_messages`
- `punishments`, `role_history`, `voice_stats`
- `blacklists`, `permissions`, `audits`
- `SecurityConfig`, `SecurityEvent`
- `calls`, `panels`, `migrations`, `transfers`
- `group_panelas`

O seed cria a guild base, um painel de boas-vindas e permissoes iniciais.

## Bot Unico

### Moderacao

- `/groles add/remove` com multiplos cargos, motivo obrigatorio, bloqueio por hierarquia e auditoria.
- `/groles` com uma unica interface: acao, usuario por mencao/ID/nome/id, cargo e motivo apenas para remover.
- `2mg!groles add usuario/id cargo/id`
- `2mg!groles remove usuario/id cargo/id motivo`
- `/role-history` com paginacao.
- `/voice-stats` com card gerado em Canvas/Sharp.
- Evento de voice state para tempo total, semanal, mensal, mutado e deafened.

### Informacoes/Tickets

- `/panel` para publicar embeds informativos com buttons/select menus.
- `/ticket` para abrir categorias: suporte, denuncia, devolucao, transferencia, migracao e ingresso.
- Servico de ticket com canal privado, cooldown e registro em banco.
- Estrutura pronta para transcript HTML, assumir, fechar, reabrir e avaliacao.

### Seguranca

- `/blacklist add` local/global com motivo e provas.
- `/ban` com mencao, ID ou nome/id e limpeza opcional de mensagens.
- `/unban` por ID ou nome/id.
- `/logs configurar` para vincular canais de log por categoria.
- `/logs status` para revisar canais configurados.
- `/logs testar` para validar envio de embed no canal da categoria.
- `/antiraid configurar` para ajustar janela, limite de entradas, conta nova, cargo de quarentena, canal staff e lockdown.
- `/antiraid status`, `/antiraid ativar` e `/antiraid desativar`.
- `/lockdown`, `/unlockdown` e `/panic` para bloquear ou liberar mensagens/calls em emergencia.
- `/url bloquear`, `/url desbloquear` e `/url lista` para gerenciar dominios do anti URL.
- `/security status`, `/security whitelist` e `/security unwhitelist`.
- `2mg!ban @usuario motivo` para banimento por prefixo.
- `2mg!ban 123456789012345678 motivo` para banimento por ID.
- `2mg!unban 123456789012345678 motivo` para desbanimento por prefixo.
- `2mg!help` para listar comandos por prefixo.
- Logs automaticos em embed para entrada/saida, calls, mensagens, boost, bans, URL e cargos.
- Anti-spam, flood, mass mention, excesso de emojis e links em massa via Redis.
- Anti-raid com deteccao de entrada massiva, conta nova e conta sem avatar.
- Anti-nuke com deteccao de criacao/exclusao massiva de canais/cargos e banimentos em massa.
- Anti URL para invites externos, dominios bloqueados, encurtadores suspeitos e phishing/scam.
- Auditoria no banco em `SecurityEvent` e `Audit`.

#### Configuracao rapida de seguranca

1. Publique os comandos:

```bash
npm run commands:deploy
```

2. Configure os canais de log:

```txt
/logs configurar categoria:entrada-saida canal:#logs-entrada-saida
/logs configurar categoria:calls canal:#logs-calls
/logs configurar categoria:mensagens canal:#logs-mensagens
/logs configurar categoria:boost canal:#logs-boost
/logs configurar categoria:bans canal:#logs-bans
/logs configurar categoria:url canal:#logs-url
/logs configurar categoria:cargos canal:#logs-cargos
```

3. Ajuste o anti-raid:

```txt
/antiraid configurar limite_entradas:8 janela_segundos:45 dias_conta_nova:7 cargo_quarentena:@Quarentena canal_staff:#staff lockdown:true
/antiraid ativar
```

4. Configure dominios bloqueados:

```txt
/url bloquear dominio:bit.ly
/url bloquear dominio:free-nitro
/url lista
```

5. Adicione donos, bots de confianca ou automacoes a whitelist:

```txt
/security whitelist usuario:@Usuario
/security status
```

Permissoes internas usadas pelos novos comandos:

- `security.config` para `/logs`, `/antiraid`, `/url` e `/security`.
- `security.lockdown` para `/lockdown`, `/unlockdown` e `/panic`.
- `security.ban` continua sendo usado por `/ban`.

O bot precisa de `View Audit Log`, `Manage Roles`, `Manage Channels`, `Moderate Members`, `Ban Members`, `Send Messages`, `Embed Links`, `Read Message History`, `Guild Members Intent` e `Message Content Intent`.

#### Checklist de testes de seguranca

- Rodar `npm run db:generate`, `npm run db:migrate` ou `npm run db:deploy` e `npm run commands:deploy`.
- Executar `/logs testar` para todas as categorias configuradas.
- Entrar e sair com uma conta de teste para validar `entrada-saida`.
- Enviar, editar e apagar mensagem com texto, link e anexo para validar `mensagens` e `url`.
- Entrar, trocar e sair de call para validar tempo de call.
- Criar, editar e remover cargo/canal de voz em ambiente de teste para validar logs administrativos.
- Simular spam com mensagens repetidas e muitas mencoes para validar timeout/delete.
- Testar `/panic` e `/unlockdown` em servidor de homologacao antes de usar em producao.

## Dashboard

O painel em `apps/dashboard` traz:

- visual escuro, neon rosa/preto, blur e hover effects;
- cards de metricas conectados ao Prisma;
- preview de embeds e painel operacional;
- rota de login Discord OAuth2;
- healthcheck em `/api/health`;
- base pronta para telas de tickets, embeds, permissoes, logs e configuracoes.

## Docker

Desenvolvimento com banco/cache:

```bash
docker compose up -d postgres redis
```

Stack completa com bot unico, dashboard, banco e Redis:

```bash
docker compose up --build
```

Em producao, use secrets reais, rode `npm run db:deploy` no release e monitore logs estruturados.

## Producao

- Use um unico token de bot em `DISCORD_SECURITY_TOKEN`.
- Configure `JWT_SECRET` e `INTERNAL_WS_SECRET` com strings longas e aleatorias.
- Ative backup automatico do PostgreSQL.
- Use Redis persistente.
- Restrinja o dashboard atras de OAuth2 e permissoes internas.
- Configure canais de log por categoria com `/logs configurar`.
- Revise periodicamente whitelist e dominios bloqueados com `/security status` e `/url lista`.
- Rode o bot unico com restart policy, healthchecks e observabilidade.
- Publique comandos globais apenas quando estiver estavel; use `DISCORD_GUILD_ID` para desenvolvimento rapido.

## Proximos Modulos Naturais

- Transcript HTML completo em `ticketService`.
- Telas CRUD do dashboard para permissao, painel, blacklist e tickets.
- Jobs agendados para reset semanal e tempban.
- Sharding manager para grandes comunidades.
- Plugin API para comandos externos.
