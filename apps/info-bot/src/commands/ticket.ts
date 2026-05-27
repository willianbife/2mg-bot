import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { createTicket, TicketType } from "@neon/core";

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Abre tickets profissionais por categoria.")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Categoria")
        .setRequired(true)
        .addChoices(
          { name: "Suporte", value: "SUPPORT" },
          { name: "Denuncia", value: "REPORT" },
          { name: "Devolucao de cargo", value: "ROLE_RETURN" },
          { name: "Transferencia de conta", value: "ACCOUNT_TRANSFER" },
          { name: "Migracao", value: "MIGRATION" },
          { name: "Ingressar", value: "JOIN_COMMUNITY" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    const type = interaction.options.getString("tipo", true) as TicketType;
    const ticket = await createTicket(interaction.guild, interaction.member, type);
    await interaction.editReply({ content: `Ticket criado com sucesso: <#${ticket.channelId}>` });
  }
};
