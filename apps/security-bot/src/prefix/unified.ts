import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  GuildMember,
  Message,
  StringSelectMenuBuilder
} from "discord.js";
import { prisma } from "@neon/database";
import {
  createBlacklist,
  env,
  extractDiscordId,
  formatDuration,
  getUserTimeStats,
  getSecurityConfig,
  lockGuild,
  logCategories,
  panelEmbed,
  notificationEmbed,
  PrefixCommand,
  requirePermission,
  sendSecurityLog,
  timeStatsEmbedBuilder,
  unlockGuild,
  updateSecurityConfig,
  upsertDiscordUser,
  type TimeStatsData
} from "@neon/core";
import { buildRoleHistoryEmbed } from "../../../moderation-bot/src/commands/role-history.js";

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
  description: "Publica painéis informativos profissionais.",
  usage: usage("panel support"),

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "panels.manage");
    const type = (args[0] ?? "support") as any;

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:SUPPORT").setLabel("Suporte").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:ROLE_RETURN").setLabel("Devolução").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:MIGRATION").setLabel("Migração").setStyle(ButtonStyle.Secondary)
    );

    const areas = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("areas:select")
        .setPlaceholder("Selecione uma área")
        .addOptions(
          { label: "Suporte", value: "suporte" },
          { label: "Migração", value: "migracao" },
          { label: "Passatempo", value: "pastime" },
          { label: "Tellonym", value: "tellonym" }
        )
    );

    await message.reply({
      embeds: [
        panelEmbed({
          type: ["welcome", "links", "areas", "support", "migration"].includes(type) ? type : "support",
          title: `Painel: ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          description: "Central profissional da comunidade. Escolha uma opção abaixo para iniciar o fluxo correspondente."
        })
      ],
      components: type === "areas" ? [areas] : [buttons]
    });
  }
};

export const prefixRoleHistoryCommand: PrefixCommand = {
  name: "role-history",
  aliases: ["historico-cargos", "cargos-historico"],
  description: "Consulta histórico de cargos por prefixo.",
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
    const pageSize = 8;
    const [entries, total] = await Promise.all([
      prisma.roleHistory.findMany({
        where: { guildId: guild.id, targetId: dbUser.id },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      prisma.roleHistory.count({ where: { guildId: guild.id, targetId: dbUser.id } })
    ]);
        
    await message.reply({
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

export const prefixVoiceStatsCommand: PrefixCommand = {
  name: "tempo",
  aliases: ["voice-stats", "voicestats", "callstats"],
  description: "Mostra estatísticas de call.",
  usage: usage("tempo [@usuario]"),

  async execute(message: Message, args: string[]) {
    if (!message.guild) return;
    const targetId = extractDiscordId(args[0] ?? "") ?? message.author.id;
    const user = await message.client.users.fetch(targetId);
    const stats = await getUserTimeStats(message.guild.id, user.id);

    if (!stats) {
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "warning",
            title: "Sem Dados",
            message: "Ainda não há atividade de voz registrada para este usuário."
          })
        ]
      });
      return;
    }

    const timeStatsData: TimeStatsData = {
      userId: user.id,
      username: user.username,
      globalName: user.globalName || user.username,
      userTag: user.username,
      avatarURL: user.displayAvatarURL({ size: 256, extension: "png" }),
      rank: stats.rank,
      totalTime: formatDuration(stats.totalSeconds),
      currentWeek: {
        period: stats.currentWeek.key,
        accumulated: formatDuration(stats.currentWeek.total),
        callTime: formatDuration(stats.currentWeek.active),
        mutedTime: formatDuration(stats.currentWeek.muted)
      },
      previousWeek: {
        period: stats.previousWeek.key,
        callTime: formatDuration(stats.previousWeek.active),
        mutedTime: formatDuration(stats.previousWeek.muted)
      },
      serverName: message.guild.name,
      guildId: message.guild.id
    };

    await message.reply(await timeStatsEmbedBuilder(timeStatsData));
  }
};

export const prefixBlacklistCommand: PrefixCommand = {
  name: "blacklist",
  aliases: ["bl"],
  description: "Adiciona usuário a blacklist.",
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
    await message.reply({
      embeds: [
        notificationEmbed({
          type: "success",
          title: "Blacklist Registrada",
          message: `O usuário <@${targetId}> foi bloqueado.\n**Escopo:** ${global ? "Global" : "Local"}\n**Motivo:** ${reason}`
        })
      ]
    });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "info",
            title: "Status dos Logs",
            message: logCategories.map((item) => `**${item}:** ${config.logs.channels[item] ? `<#${config.logs.channels[item]}>` : "`Não configurado`"}`).join("\n")
          })
        ]
      });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Log Configurado",
            message: `Categoria: **${category}**\nCanal: <#${channelId}>`
          })
        ]
      });
      return;
    }

    if (sub === "testar" && category && logCategories.includes(category)) {
      await sendSecurityLog({
        guild: message.guild,
        category,
        actorId: message.author.id,
        actionTaken: "teste prefixo",
        embed: notificationEmbed({
          type: "success",
          title: "Teste de Log",
          message: `A categoria **${category}** está operando corretamente via prefixo.`
        })
      });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: enabled ? "success" : "warning",
            title: `Anti-raid ${enabled ? "Ativado" : "Desativado"}`,
            message: `O sistema de anti-raid foi ${enabled ? "habilitado" : "desabilitado"} com sucesso.`
          })
        ]
      });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Anti-raid Configurado",
            message: `Limite: **${antiRaid.joinLimit}/${antiRaid.joinWindowSeconds}s**\nConta nova: **${antiRaid.newAccountDays} dias**\nLockdown: **${antiRaid.lockdownOnRaid ? "Sim" : "Não"}**`
          })
        ]
      });
      return;
    }

    await message.reply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Status do Anti-raid",
          message: `Ativo: **${current.antiRaid.enabled ? "Sim" : "Não"}**\nLimite: **${current.antiRaid.joinLimit}/${current.antiRaid.joinWindowSeconds}s**\nConta nova: **${current.antiRaid.newAccountDays} dias**\nLockdown: **${current.antiRaid.lockdownOnRaid ? "Sim" : "Não"}**`
        })
      ]
    });
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
      
      const title = panic ? "Panic Acionado" : locked ? "Lockdown Ativado" : "Lockdown Removido";
      const type = locked ? "danger" : "success";

      await sendSecurityLog({
        guild: message.guild,
        category: "url",
        severity: panic ? "CRITICAL" : "HIGH",
        actorId: message.author.id,
        actionTaken: locked ? "lockdown" : "unlockdown",
        reason,
        embed: notificationEmbed({
          type,
          title,
          message: `Executor: ${message.author}\nMotivo: ${reason}`
        })
      });
      
      await message.reply({
        embeds: [
          notificationEmbed({
            type,
            title: locked ? "Servidor Bloqueado" : "Servidor Desbloqueado",
            message: `**Motivo:** ${reason}`
          })
        ]
      });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Domínio Bloqueado",
            message: `O domínio **${domain}** foi adicionado à lista negra.`
          })
        ]
      });
      return;
    }
    if (sub === "desbloquear" && domain) {
      const blockedDomains = config.antiUrl.blockedDomains.filter((item) => item !== domain);
      await updateSecurityConfig(message.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, message.author.id);
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "warning",
            title: "Domínio Desbloqueado",
            message: `O domínio **${domain}** foi removido da lista negra.`
          })
        ]
      });
      return;
    }
    await message.reply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Lista Anti-URL",
          message: `**Bloqueados:**\n${config.antiUrl.blockedDomains.map((item) => `- ${item}`).join("\n") || "`Vazio`"}\n\n**Permitidos:**\n${config.antiUrl.allowedDomains.map((item) => `- ${item}`).join("\n") || "`Vazio`"}`
        })
      ]
    });
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
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Whitelist Atualizada",
            message: `<@${targetId}> foi adicionado à whitelist de confiança.`
          })
        ]
      });
      return;
    }
    if (sub === "unwhitelist" && targetId) {
      await updateSecurityConfig(message.guild, { whitelistedUsers: config.whitelistedUsers.filter((id) => id !== targetId) }, message.author.id);
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "warning",
            title: "Whitelist Atualizada",
            message: `<@${targetId}> foi removido da whitelist.`
          })
        ]
      });
      return;
    }
    await message.reply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Status de Segurança",
          message: `Anti-raid: **${config.antiRaid.enabled ? "Ativo" : "Inativo"}**\nAnti-nuke: **${config.antiNuke.enabled ? "Ativo" : "Inativo"}**\nAnti-URL: **${config.antiUrl.enabled ? "Ativo" : "Inativo"}**\nLogs: **${config.logs.enabled ? "Ativo" : "Inativo"}**\nWhitelist: **${config.whitelistedUsers.length} usuário(s)**`
        })
      ]
    });
  }
};
