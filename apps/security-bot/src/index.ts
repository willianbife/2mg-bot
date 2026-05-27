import { ButtonInteraction, Events, Interaction, StringSelectMenuInteraction } from "discord.js";
import { CommandManager, createBotClient, createTicket, env, handleVoiceState, PrefixCommandManager } from "@neon/core";
import { grolesCommand } from "../../moderation-bot/src/commands/groles.js";
import { roleHistoryCommand } from "../../moderation-bot/src/commands/role-history.js";
import { voiceStatsCommand } from "../../moderation-bot/src/commands/voice-stats.js";
import { handleGrolesButton, prefixGrolesCommand } from "../../moderation-bot/src/prefix/groles.js";
import { panelCommand } from "../../info-bot/src/commands/panel.js";
import { ticketCommand } from "../../info-bot/src/commands/ticket.js";
import { prefixTicketCommand } from "../../info-bot/src/prefix/ticket.js";
import { antiraidCommand } from "./commands/antiraid.js";
import { blacklistCommand } from "./commands/blacklist.js";
import { banCommand } from "./commands/ban.js";
import { lockdownCommand, panicCommand, unlockdownCommand } from "./commands/lockdown.js";
import { logsCommand } from "./commands/logs.js";
import { securityCommand } from "./commands/security.js";
import { unbanCommand } from "./commands/unban.js";
import { urlCommand } from "./commands/url.js";
import { prefixBanCommand } from "./prefix/ban.js";
import { createPrefixHelpCommand } from "./prefix/help.js";
import { prefixUnbanCommand } from "./prefix/unban.js";
import {
  prefixAntiraidCommand,
  prefixBlacklistCommand,
  prefixLockdownCommand,
  prefixLogsCommand,
  prefixPanelCommand,
  prefixPanicCommand,
  prefixRoleHistoryCommand,
  prefixSecurityCommand,
  prefixUnlockdownCommand,
  prefixUrlCommand,
  prefixVoiceStatsCommand
} from "./prefix/unified.js";
import { bindSecurityHandlers } from "./security/handlers.js";

if (!env.DISCORD_SECURITY_TOKEN) throw new Error("DISCORD_SECURITY_TOKEN ausente");

const client = createBotClient("unified-bot", { messageContent: true, guildMembers: true });
const commands = new CommandManager()
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
  .register(securityCommand);
const prefixCommands = new PrefixCommandManager(env.BOT_PREFIX)
  .register(prefixGrolesCommand)
  .register(prefixTicketCommand)
  .register(prefixPanelCommand)
  .register(prefixRoleHistoryCommand)
  .register(prefixVoiceStatsCommand)
  .register(prefixBanCommand)
  .register(prefixUnbanCommand)
  .register(prefixBlacklistCommand)
  .register(prefixLogsCommand)
  .register(prefixAntiraidCommand)
  .register(prefixLockdownCommand)
  .register(prefixUnlockdownCommand)
  .register(prefixPanicCommand)
  .register(prefixUrlCommand)
  .register(prefixSecurityCommand);
prefixCommands.register(createPrefixHelpCommand(prefixCommands));

commands.bind(client);
prefixCommands.bind(client);
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction instanceof ButtonInteraction && interaction.customId.startsWith("groles:")) {
    await handleGrolesButton(interaction);
    return;
  }

  if (interaction instanceof ButtonInteraction && interaction.customId.startsWith("ticket:")) {
    const type = interaction.customId.replace("ticket:", "") as any;
    const ticket = await createTicket(interaction.guild!, interaction.member as any, type);
    await interaction.reply({ content: `Ticket criado: <#${ticket.channelId}>`, ephemeral: true });
    return;
  }

  if (interaction instanceof StringSelectMenuInteraction && interaction.customId === "areas:select") {
    await interaction.reply({ content: `Area liberada: **${interaction.values[0]}**.`, ephemeral: true });
  }
});
client.on(Events.VoiceStateUpdate, handleVoiceState);
bindSecurityHandlers(client);

await client.login(env.DISCORD_SECURITY_TOKEN);
