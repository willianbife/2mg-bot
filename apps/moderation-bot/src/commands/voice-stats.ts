import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import {
  formatDuration,
  getUserTimeStats,
  premiumEmbed,
  timeStatsEmbedBuilder,
  type TimeStatsData
} from "@neon/core";

export const voiceStatsCommand = {
  data: new SlashCommandBuilder()
    .setName("tempo")
    .setDescription("Mostra suas estatisticas de tempo em call.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply();
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const stats = await getUserTimeStats(interaction.guild.id, user.id);

    if (!stats) {
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Sem dados de call", description: "Ainda nao ha atividade registrada para este usuario." })] });
      return;
    }

    const data: TimeStatsData = {
      userId: user.id,
      username: user.username,
      globalName: user.globalName || user.username,
      userTag: user.username,
      avatarURL: user.displayAvatarURL({ size: 256, extension: "png" }),
      rank: stats.rank,
      totalTime: formatDuration(stats.totalSeconds),
      currentWeek: {
        period: stats.currentWeek.key,
        accumulated: formatDuration(stats.currentWeek.total),
        callTime: formatDuration(stats.currentWeek.active),
        mutedTime: formatDuration(stats.currentWeek.muted)
      },
      previousWeek: {
        period: stats.previousWeek.key,
        callTime: formatDuration(stats.previousWeek.active),
        mutedTime: formatDuration(stats.previousWeek.muted)
      },
      serverName: interaction.guild.name,
      guildId: interaction.guild.id
    };

    await interaction.editReply(await timeStatsEmbedBuilder(data));
  }
};
