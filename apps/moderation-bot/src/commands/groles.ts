import { ButtonInteraction, ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { applyRoleAction, getManageableRoles, roleManagementEmbedBuilder, type RoleManagementData } from "@neon/core";

export const grolesCommand = {
  data: new SlashCommandBuilder()
    .setName("groles")
    .setDescription("Gerencia seus cargos no servidor"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    await interaction.deferReply({ ephemeral: true });

    const result = await buildSelfRoleManagementPayload(interaction.member, 0);
    await interaction.editReply(result);
  }
};

export async function handleRoleManagementButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return false;

  const [action, userId, roleIdOrPage, rawPage] = interaction.customId.split(":");
  if (action !== "role_add" && action !== "role_remove" && action !== "role_page" && action !== "role_mode") return false;

  if (userId !== interaction.user.id) {
    await interaction.reply({
      content: "Voce nao pode gerenciar cargos de outro usuario.",
      ephemeral: true,
    });
    return true;
  }

  const page = Number(action === "role_page" || action === "role_mode" ? roleIdOrPage || 0 : rawPage || 0);

  if (action === "role_page" || action === "role_mode") {
    await interaction.update(await buildSelfRoleManagementPayload(interaction.member, page));
    return true;
  }

  await interaction.deferUpdate();

  const role = await interaction.guild.roles.fetch(roleIdOrPage);
  if (!role) {
    await interaction.followUp({ content: "Cargo nao encontrado.", ephemeral: true });
    return true;
  }

  const operation = action === "role_add" ? "add" : "remove";
  try {
    await applyRoleAction({
      executor: interaction.member,
      target: interaction.member,
      roles: [role],
      action: operation,
      reason: `Cargo ${operation === "add" ? "adicionado" : "removido"} pelo painel por ${interaction.user.tag}`
    });
  } catch (error: any) {
    await interaction.followUp({ content: `Erro: ${error.message || "Tente novamente mais tarde."}`, ephemeral: true });
    return true;
  }

  await interaction.editReply(await buildSelfRoleManagementPayload(interaction.member, page));
  return true;
}

async function buildSelfRoleManagementPayload(member: GuildMember, page: number) {
  const manageableRoles = await getManageableRoles(member);
  const sortedRoles = [...manageableRoles.values()].sort((a, b) => b.position - a.position);
  const userRoleIds = member.roles.cache.map((role) => role.id);

  const roleData: RoleManagementData = {
    userId: member.id,
    guildId: member.guild.id,
    guildName: member.guild.name,
    serverName: member.guild.name,
    roles: sortedRoles.map((role) => ({
      roleId: role.id,
      roleName: role.name,
      memberCount: role.members.size,
      permissions: role.permissions.toArray(),
      color: role.color,
    })),
    userRoles: userRoleIds,
    mode: "cargos",
    title: "Gerenciamento de Cargos",
    subtitle: `Servidor de ${member.user.username}`,
    userCanManageRoles: true,
  };

  return roleManagementEmbedBuilder(roleData, { page, maxRolesPerPage: 5 });
}
