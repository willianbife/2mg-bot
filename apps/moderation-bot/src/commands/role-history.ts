import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { premiumEmbed, upsertDiscordUser } from "@neon/core";

export const roleHistoryCommand = {
  data: new SlashCommandBuilder()
    .setName("role-history")
    .setDescription("Consulta o historico completo de cargos de um usuario.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(true))
    .addIntegerOption((option) => option.setName("pagina").setDescription("Pagina").setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("usuario", true);
    const page = interaction.options.getInteger("pagina") ?? 1;

    const guild = await prisma.guild.upsert({
      where: { discordId: interaction.guild.id },
      update: { name: interaction.guild.name, iconUrl: interaction.guild.iconURL() },
      create: { discordId: interaction.guild.id, name: interaction.guild.name, iconUrl: interaction.guild.iconURL() }
    });
    const dbUser = await upsertDiscordUser(user);

    const entries = await prisma.roleHistory.findMany({
      where: { guildId: guild.id, targetId: dbUser.id },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * 8,
      take: 8
    });

    const description =
      entries
        .map((entry, index) => {
          const stamp = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:f>`;
          return `**${index + 1}. ${entry.action.toUpperCase()}** ${entry.roleName}\nExecutor: <@${entry.executorId}> • ${stamp}\nMotivo: ${entry.reason}`;
        })
        .join("\n\n") || "Sem registros nesta pagina.";

    await interaction.editReply({
      embeds: [premiumEmbed({ title: `Historico de ${user.username}`, description })]
    });
  }
};
