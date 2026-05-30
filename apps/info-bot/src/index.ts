import { Events, Interaction, ModalSubmitInteraction } from "discord.js";
import { automationService, CommandManager, createBotClient, createTicket, env, PrefixCommandManager, temporaryCallService, inviteTrackerService, formService } from "@neon/core";
import { panelCommand } from "./commands/panel.js";
import { ticketCommand } from "./commands/ticket.js";
import { economyCommands } from "./commands/economy.js";
import { automationCommands } from "./commands/automation.js";
import { formCommand } from "./commands/form.js";
import { createInfoHelpCommand } from "./prefix/help.js";
import { prefixTicketCommand } from "./prefix/ticket.js";

if (!env.DISCORD_INFO_TOKEN) throw new Error("DISCORD_INFO_TOKEN ausente");

const client = createBotClient("info-bot", { messageContent: true, guildMembers: true });

client.once(Events.ClientReady, async () => {
  for (const guild of client.guilds.cache.values()) {
    await inviteTrackerService.cacheInvites(guild);
  }
});

client.on(Events.GuildCreate, async (guild) => {
  await inviteTrackerService.cacheInvites(guild);
});

client.on(Events.GuildMemberAdd, async (member) => {
  const invite = await inviteTrackerService.findInviter(member.guild);
  if (invite) {
    console.log(`${member.user.tag} entrou usando o convite ${invite.code} de ${invite.inviter?.tag}`);
  }
  await automationService.handleMemberJoin(member);
});

client.on(Events.GuildMemberRemove, async (member) => {
  await automationService.handleMemberLeave(member as any);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  await temporaryCallService.handleVoiceStateUpdate(oldState, newState);
});

const commands = new CommandManager()
  .register(panelCommand)
  .register(ticketCommand)
  .register(economyCommands)
  .register(automationCommands)
  .register(formCommand);

const prefixCommands = new PrefixCommandManager(env.BOT_PREFIX).register(prefixTicketCommand);
prefixCommands.register(createInfoHelpCommand(prefixCommands));

commands.bind(client);
prefixCommands.bind(client);

client.on(Events.InteractionCreate, async (interaction: Interaction) => {
  if (interaction.isButton() && interaction.customId.startsWith("ticket:")) {
    const type = interaction.customId.replace("ticket:", "") as any;
    const ticket = await createTicket(interaction.guild!, interaction.member as any, type);
    await interaction.reply({ content: `Ticket criado: <#${ticket.channelId}>`, ephemeral: true });
  }
  
  if (interaction.isStringSelectMenu() && interaction.customId === "areas:select") {
    await interaction.reply({ content: `Area liberada: **${interaction.values[0]}**.`, ephemeral: true });
  }

  if (interaction instanceof ModalSubmitInteraction) {
    if (interaction.customId === "form:staff" && interaction.channelId) {
      await formService.handleFormSubmit(interaction, interaction.channelId);
    }
  }
});

await client.login(env.DISCORD_INFO_TOKEN);
