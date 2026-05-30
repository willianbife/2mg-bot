import { ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { APIMessageTopLevelComponent } from 'discord-api-types/v10';
import { theme2mg } from '../theme.js';
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
  options?: { theme?: string; maxRolesPerPage?: number; page?: number }
): Promise<{
  flags: MessageFlags.IsComponentsV2;
  components: APIMessageTopLevelComponent[];
  allowedMentions: { parse: [] };
}> {
  const validData = RoleManagementDataSchema.parse(data);
  const maxRolesPerPage = options?.maxRolesPerPage ?? 5;
  const maxPage = Math.max(Math.ceil(validData.roles.length / maxRolesPerPage) - 1, 0);
  const page = Math.min(Math.max(options?.page ?? 0, 0), maxPage);
  const visibleRoles = validData.roles.slice(page * maxRolesPerPage, page * maxRolesPerPage + maxRolesPerPage);

  const container = {
    type: 17,
    accent_color: theme2mg.primary,
    components: [
      {
        type: 10,
        content: [
          `## ${validData.title}`,
          `### | ${validData.guildName}`,
          '',
          `Ola, <@${validData.userId}>`,
          'Voce esta gerenciando seus proprios cargos',
          `Modo: ${validData.mode === 'cargos' ? 'Cargos gerenciaveis' : 'Permissoes'}`,
        ].join('\n'),
      },
      {
        type: 14,
        divider: true,
        spacing: 1,
      },
      ...visibleRoles.map((role) => {
        const userHasRole = validData.userRoles.includes(role.roleId);
        const permissionsText =
          role.permissions.length > 0
            ? role.permissions.slice(0, 2).join(', ')
            : 'Nenhuma permissao especial';
        const operation = userHasRole ? 'remove' : 'add';

        return {
          type: 9,
          components: [
            {
              type: 10,
              content: [
                `### <@&${role.roleId}>`,
                `${role.memberCount} membros`,
                `\`${permissionsText}\``,
              ].join('\n'),
            },
          ],
          accessory: {
            type: 2,
            custom_id: `role_${operation}:${validData.userId}:${role.roleId}:${page}`,
            label: userHasRole ? 'Remover' : 'Adicionar',
            style: userHasRole ? ButtonStyle.Danger : ButtonStyle.Primary,
            disabled: !validData.userCanManageRoles,
          },
        };
      }),
      ...(visibleRoles.length === 0
        ? [
            {
              type: 10,
              content: 'Nenhum cargo disponivel nesta categoria.',
            },
          ]
        : []),
      {
        type: 14,
        divider: true,
        spacing: 1,
      },
      {
        type: 1,
        components: [
          {
            type: 2,
            custom_id: `role_page:${validData.userId}:${Math.max(page - 1, 0)}`,
            label: '<',
            style: ButtonStyle.Secondary,
            disabled: page <= 0,
          },
          {
            type: 2,
            custom_id: `role_page:${validData.userId}:${page}`,
            label: `${page + 1}/${maxPage + 1}`,
            style: ButtonStyle.Secondary,
            disabled: true,
          },
          {
            type: 2,
            custom_id: `role_page:${validData.userId}:${Math.min(page + 1, maxPage)}`,
            label: '>',
            style: ButtonStyle.Secondary,
            disabled: page >= maxPage,
          },
        ],
      },
      {
        type: 1,
        components: [
          new ButtonBuilder()
            .setCustomId(`role_mode:${validData.userId}:manageable:0`)
            .setLabel('Cargos gerenciaveis')
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true)
            .toJSON(),
          new ButtonBuilder()
            .setCustomId(`role_mode:${validData.userId}:all:0`)
            .setLabel('Todos os cargos')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
            .toJSON(),
          new ButtonBuilder()
            .setCustomId(`role_mode:${validData.userId}:mine:0`)
            .setLabel('Meus cargos')
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
            .toJSON(),
        ],
      },
    ],
  };

  return {
    flags: MessageFlags.IsComponentsV2,
    components: [container as APIMessageTopLevelComponent],
    allowedMentions: { parse: [] },
  };
}
