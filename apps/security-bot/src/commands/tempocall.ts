import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { timeStatsEmbedBuilder, getUserTimeStats, formatDuration, type TimeStatsData } from "@neon/core";

export const tempocallCommand = {
  data: new SlashCommandBuilder()
    .setName("tempocall")
    .setDescription("Visualiza suas estatísticas de tempo em call"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply();

    const targetUser = interaction.user;
    const stats = await getUserTimeStats(interaction.guild.id, targetUser.id);

    if (!stats) {
      await interaction.editReply("Não foram encontrados dados de voz para este usuário.");
      return;
    }

    const timeStatsData: TimeStatsData = {
      userId: targetUser.id,
      username: targetUser.username,
      globalName: targetUser.globalName || targetUser.username,
      userTag: `${targetUser.username}`,
      avatarURL: targetUser.displayAvatarURL({ size: 128, extension: 'png' }),
      rank: stats.rank,
      totalTime: formatDuration(stats.totalSeconds),
      currentWeek: {
        period: stats.currentWeek.key,
        accumulated: formatDuration(stats.currentWeek.total),
        callTime: formatDuration(stats.currentWeek.active),
        mutedTime: formatDuration(stats.currentWeek.muted),
      },
      previousWeek: {
        period: stats.previousWeek.key,
        callTime: formatDuration(stats.previousWeek.active),
        mutedTime: formatDuration(stats.previousWeek.muted),
      },
      serverName: interaction.guild.name,
      guildId: interaction.guild.id,
    };

    const result = await timeStatsEmbedBuilder(timeStatsData);
    await interaction.editReply(result);
  }
};
