import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { roleManagementEmbedBuilder, getManageableRoles, type RoleManagementData } from "@neon/core";

export const grolesCommand = {
  data: new SlashCommandBuilder()
    .setName("groles")
    .setDescription("Gerencia seus cargos no servidor"),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    await interaction.deferReply({ ephemeral: true });

    const manageableRoles = await getManageableRoles(interaction.member);
    const userRoleIds = interaction.member.roles.cache.map(r => r.id);

    const roleData: RoleManagementData = {
      userId: interaction.user.id,
      guildId: interaction.guild.id,
      guildName: interaction.guild.name,
      serverName: interaction.guild.name,
      roles: manageableRoles.map(role => ({
        roleId: role.id,
        roleName: role.name,
        memberCount: role.members.size,
        permissions: role.permissions.toArray(),
        color: role.color,
      })),
      userRoles: userRoleIds,
      mode: 'cargos',
      title: 'Gerenciamento de Cargos',
      subtitle: `Servidor de ${interaction.user.username}`,
      userCanManageRoles: true,
    };

    const result = await roleManagementEmbedBuilder(roleData);
    await interaction.editReply(result);
  }
};
