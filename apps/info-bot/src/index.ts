import { ButtonInteraction, Events, Interaction, StringSelectMenuInteraction } from "discord.js";
import { CommandManager, createBotClient, createTicket, env, PrefixCommandManager } from "@neon/core";
import { panelCommand } from "./commands/panel.js";
import { ticketCommand } from "./commands/ticket.js";
import { createInfoHelpCommand } from "./prefix/help.js";
import { prefixTicketCommand } from "./prefix/ticket.js";

if (!env.DISCORD_INFO_TOKEN) throw new Error("DISCORD_INFO_TOKEN ausente");

const client = createBotClient("info-bot", { messageContent: true });
const commands = new CommandManager().register(panelCommand).register(ticketCommand);
const prefixCommands = new PrefixCommandManager(env.BOT_PREFIX).register(prefixTicketCommand);
prefixCommands.register(createInfoHelpCommand(prefixCommands));

commands.bind(client);
prefixCommands.bind(client);
client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction instanceof ButtonInteraction && interaction.customId.startsWith("ticket:")) {
    const type = interaction.customId.replace("ticket:", "") as any;
    const ticket = await createTicket(interaction.guild!, interaction.member as any, type);
    await interaction.reply({ content: `Ticket criado: <#${ticket.channelId}>`, ephemeral: true });
  }
  if (interaction instanceof StringSelectMenuInteraction && interaction.customId === "areas:select") {
    await interaction.reply({ content: `Area liberada: **${interaction.values[0]}**.`, ephemeral: true });
  }
});

await client.login(env.DISCORD_INFO_TOKEN);
