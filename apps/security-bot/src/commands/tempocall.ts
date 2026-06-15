import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { formatDuration, getUserTimeStats, timeStatsEmbedBuilder, type TimeStatsData } from "@neon/core";

export const tempocallCommand = {
  data: new SlashCommandBuilder()
    .setName("tempocall")
    .setDescription("Visualiza estatisticas de tempo em call")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply();

    const targetUser = interaction.options.getUser("usuario") ?? interaction.user;
    const stats = await getUserTimeStats(interaction.guild.id, targetUser.id);

    if (!stats) {
      await interaction.editReply("Nao foram encontrados dados de voz para este usuario.");
      return;
    }

    const timeStatsData: TimeStatsData = {
      userId: targetUser.id,
      username: targetUser.username,
      globalName: targetUser.globalName || targetUser.username,
      userTag: targetUser.username,
      avatarURL: targetUser.displayAvatarURL({ size: 256, extension: "png" }),
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

    await interaction.editReply(await timeStatsEmbedBuilder(timeStatsData));
  }
};
