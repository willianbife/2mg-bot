import { ButtonInteraction, Events, Interaction, StringSelectMenuInteraction } from "discord.js";
import { 
  CommandManager, 
  createBotClient, 
  createTicket, 
  env, 
  handleVoiceState, 
  PrefixCommandManager,
  applyRoleAction,
  logger
} from "@neon/core";
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
import { tempocallCommand } from "./commands/tempocall.js";
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
  .register(tempocallCommand)
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
  if (interaction instanceof ButtonInteraction) {
    const [action, userId, roleId] = interaction.customId.split(":");

    // Handler para Gerenciamento de Cargos (Novo Builder)
    if (action === "role_add" || action === "role_remove") {
      if (userId !== interaction.user.id) {
        return await interaction.reply({
          content: "Você não pode gerenciar cargos de outro usuário!",
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });

      const role = interaction.guild?.roles.cache.get(roleId);
      const member = interaction.guild?.members.cache.get(userId);

      if (!role || !member) {
        return await interaction.editReply("Cargo ou membro não encontrado.");
      }

      try {
        const operation = action === "role_add" ? "add" : "remove";
        await applyRoleAction({
          executor: member,
          target: member,
          roles: [role],
          action: operation,
          reason: `Cargo ${operation === "add" ? "adicionado" : "removido"} via painel profissional por ${interaction.user.tag}`
        });

        await interaction.editReply({
          content: `Cargo **${role.name}** ${operation === "add" ? "adicionado" : "removido"} com sucesso!`,
        });
        
        logger.info(`[Roles] ${interaction.user.tag} ${operation} cargo ${role.name} em ${interaction.guild?.name}`);
      } catch (error: any) {
        logger.error(`Erro ao processar cargo: ${error.message}`);
        await interaction.editReply({
          content: `Erro: ${error.message || "Tente novamente mais tarde."}`,
        });
      }
      return;
    }

    // Handler legado/prefix
    if (interaction.customId.startsWith("groles:")) {
      await handleGrolesButton(interaction);
      return;
    }

    if (interaction.customId.startsWith("ticket:")) {
      const type = interaction.customId.replace("ticket:", "") as any;
      const ticket = await createTicket(interaction.guild!, interaction.member as any, type);
      await interaction.reply({ content: `Ticket criado: <#${ticket.channelId}>`, ephemeral: true });
      return;
    }
  }

  if (interaction instanceof StringSelectMenuInteraction && interaction.customId === "areas:select") {
    await interaction.reply({ content: `Area liberada: **${interaction.values[0]}**.`, ephemeral: true });
  }
});

client.on(Events.VoiceStateUpdate, handleVoiceState);
bindSecurityHandlers(client);

await client.login(env.DISCORD_SECURITY_TOKEN);
