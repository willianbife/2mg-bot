import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { upsertDiscordUser } from "@neon/core";

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
          entries,
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
  const lines = input.entries.length
    ? input.entries.map((entry, index) => formatEntry(entry, (input.page - 1) * input.pageSize + index + 1)).join("\n\n")
    : "Nenhum registro encontrado nesta pagina.";

  return new EmbedBuilder()
    .setColor(0x2f80ed)
    .setTitle("Historico de Cargos")
    .setDescription([
      `Usuario: <@${input.userId}>`,
      "",
      lines
    ].join("\n"))
    .addFields(
      { name: "Total", value: String(input.total), inline: true },
      { name: "Pagina", value: `${input.page}/${maxPage}`, inline: true },
      { name: "Nesta pagina", value: String(input.entries.length), inline: true }
    )
    .setFooter({ text: "2mg Community Suite" })
    .setTimestamp();
}

function formatEntry(entry: RoleHistoryEntry, index: number) {
  const action = entry.action.toUpperCase();
  const stamp = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:f>`;
  const relative = `<t:${Math.floor(entry.createdAt.getTime() / 1000)}:R>`;

  return [
    `**${index}. ${action}** - ${entry.roleName}`,
    `Executor: <@${entry.executorId}>`,
    `Data: ${stamp} (${relative})`,
    `Motivo: ${entry.reason || "Nao informado"}`
  ].join("\n");
}
