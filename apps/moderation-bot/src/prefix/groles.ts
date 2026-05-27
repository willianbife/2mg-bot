import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  EmbedBuilder,
  GuildMember,
  Message,
  Role
} from "discord.js";
import { applyRoleAction, assertRoleEditable, env, PrefixCommand, requirePermission, resolveMember, resolveRole } from "@neon/core";

const pageSize = 5;

type RolePanelMode = "manageable" | "all" | "mine";

export const prefixGrolesCommand: PrefixCommand = {
  name: "groles",
  aliases: ["role", "cargo"],
  description: "Abre painel visual de cargos ou gerencia cargo por texto.",
  usage: "2mg!groles | 2mg!groles add usuario/id cargo/id | 2mg!groles remove usuario/id cargo/id motivo",

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
    await interaction.deferReply({ ephemeral: true });
    const role = await interaction.guild.roles.fetch(roleId);
    if (!role) {
      await interaction.editReply("Cargo nao encontrado.");
      return;
    }

    const reason = operation === "add" ? `Cargo gerenciado pelo painel por ${interaction.user.tag}` : `Cargo removido pelo painel por ${interaction.user.tag}`;
    await assertRoleEditable(interaction.member, interaction.member, role);
    await applyRoleAction({ executor: interaction.member, target: interaction.member, roles: [role], action: operation, reason });

    await interaction.editReply({
      embeds: [
        buildRoleResultEmbed({
          guildName: interaction.guild.name,
          executor: interaction.member,
          target: interaction.member,
          role,
          action: operation,
          reason
        })
      ]
    });
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
    embeds: [buildRolePanelEmbed(member, visibleRoles, currentPage, maxPage, mode)],
    components: buildRolePanelComponents(member, visibleRoles, currentPage, maxPage, mode)
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
  if (mode === "manageable") return base.filter((role) => role.position < botHighest);
  return base;
}

function buildRolePanelEmbed(member: GuildMember, roles: Role[], page: number, maxPage: number, mode: RolePanelMode) {
  const guild = member.guild;
  const modeLabel = mode === "manageable" ? "Cargos gerenciaveis" : mode === "mine" ? "Meus cargos" : "Todos os cargos";
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`Gerenciamento de Cargos\n| ${guild.name}`)
    .setDescription([
      `Ola, ${member}`,
      "Voce esta gerenciando seus proprios cargos",
      `Modo: ${modeLabel}`,
      roles.length ? "" : "\nNenhum cargo encontrado nesta categoria."
    ].join("\n"))
    .setThumbnail(guild.iconURL({ size: 256 }) ?? member.displayAvatarURL({ size: 256 }))
    .setFooter({ text: `${page + 1}/${maxPage + 1} - ${env.BOT_PREFIX}groles add usuario/id cargo/id` });

  for (const [index, role] of roles.entries()) {
    const manageable = canBotManage(member, role);
    const hasRole = member.roles.cache.has(role.id);
    const permissionLabel = role.permissions.toArray().slice(0, 2).join(", ") || "Nenhuma permissao especial";
    const actionLabel = manageable ? (hasRole ? "Remover" : "Adicionar") : "Cargo acima do bot";

    embed.addFields(
      {
        name: `**${index + 1}. @${role.name}**`,
        value: [
          `${role.members.size} membros`,
          permissionLabel
        ].join("\n"),
        inline: true
      },
      {
        name: "\u200b",
        value: `\`${actionLabel}\``,
        inline: true
      },
      {
        name: "\u200b",
        value: "\u200b",
        inline: true
      }
    );
  }

  return embed;
}
function buildRolePanelComponents(member: GuildMember, roles: Role[], page: number, maxPage: number, mode: RolePanelMode) {
  const actionRow = new ActionRowBuilder<ButtonBuilder>();
  for (const role of roles) {
    const hasRole = member.roles.cache.has(role.id);
    actionRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`groles:${hasRole ? "remove" : "add"}:${mode}:${page}:${role.id}`)
        .setLabel(hasRole ? "Remover" : "Adicionar")
        .setStyle(hasRole ? ButtonStyle.Danger : ButtonStyle.Secondary)
        .setDisabled(!canBotManage(member, role))
    );
  }

  const pageRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`groles:page:${mode}:${Math.max(page - 1, 0)}:prev`)
      .setLabel("<")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 0),
    new ButtonBuilder()
      .setCustomId(`groles:page:${mode}:${page}:current`)
      .setLabel(`${page + 1}/${maxPage + 1}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`groles:page:${mode}:${Math.min(page + 1, maxPage)}:next`)
      .setLabel(">")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= maxPage)
  );

  const modeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId("groles:mode:manageable:0").setLabel("Cargos gerenciaveis").setStyle(mode === "manageable" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("groles:mode:all:0").setLabel("Todos os cargos").setStyle(mode === "all" ? ButtonStyle.Primary : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId("groles:mode:mine:0").setLabel("Meus cargos").setStyle(mode === "mine" ? ButtonStyle.Primary : ButtonStyle.Secondary)
  );

  return actionRow.components.length > 0 ? [actionRow, pageRow, modeRow] : [pageRow, modeRow];
}

function canBotManage(member: GuildMember, role: Role) {
  const botHighest = member.guild.members.me?.roles.highest.position ?? 0;
  return role.position < botHighest && !role.managed;
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
