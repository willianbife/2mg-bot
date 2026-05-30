import {
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  MessageFlags,
  Message,
  Role
} from "discord.js";
import type { APIMessageTopLevelComponent } from "discord-api-types/v10";
import { applyRoleAction, assertRoleEditable, env, PrefixCommand, requirePermission, resolveMember, resolveRole } from "@neon/core";

const pageSize = 5;

type RolePanelMode = "manageable" | "all" | "mine";

export const prefixGrolesCommand: PrefixCommand = {
  name: "groles",
  aliases: ["role", "cargo"],
  description: "Abre painel visual de cargos ou gerencia cargo por texto.",
  usage: `${env.BOT_PREFIX}groles | ${env.BOT_PREFIX}groles add usuario/id cargo/id | ${env.BOT_PREFIX}groles remove usuario/id cargo/id motivo`,

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;

    const action = args[0]?.toLowerCase();
    if (!action || (action !== "add" && action !== "remove")) {
      await sendRolePanel(message, message.member, 0, "manageable");
      return;
    }

    await requirePermission(message.member, "roles.manage");
    args.shift();
    const targetInput = args.shift();
    const roleInput = args.shift();
    const reason = args.join(" ").trim();

    if (!targetInput || !roleInput) {
      await sendRolePanel(message, message.member, 0, "manageable");
      return;
    }
    if (action === "remove" && reason.length < 8) {
      await message.reply("Para remover cargo, informe um motivo com pelo menos 8 caracteres.");
      return;
    }

    const target = await resolveMember(message.guild, targetInput);
    const role = await resolveRole(message.guild, roleInput);
    const auditReason = action === "add" ? `Cargo adicionado por ${message.author.tag}` : reason;

    await applyRoleAction({ executor: message.member, target, roles: [role], action, reason: auditReason });
    await message.reply({
      embeds: [
        buildRoleResultEmbed({
          guildName: message.guild.name,
          executor: message.member,
          target,
          role,
          action,
          reason: auditReason
        })
      ]
    });
  }
};

export async function handleGrolesButton(interaction: ButtonInteraction) {
  if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
  if (!interaction.customId.startsWith("groles:")) return;

  const [, operation, rawMode, rawPage, roleId] = interaction.customId.split(":");
  const mode = (rawMode as RolePanelMode) || "manageable";
  const page = Number(rawPage || 0);

  if (operation === "page" || operation === "mode") {
    await interaction.update(buildRolePanelPayload(interaction.member, page, mode));
    return;
  }

  if (operation === "add" || operation === "remove") {
    await interaction.deferUpdate();
    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
      await interaction.followUp({ content: "Cargo nao encontrado.", ephemeral: true });
      return;
    }

    const reason = operation === "add" ? `Cargo gerenciado pelo painel por ${interaction.user.tag}` : `Cargo removido pelo painel por ${interaction.user.tag}`;
    try {
      await assertRoleEditable(interaction.member, interaction.member, role);
      await applyRoleAction({ executor: interaction.member, target: interaction.member, roles: [role], action: operation, reason });
    } catch (error: any) {
      await interaction.followUp({ content: `Erro: ${error.message || "Tente novamente mais tarde."}`, ephemeral: true });
      return;
    }

    await interaction.editReply(buildRolePanelPayload(interaction.member, page, mode));
  }
}

async function sendRolePanel(message: Message, member: GuildMember, page: number, mode: RolePanelMode) {
  await message.reply(buildRolePanelPayload(member, page, mode));
}

function buildRolePanelPayload(member: GuildMember, page: number, mode: RolePanelMode) {
  const roles = getPanelRoles(member, mode);
  const maxPage = Math.max(Math.ceil(roles.length / pageSize) - 1, 0);
  const currentPage = Math.min(Math.max(page, 0), maxPage);
  const visibleRoles = roles.slice(currentPage * pageSize, currentPage * pageSize + pageSize);

  return {
    flags: MessageFlags.IsComponentsV2 as const,
    components: buildRolePanelComponents(member, visibleRoles, currentPage, maxPage, mode),
    allowedMentions: { parse: [] as [] }
  };
}

function getPanelRoles(member: GuildMember, mode: RolePanelMode) {
  const botHighest = member.guild.members.me?.roles.highest.position ?? 0;
  const base = [...member.guild.roles.cache
    .filter((role) => role.id !== member.guild.id)
    .filter((role) => !role.managed)
    .sort((a, b) => b.position - a.position)
    .values()];

  if (mode === "mine") return base.filter((role) => member.roles.cache.has(role.id));
  if (mode === "manageable") {
    return base.filter((role) => role.position < botHighest && canMemberUsePanelRole(member, role));
  }
  return base;
}

