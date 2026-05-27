import "dotenv/config";
import { CommandManager, env } from "@neon/core";
import { grolesCommand } from "../apps/moderation-bot/src/commands/groles.js";
import { roleHistoryCommand } from "../apps/moderation-bot/src/commands/role-history.js";
import { voiceStatsCommand } from "../apps/moderation-bot/src/commands/voice-stats.js";
import { panelCommand } from "../apps/info-bot/src/commands/panel.js";
import { ticketCommand } from "../apps/info-bot/src/commands/ticket.js";
import { blacklistCommand } from "../apps/security-bot/src/commands/blacklist.js";
import { banCommand } from "../apps/security-bot/src/commands/ban.js";
import { unbanCommand } from "../apps/security-bot/src/commands/unban.js";
import { logsCommand } from "../apps/security-bot/src/commands/logs.js";
import { antiraidCommand } from "../apps/security-bot/src/commands/antiraid.js";
import { lockdownCommand, panicCommand, unlockdownCommand } from "../apps/security-bot/src/commands/lockdown.js";
import { urlCommand } from "../apps/security-bot/src/commands/url.js";
import { securityCommand } from "../apps/security-bot/src/commands/security.js";

const guildId = env.DISCORD_GUILD_ID;
const recommendedPermissions = "268823638";

function inviteUrl(clientId: string) {
  const params = new URLSearchParams({
    client_id: clientId,
    permissions: recommendedPermissions,
    scope: "bot applications.commands"
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function deploy(name: string, clientId: string | undefined, token: string | undefined, commands: CommandManager) {
  if (!clientId) {
    console.warn(`Client ID ausente para ${name}; pulando.`);
    return;
  }
  if (!token) {
    console.warn(`Token ausente para ${name}; pulando.`);
    return;
  }
  try {
    await commands.deploy(clientId, token, guildId);
  } catch (error: any) {
    const code = error?.code;
    const message = error?.rawError?.message ?? error?.message ?? "erro desconhecido";
    console.error(`Falha ao publicar comandos de ${name}: ${message}`);
    if (code || error?.status) {
      console.error(`Detalhes: code=${code ?? "n/a"} status=${error?.status ?? "n/a"}`);
    }
    if (code === 50001) {
      console.error(`O bot ${name} nao esta instalado no servidor ou foi convidado sem applications.commands.`);
      console.error(`Convite: ${inviteUrl(clientId)}`);
    }
    if (code === 20012) {
      console.error(`O Client ID de ${name} nao pertence ao token informado. Confira o Application ID no Developer Portal.`);
    }
  }
}

await deploy(
  "unified",
  env.DISCORD_SECURITY_CLIENT_ID ?? env.DISCORD_CLIENT_ID,
  env.DISCORD_SECURITY_TOKEN,
  new CommandManager()
    .register(grolesCommand)
    .register(roleHistoryCommand)
    .register(voiceStatsCommand)
    .register(panelCommand)
    .register(ticketCommand)
    .register(blacklistCommand)
    .register(banCommand)
    .register(unbanCommand)
    .register(logsCommand)
    .register(antiraidCommand)
    .register(lockdownCommand)
    .register(unlockdownCommand)
    .register(panicCommand)
    .register(urlCommand)
    .register(securityCommand)
);

process.exit(0);
