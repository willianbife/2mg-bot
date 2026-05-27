import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { extractDiscordId, premiumEmbed, requirePermission } from "@neon/core";

export const banCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banimento seguro por mencao, ID ou nome/id.")
    .addStringOption((option) => option.setName("usuario").setDescription("Mencao, ID ou nome/id").setRequired(true))
    .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true).setMinLength(8))
    .addIntegerOption((option) => option.setName("dias_limpar").setDescription("Dias de mensagens para limpar").setMinValue(0).setMaxValue(7)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.ban");

    const targetInput = interaction.options.getString("usuario", true);
    const targetId = extractDiscordId(targetInput);
    const reason = interaction.options.getString("motivo", true);
    const deleteMessageSeconds = (interaction.options.getInteger("dias_limpar") ?? 0) * 86400;

    if (!targetId) {
      await interaction.editReply({ content: "Informe uma mencao, ID ou texto no formato nome/id." });
      return;
    }

    await interaction.guild.members.ban(targetId, { reason, deleteMessageSeconds });
    await interaction.editReply({
      embeds: [premiumEmbed({ title: "Usuario banido", variant: "danger", description: `Alvo: <@${targetId}> \`${targetId}\`\nMotivo: ${reason}` })]
    });
  }
};
