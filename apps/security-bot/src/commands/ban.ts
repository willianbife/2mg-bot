import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { extractDiscordId, notificationEmbed, requirePermission } from "@neon/core";

export const banCommand = {
  data: new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Banimento seguro por menção, ID ou nome/id.")
    .addStringOption((option) => option.setName("usuario").setDescription("Menção, ID ou nome/id").setRequired(true))
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
      await interaction.editReply({ content: "Informe uma menção, ID ou texto no formato nome/id." });
      return;
    }

    try {
      await interaction.guild.members.ban(targetId, { reason, deleteMessageSeconds });
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Usuário Banido",
            message: `O usuário <@${targetId}> (\`${targetId}\`) foi banido com sucesso.\n**Motivo:** ${reason}`
          })
        ]
      });
    } catch (err: any) {
      const msg = err?.code === 50013
        ? "Sem permissão para banir este usuário."
        : err?.code === 10013
        ? "Usuário não encontrado."
        : `Falha ao executar ban: ${err?.message ?? "erro desconhecido"}`;

      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "danger",
            title: "Erro ao banir",
            message: msg
          })
        ]
      });
    }
  }
};