function buildRolePanelComponents(member: GuildMember, roles: Role[], page: number, maxPage: number, mode: RolePanelMode): APIMessageTopLevelComponent[] {
  const guild = member.guild;
  const modeLabel = mode === "manageable" ? "Cargos gerenciaveis" : mode === "mine" ? "Meus cargos" : "Todos os cargos";

  const container = {
    type: 17,
    accent_color: 0x5865f2,
    components: [
        {
          type: 10,
          content: [
            "## Gerenciamento de Cargos",
            `### | ${guild.name}`,
            "",
            `Ola, ${member}`,
            "Voce esta gerenciando seus proprios cargos",
            `Modo: ${modeLabel}`,
          ].join("\n"),
        },
        {
          type: 14,
          divider: true,
          spacing: 1,
        },
        ...roles.map((role) => {
          const manageable = canManagePanelRole(member, role);
          const hasRole = member.roles.cache.has(role.id);
          const permissionLabel = role.permissions.toArray().slice(0, 2).join(", ") || "Nenhuma permissao especial";
          const disabledLabel = role.position >= (member.guild.members.me?.roles.highest.position ?? 0)
            ? "Cargo acima do bot"
            : "Sem permissao";

          return {
            type: 9,
            components: [
              {
                type: 10,
                content: [
                  `### ${role}`,
                  `${role.members.size} membros`,
                  `\`${permissionLabel}\``,
                ].join("\n"),
              },
            ],
            accessory: {
              type: 2,
              custom_id: `groles:${hasRole ? "remove" : "add"}:${mode}:${page}:${role.id}`,
              label: manageable ? (hasRole ? "Remover" : "Adicionar") : disabledLabel,
              style: hasRole ? ButtonStyle.Danger : ButtonStyle.Primary,
              disabled: !manageable,
            },
          };
        }),
        ...(roles.length === 0
          ? [
              {
                type: 10,
                content: "Nenhum cargo encontrado nesta categoria.",
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
            new ButtonBuilder()
              .setCustomId(`groles:page:${mode}:${Math.max(page - 1, 0)}:prev`)
              .setLabel("<")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page <= 0)
              .toJSON(),
            new ButtonBuilder()
              .setCustomId(`groles:page:${mode}:${page}:current`)
              .setLabel(`${page + 1}/${maxPage + 1}`)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
              .toJSON(),
            new ButtonBuilder()
              .setCustomId(`groles:page:${mode}:${Math.min(page + 1, maxPage)}:next`)
              .setLabel(">")
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(page >= maxPage)
              .toJSON(),
          ],
        },
        {
          type: 1,
          components: [
            new ButtonBuilder().setCustomId("groles:mode:manageable:0").setLabel("Cargos gerenciaveis").setStyle(mode === "manageable" ? ButtonStyle.Primary : ButtonStyle.Secondary).toJSON(),
            new ButtonBuilder().setCustomId("groles:mode:all:0").setLabel("Todos os cargos").setStyle(mode === "all" ? ButtonStyle.Primary : ButtonStyle.Secondary).toJSON(),
            new ButtonBuilder().setCustomId("groles:mode:mine:0").setLabel("Meus cargos").setStyle(mode === "mine" ? ButtonStyle.Primary : ButtonStyle.Secondary).toJSON()
          ],
        },
    ],
  };

  return [container as APIMessageTopLevelComponent];
}

function canBotManage(member: GuildMember, role: Role) {
  const botHighest = member.guild.members.me?.roles.highest.position ?? 0;
  return role.position < botHighest && !role.managed;
}

function canMemberUsePanelRole(member: GuildMember, role: Role) {
  return member.guild.ownerId === member.id || role.position < member.roles.highest.position;
}

function canManagePanelRole(member: GuildMember, role: Role) {
  return canBotManage(member, role) && canMemberUsePanelRole(member, role);
}

function buildRoleResultEmbed(input: {
  guildName: string;
  executor: GuildMember;
  target: GuildMember;
  role: Role;
  action: "add" | "remove";
  reason: string;
}) {
  return new EmbedBuilder()
    .setColor(input.action === "add" ? 0x34f5c5 : 0xffc857)
    .setTitle(`Gerenciamento de Cargos\n| ${input.guildName}`)
    .setDescription([
      `Ola, ${input.executor}`,
      `Voce esta gerenciando cargos em **${input.guildName}**`,
      "",
      `**Usuario:** ${input.target} \`${input.target.id}\``,
      `**Cargo:** ${input.role}`,
      `**Acao:** ${input.action === "add" ? "Adicionar" : "Remover"}`,
      `**Membros com o cargo:** ${input.role.members.size}`,
      `**Motivo:** ${input.reason}`
    ].join("\n"))
    .setThumbnail(input.executor.guild.iconURL({ size: 256 }) ?? input.target.displayAvatarURL({ size: 256 }));
}
