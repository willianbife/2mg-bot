import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { createBlacklist, extractDiscordId, notificationEmbed, requirePermission } from "@neon/core";

export const blacklistCommand = {
  data: new SlashCommandBuilder()
    .setName("blacklist")
    .setDescription("Gerencia blacklist local/global com provas e auditoria.")
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Adicionar usuário a blacklist.")
        .addStringOption((option) => option.setName("usuario").setDescription("Menção, ID ou nome/id").setRequired(true))
        .addStringOption((option) => option.setName("motivo").setDescription("Motivo").setRequired(true).setMinLength(8))
        .addBooleanOption((option) => option.setName("global").setDescription("Aplicar globalmente"))
        .addStringOption((option) => option.setName("provas").setDescription("Links de provas separados por espaço"))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.manage");
    const targetId = extractDiscordId(interaction.options.getString("usuario", true));
    const reason = interaction.options.getString("motivo", true);
    const global = interaction.options.getBoolean("global") ?? false;
    const proofUrls = interaction.options.getString("provas")?.split(/\s+/).filter(Boolean) ?? [];

    if (!targetId) {
      await interaction.editReply({ content: "Informe uma menção, ID ou texto no formato nome/id." });
      return;
    }

    await createBlacklist({ guild: interaction.guild, executor: interaction.member, targetId, reason, global, proofUrls });
    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: "success",
          title: "Blacklist Registrada",
          message: `O usuário <@${targetId}> foi adicionado à lista de bloqueio.\n**Escopo:** ${global ? "Global" : "Local"}\n**Motivo:** ${reason}`
        })
      ]
    });
  }
};
