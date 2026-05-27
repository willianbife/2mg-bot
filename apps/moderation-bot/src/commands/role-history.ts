import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { statsEmbed, upsertDiscordUser, getCurrentTheme } from "@neon/core";

export const roleHistoryCommand = {
  data: new SlashCommandBuilder()
    .setName("role-history")
    .setDescription("Consulta o histórico completo de cargos de um usuário.")
    .addUserOption((option) => option.setName("usuario").setDescription("Usuário").setRequired(true))
    .addIntegerOption((option) => option.setName("pagina").setDescription("Página").setMinValue(1)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild) return;
    await interaction.deferReply({ ephemeral: true });

    const user = interaction.options.getUser("usuario", true);
    const page = interaction.options.getInteger("pagina") ?? 1;
    const { theme } = getCurrentTheme();

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
          return `${theme.separators.bullet} **${entry.action.toUpperCase()}:** ${entry.roleName}\n${theme.separators.sub} Executor: <@${entry.executorId}>\n${theme.separators.sub} Data: ${stamp}\n${theme.separators.sub} Motivo: ${entry.reason}`;
        })
        .join("\n\n") || "Sem registros nesta página.";

    await interaction.editReply({
      embeds: [
        statsEmbed({
          type: "role_history",
          userId: user.id,
          data: {
            "Total de Registros": entries.length,
            "Página": page
          }
        }).setDescription(`\n${description}`)
      ]
    });
  }
};
