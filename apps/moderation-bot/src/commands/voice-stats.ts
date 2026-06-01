import { AttachmentBuilder, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { generateStatsCard, premiumEmbed } from "@neon/core";

export const voiceStatsCommand = {
  data: new SlashCommandBuilder()
    .setName("tempo")
    .setDescription("Mostra suas estatisticas de tempo em call.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply();
    const user = interaction.options.getUser("usuario") ?? interaction.user;
    const guild = await prisma.guild.upsert({
      where: { discordId: interaction.guild.id },
      update: { name: interaction.guild.name },
      create: { discordId: interaction.guild.id, name: interaction.guild.name, iconUrl: interaction.guild.iconURL() }
    });
    const dbUser = await prisma.user.upsert({
      where: { discordId: user.id },
      update: { username: user.username },
      create: { discordId: user.id, username: user.username, avatarUrl: user.displayAvatarURL() }
    });
    const stat = guild && dbUser
      ? await prisma.voiceStat.findFirst({ where: { guildId: guild.id, userId: dbUser.id }, orderBy: { updatedAt: "desc" } })
      : null;

    if (!stat) {
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Sem dados de call", description: "Ainda nao ha atividade registrada para este usuario." })] });
      return;
    }

    const buffer = await generateStatsCard({
      username: user.username,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
      totalSeconds: stat.totalSeconds,
      currentWeekSeconds: stat.weeklySeconds,
      previousWeekSeconds: 0,
      mutedSeconds: stat.mutedSeconds,
      badges: ["call", "meta", "premium"]
    });
    const attachment = new AttachmentBuilder(buffer, { name: "tempo.png" });
    await interaction.editReply({ files: [attachment] });
  }
};
