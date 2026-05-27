import { ButtonInteraction, Events, Interaction } from "discord.js";
import { CommandManager, createBotClient, env, handleVoiceState, PrefixCommandManager } from "@neon/core";
import { grolesCommand } from "./commands/groles.js";
import { roleHistoryCommand } from "./commands/role-history.js";
import { voiceStatsCommand } from "./commands/voice-stats.js";
import { handleGrolesButton, prefixGrolesCommand } from "./prefix/groles.js";
import { createModerationHelpCommand } from "./prefix/help.js";

if (!env.DISCORD_MODERATION_TOKEN) throw new Error("DISCORD_MODERATION_TOKEN ausente");

const client = createBotClient("moderation-bot", { messageContent: true });
const commands = new CommandManager()
  .register(grolesCommand)
  .register(roleHistoryCommand)
  .register(voiceStatsCommand);
const prefixCommands = new PrefixCommandManager(env.BOT_PREFIX).register(prefixGrolesCommand);
prefixCommands.register(createModerationHelpCommand(prefixCommands));

commands.bind(client);
prefixCommands.bind(client);
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction instanceof ButtonInteraction && interaction.customId.startsWith("groles:")) {
    await handleGrolesButton(interaction);
  }
});
client.on(Events.VoiceStateUpdate, handleVoiceState);

await client.login(env.DISCORD_MODERATION_TOKEN);
