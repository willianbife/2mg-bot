import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  GuildMember,
  Message,
  StringSelectMenuBuilder
} from "discord.js";
import { prisma } from "@neon/database";
import {
  createBlacklist,
  env,
  extractDiscordId,
  generateStatsCard,
  getSecurityConfig,
  lockGuild,
  logCategories,
  premiumEmbed,
  PrefixCommand,
  requirePermission,
  sendSecurityLog,
  unlockGuild,
  updateSecurityConfig,
  upsertDiscordUser
} from "@neon/core";

function usage(command: string) {
  return `${env.BOT_PREFIX}${command}`;
}

function parseBoolean(value: string | undefined) {
  if (!value) return undefined;
  if (["true", "sim", "yes", "1", "on"].includes(value.toLowerCase())) return true;
  if (["false", "nao", "não", "no", "0", "off"].includes(value.toLowerCase())) return false;
  return undefined;
}

function readOption(args: string[], name: string) {
  const prefix = `${name}:`;
  const found = args.find((arg) => arg.toLowerCase().startsWith(prefix));
  return found?.slice(prefix.length);
}

export const prefixPanelCommand: PrefixCommand = {
  name: "panel",
  aliases: ["painel"],
  description: "Publica paineis informativos.",
  usage: usage("panel support"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "panels.manage");
    const type = args[0] ?? "support";

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:SUPPORT").setLabel("Suporte").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:ROLE_RETURN").setLabel("Devolucao").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:MIGRATION").setLabel("Migracao").setStyle(ButtonStyle.Secondary)
    );

    const areas = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("areas:select")
        .setPlaceholder("Selecione uma area")
        .addOptions(
          { label: "Suporte", value: "suporte" },
          { label: "Migracao", value: "migracao" },
          { label: "Pastime", value: "pastime" },
          { label: "Tellonym", value: "tellonym" }
        )
    );

    await message.reply({
      embeds: [premiumEmbed({ title: `Painel ${type}`, description: "Central premium da comunidade. Escolha uma opcao abaixo para iniciar o fluxo correto." })],
      components: type === "areas" ? [areas] : [buttons]
    });
  }
};

export const prefixRoleHistoryCommand: PrefixCommand = {
  name: "role-history",
  aliases: ["historico-cargos", "cargos-historico"],
  description: "Consulta historico de cargos por prefixo.",
  usage: usage("role-history @usuario [pagina]"),

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const targetId = extractDiscordId(args[0] ?? "");
    const page = Math.max(Number(args[1] ?? 1), 1);
    if (!targetId) {
      await message.reply(`Uso correto: \`${this.usage}\``);
      return;
    }

    const user = await message.client.users.fetch(targetId);
    const guild = await prisma.guild.upsert({
      where: { discordId: message.guild.id },
      update: { name: message.guild.name, iconUrl: message.guild.iconURL() },
      create: { discordId: message.guild.id, name: message.guild.name, iconUrl: message.guild.iconURL() }
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
        .map((entry, index) => `**${index + 1}. ${entry.action.toUpperCase()}** ${entry.roleName}\nExecutor: <@${entry.executorId}> - <t:${Math.floor(entry.createdAt.getTime() / 1000)}:f>\nMotivo: ${entry.reason}`)
        .join("\n\n") || "Sem registros nesta pagina.";
    await message.reply({ embeds: [premiumEmbed({ title: `Historico de ${user.username}`, description })] });
  }
};

export const prefixVoiceStatsCommand: PrefixCommand = {
  name: "voice-stats",
  aliases: ["voicestats", "callstats"],
  description: "Mostra estatisticas de call.",
  usage: usage("voice-stats [@usuario]"),

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const targetId = extractDiscordId(args[0] ?? "") ?? message.author.id;
    const user = await message.client.users.fetch(targetId);
    const guild = await prisma.guild.findUnique({ where: { discordId: message.guild.id } });
    const dbUser = await prisma.user.findUnique({ where: { discordId: user.id } });
    const stat = guild && dbUser ? await prisma.voiceStat.findFirst({ where: { guildId: guild.id, userId: dbUser.id }, orderBy: { updatedAt: "desc" } }) : null;

    if (!stat) {
      await message.reply({ embeds: [premiumEmbed({ title: "Sem dados de call", description: "Ainda nao ha atividade registrada para este usuario." })] });
      return;
    }

    const buffer = await generateStatsCard({
      username: user.username,
      avatarUrl: user.displayAvatarURL({ extension: "png", size: 256 }),
      totalSeconds: stat.totalSeconds,
      currentWeekSeconds: stat.weeklySeconds,
      previousWeekSeconds: 0,
      mutedSeconds: stat.mutedSeconds,
      badges: ["call", "meta", "premium"]
    });
    await message.reply({ files: [new AttachmentBuilder(buffer, { name: "voice-stats.png" })] });
  }
};

