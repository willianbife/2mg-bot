import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { extractDiscordId, notificationEmbed, requirePermission } from "@neon/core";

export const unbanCommand = {
  data: new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Remove banimento por ID ou nome/id.")
    .addStringOption((option) => option.setName("usuario").setDescription("ID ou nome/id").setRequired(true))
    .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true).setMinLength(8)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.ban");

    const targetInput = interaction.options.getString("usuario", true);
    const targetId = extractDiscordId(targetInput);
    const reason = interaction.options.getString("motivo", true);

    if (!targetId) {
      await interaction.editReply({ content: "Informe um ID ou texto no formato nome/id." });
      return;
    }

    await interaction.guild.members.unban(targetId, reason);
    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: "success",
          title: "Usuário Desbanido",
          message: `O banimento do usuário <@${targetId}> (\`${targetId}\`) foi removido.\n**Motivo:** ${reason}`
        })
      ]
    });
  }
};
