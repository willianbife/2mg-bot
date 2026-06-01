import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { upsertDiscordUser, getCurrentTheme } from "@neon/core";

const pageSize = 8;

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

    const [entries, total] = await Promise.all([
      prisma.roleHistory.findMany({
        where: { guildId: guild.id, targetId: dbUser.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.roleHistory.count({ where: { guildId: guild.id, targetId: dbUser.id } })
    ]);

    await interaction.editReply({
      embeds: [
        buildRoleHistoryEmbed({
          userId: user.id,
          entries: entries.map(e => ({
            action: e.action,
            roleName: e.roleName,
            executorId: e.executorId,
            reason: e.reason,
            createdAt: e.createdAt
          })),
          total,
          page,
          pageSize
        })
      ]
    });
  }
};

type RoleHistoryEntry = {
  action: string;
  roleName: string;
  executorId: string;
  reason: string;
  createdAt: Date;
};

export function buildRoleHistoryEmbed(input: {
  userId: string;
  entries: RoleHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const maxPage = Math.max(Math.ceil(input.total / input.pageSize), 1);
  const { theme } = getCurrentTheme();

  const embed = new EmbedBuilder()
    .setColor(theme.colors.primary)
    .setTitle(`${theme.separators.main} Histórico de Cargos`)
    .setDescription(`${theme.separators.sub} **Usuário:** <@${input.userId}>`)
    .setFooter({ text: `2mg » Community Suite  •  Pág. ${input.page}/${maxPage}  •  Total: ${input.total}` })
    .setTimestamp();

  if (!input.entries.length) {
    embed.addFields({ name: "Sem registros", value: "Nenhuma alteração de cargo encontrada nesta página." });
    return embed;
  }

  for (const [i, entry] of input.entries.entries()) {
    const index = (input.page - 1) * input.pageSize + i + 1;
    const isAdd = entry.action.toLowerCase() === "add";
    const actionLabel = isAdd ? "▲ ADD" : "▼ REMOVE";
    const stamp = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:f>`;
    const relative = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`;

    embed.addFields({
      name: `${index}. ${actionLabel}  —  ${entry.roleName}`,
      value: [
        `${theme.separators.sub} Executor: <@${entry.executorId}>`,
        `${theme.separators.sub} Data: ${stamp} (${relative})`,
        `${theme.separators.sub} Motivo: ${entry.reason || "Não informado"}`,
      ].join("\n"),
      inline: false,
    });
  }

  return embed;
}