export const prefixBlacklistCommand: PrefixCommand = {
  name: "blacklist",
  aliases: ["bl"],
  description: "Adiciona usuario a blacklist.",
  usage: usage("blacklist add @usuario motivo"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.manage");
    const sub = args.shift()?.toLowerCase();
    const targetId = extractDiscordId(args.shift() ?? "");
    const global = args.includes("--global");
    const reason = args.filter((arg) => arg !== "--global").join(" ").trim();
    if (sub !== "add" || !targetId || reason.length < 8) {
      await message.reply(`Uso correto: \`${this.usage}\``);
      return;
    }
    await createBlacklist({ guild: message.guild, executor: message.member, targetId, reason, global });
    await message.reply({ embeds: [premiumEmbed({ title: "Blacklist registrada", variant: "danger", description: `Usuario: <@${targetId}>\nEscopo: **${global ? "global" : "local"}**\nMotivo: ${reason}` })] });
  }
};

export const prefixLogsCommand: PrefixCommand = {
  name: "logs",
  description: "Configura, testa e lista logs.",
  usage: usage("logs configurar mensagens #canal | logs status | logs testar mensagens"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.config");
    const sub = args.shift()?.toLowerCase();
    const category = args.shift() as (typeof logCategories)[number] | undefined;

    if (sub === "status") {
      const config = await getSecurityConfig(message.guild);
      await message.reply({ embeds: [premiumEmbed({ title: "Status dos logs", description: logCategories.map((item) => `**${item}:** ${config.logs.channels[item] ? `<#${config.logs.channels[item]}>` : "`nao configurado`"}`).join("\n") })] });
      return;
    }

    if ((sub === "configurar" || sub === "config") && category && logCategories.includes(category)) {
      const channelId = extractDiscordId(args[0] ?? "") ?? message.mentions.channels.first()?.id;
      if (!channelId) {
        await message.reply(`Uso correto: \`${this.usage}\``);
        return;
      }
      const current = await getSecurityConfig(message.guild);
      await updateSecurityConfig(message.guild, { logs: { ...current.logs, channels: { ...current.logs.channels, [category]: channelId } } }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Log configurado", variant: "success", description: `Categoria: **${category}**\nCanal: <#${channelId}>` })] });
      return;
    }

    if (sub === "testar" && category && logCategories.includes(category)) {
      await sendSecurityLog({ guild: message.guild, category, actorId: message.author.id, actionTaken: "teste prefixo", embed: premiumEmbed({ title: "Teste de log", variant: "success", description: `Categoria **${category}** funcionando via prefixo.` }) });
      await message.reply(`Teste enviado para **${category}**.`);
      return;
    }

    await message.reply(`Uso correto: \`${this.usage}\``);
  }
};

export const prefixAntiraidCommand: PrefixCommand = {
  name: "antiraid",
  description: "Configura anti-raid por prefixo.",
  usage: usage("antiraid status | ativar | desativar | configurar limite:8 janela:45 dias:7 lockdown:true"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.config");
    const sub = args.shift()?.toLowerCase();
    const current = await getSecurityConfig(message.guild);

    if (sub === "ativar" || sub === "desativar") {
      const enabled = sub === "ativar";
      await updateSecurityConfig(message.guild, { antiRaid: { ...current.antiRaid, enabled } }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: `Anti-raid ${enabled ? "ativado" : "desativado"}`, variant: enabled ? "success" : "warning" })] });
      return;
    }

    if (sub === "configurar" || sub === "config") {
      const roleId = extractDiscordId(readOption(args, "cargo") ?? "") ?? current.antiRaid.quarantineRoleId;
      const channelId = extractDiscordId(readOption(args, "staff") ?? "") ?? current.antiRaid.staffChannelId;
      const antiRaid = {
        ...current.antiRaid,
        joinLimit: Number(readOption(args, "limite") ?? current.antiRaid.joinLimit),
        joinWindowSeconds: Number(readOption(args, "janela") ?? current.antiRaid.joinWindowSeconds),
        newAccountDays: Number(readOption(args, "dias") ?? current.antiRaid.newAccountDays),
        quarantineRoleId: roleId,
        staffChannelId: channelId,
        lockdownOnRaid: parseBoolean(readOption(args, "lockdown")) ?? current.antiRaid.lockdownOnRaid
      };
      await updateSecurityConfig(message.guild, { antiRaid }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Anti-raid configurado", variant: "success", description: `Limite: **${antiRaid.joinLimit}/${antiRaid.joinWindowSeconds}s**\nConta nova: **${antiRaid.newAccountDays} dias**\nLockdown: **${antiRaid.lockdownOnRaid ? "sim" : "nao"}**` })] });
      return;
    }

    await message.reply({ embeds: [premiumEmbed({ title: "Status do anti-raid", description: `Ativo: **${current.antiRaid.enabled ? "sim" : "nao"}**\nLimite: **${current.antiRaid.joinLimit}/${current.antiRaid.joinWindowSeconds}s**\nConta nova: **${current.antiRaid.newAccountDays} dias**\nLockdown: **${current.antiRaid.lockdownOnRaid ? "sim" : "nao"}**` })] });
  }
};

function makeLockCommand(name: string, locked: boolean, panic = false): PrefixCommand {
  return {
    name,
    description: locked ? "Ativa lockdown por prefixo." : "Remove lockdown por prefixo.",
    usage: usage(`${name} [motivo]`),
    async execute(message: Message, args: string[]) {
      if (!message.guild || !(message.member instanceof GuildMember)) return;
      await requirePermission(message.member, "security.lockdown");
      const reason = args.join(" ").trim() || (panic ? "Panic acionado" : locked ? "Lockdown manual" : "Unlockdown manual");
      if (locked) await lockGuild(message.guild, reason);
      else await unlockGuild(message.guild, reason);
      await sendSecurityLog({ guild: message.guild, category: "url", severity: panic ? "CRITICAL" : "HIGH", actorId: message.author.id, actionTaken: locked ? "lockdown" : "unlockdown", reason, embed: premiumEmbed({ title: panic ? "Panic acionado" : locked ? "Lockdown ativado" : "Lockdown removido", variant: locked ? "danger" : "success", description: `Executor: ${message.author}\nMotivo: ${reason}` }) });
      await message.reply({ embeds: [premiumEmbed({ title: locked ? "Servidor bloqueado" : "Servidor desbloqueado", variant: locked ? "danger" : "success", description: `Motivo: ${reason}` })] });
    }
  };
}

export const prefixLockdownCommand = makeLockCommand("lockdown", true);
export const prefixUnlockdownCommand = makeLockCommand("unlockdown", false);
export const prefixPanicCommand = makeLockCommand("panic", true, true);

export const prefixUrlCommand: PrefixCommand = {
  name: "url",
  description: "Gerencia anti URL por prefixo.",
  usage: usage("url bloquear dominio.com | desbloquear dominio.com | lista"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.config");
    const sub = args.shift()?.toLowerCase();
    const domain = args.shift()?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const config = await getSecurityConfig(message.guild);

    if (sub === "bloquear" && domain) {
      const blockedDomains = [...new Set([...config.antiUrl.blockedDomains, domain])];
      await updateSecurityConfig(message.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Dominio bloqueado", variant: "success", description: `Dominio: **${domain}**` })] });
      return;
    }
    if (sub === "desbloquear" && domain) {
      const blockedDomains = config.antiUrl.blockedDomains.filter((item) => item !== domain);
      await updateSecurityConfig(message.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Dominio desbloqueado", variant: "warning", description: `Dominio: **${domain}**` })] });
      return;
    }
    await message.reply({ embeds: [premiumEmbed({ title: "Lista anti URL", description: `Bloqueados:\n${config.antiUrl.blockedDomains.map((item) => `- ${item}`).join("\n") || "`vazio`"}\n\nPermitidos:\n${config.antiUrl.allowedDomains.map((item) => `- ${item}`).join("\n") || "`vazio`"}` })] });
  }
};

export const prefixSecurityCommand: PrefixCommand = {
  name: "security",
  aliases: ["seguranca"],
  description: "Status e whitelist de seguranca.",
  usage: usage("security status | whitelist @usuario | unwhitelist @usuario"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.config");
    const sub = args.shift()?.toLowerCase() ?? "status";
    const targetId = extractDiscordId(args[0] ?? "");
    const config = await getSecurityConfig(message.guild);

    if (sub === "whitelist" && targetId) {
      await updateSecurityConfig(message.guild, { whitelistedUsers: [...new Set([...config.whitelistedUsers, targetId])] }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Whitelist atualizada", variant: "success", description: `<@${targetId}> foi adicionado a whitelist.` })] });
      return;
    }
    if (sub === "unwhitelist" && targetId) {
      await updateSecurityConfig(message.guild, { whitelistedUsers: config.whitelistedUsers.filter((id) => id !== targetId) }, message.author.id);
      await message.reply({ embeds: [premiumEmbed({ title: "Whitelist atualizada", variant: "warning", description: `<@${targetId}> foi removido da whitelist.` })] });
      return;
    }
    await message.reply({ embeds: [premiumEmbed({ title: "Status de seguranca", description: `Anti-raid: **${config.antiRaid.enabled ? "ativo" : "inativo"}**\nAnti-nuke: **${config.antiNuke.enabled ? "ativo" : "inativo"}**\nAnti URL: **${config.antiUrl.enabled ? "ativo" : "inativo"}**\nLogs: **${config.logs.enabled ? "ativo" : "inativo"}**\nWhitelist: **${config.whitelistedUsers.length} usuario(s)**` })] });
  }
};
