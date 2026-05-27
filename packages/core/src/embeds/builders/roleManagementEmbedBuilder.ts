import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { theme2mg, separators } from '../theme.js';
import { z } from 'zod';

const RoleOptionSchema = z.object({
  roleId: z.string(),
  roleName: z.string(),
  memberCount: z.number().min(0),
  permissions: z.array(z.string()).default([]),
  color: z.number().optional(),
});

const RoleManagementDataSchema = z.object({
  userId: z.string(),
  guildId: z.string(),
  guildName: z.string(),
  serverName: z.string(),
  roles: z.array(RoleOptionSchema),
  userRoles: z.array(z.string()),
  mode: z.enum(['cargos', 'permissoes']),
  title: z.string(),
  subtitle: z.string(),
  description: z.string().optional(),
  userCanManageRoles: z.boolean(),
});

export type RoleOption = z.infer<typeof RoleOptionSchema>;
export type RoleManagementData = z.infer<typeof RoleManagementDataSchema>;

export async function roleManagementEmbedBuilder(
  data: RoleManagementData,
  options?: { theme?: string; maxRolesPerPage?: number }
): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  // 1. Validar dados
  const validData = RoleManagementDataSchema.parse(data);

  // 2. Criar embed principal
  const embed = new EmbedBuilder()
    .setColor(theme2mg.primary)
    .setTitle(validData.title)
    .setDescription(
      `${separators.main} ${validData.subtitle}\n\n` +
      `Você está gerenciando seus próprios cargos\n` +
      `Modo: ${validData.mode === 'cargos' ? 'Cargos Gerenciáveis' : 'Permissões'}`
    );

  // 3. Adicionar campos para cada cargo
  validData.roles.forEach((role, index) => {
    const permissionsText =
      role.permissions.length > 0
        ? role.permissions.join(', ')
        : 'Nenhuma permissão especial';

    embed.addFields({
      name: `${index + 1}. @${role.roleName}`,
      value: `${role.memberCount} membros\n${permissionsText}`,
      inline: false,
    });
  });

  // 4. Adicionar instrução
  const instructionText = validData.roles.length > 0
    ? `1/${validData.roles.length} - ${validData.serverName}:roles add usuario/id cargo/id`
    : `${validData.serverName} - Nenhum cargo disponível`;

  embed
    .addFields({
      name: '\u200b',
      value: instructionText,
      inline: false,
    })
    .setFooter({ text: `${validData.serverName} » Community Suite` })
    .setTimestamp();

  // 5. Criar action rows com botões para cada cargo
  const components: ActionRowBuilder<ButtonBuilder>[] = [];

  validData.roles.forEach((role) => {
    const userHasRole = validData.userRoles.includes(role.roleId);

    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    // Botão Remover (aparece apenas se tem role)
    if (userHasRole && validData.userCanManageRoles) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_remove:${validData.userId}:${role.roleId}`)
          .setLabel('Remover')
          .setStyle(ButtonStyle.Danger)
      );
    }

    // Botão Adicionar (aparece apenas se não tem role)
    if (!userHasRole && validData.userCanManageRoles) {
      actionRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`role_add:${validData.userId}:${role.roleId}`)
          .setLabel('Adicionar')
          .setStyle(ButtonStyle.Primary)
      );
    }

    // Adicionar action row apenas se tem botões
    if (actionRow.components.length > 0) {
      components.push(actionRow);
    }
  });

  return {
    embeds: [embed],
    components,
  };
}
