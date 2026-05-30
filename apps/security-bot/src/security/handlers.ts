import {
  AuditLogEvent,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  Guild,
  GuildBan,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  Role,
  VoiceState
} from "discord.js";
import {
  auditEmbed,
  bumpWindowCounter,
  childLogger,
  detectMessageAbuse,
  domainFromUrl,
  extractUrls,
  getSecurityConfig,
  isSecurityBypassed,
  lockGuild,
  notificationEmbed,
  punishNukeExecutor,
  sendSecurityLog,
  truncate
} from "@neon/core";

const log = childLogger("security-handlers");
const voiceSessions = new Map<string, number>();
const logPalette = {
  danger: 0xff1f2d,
  warning: 0xffb84d,
  info: 0x5865f2,
  success: 0x22c55e,
  neutral: 0x2b2d35
};

function memberAgeDays(member: GuildMember) {
  return Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);
}

function suspiciousMember(member: GuildMember, newAccountDays: number) {
  const reasons: string[] = [];
  if (memberAgeDays(member) < newAccountDays) reasons.push("conta nova");
  if (!member.user.avatar) reasons.push("sem avatar");
  if (member.user.bot) reasons.push("bot");
  return reasons;
}

async function latestExecutor(guild: Guild, type: AuditLogEvent, targetId?: string) {
  const entries = await guild.fetchAuditLogs({ type, limit: 5 }).catch(() => null);
  const now = Date.now();
  return entries?.entries.find((entry) => {
    const close = now - entry.createdTimestamp < 7000;
    const sameTarget = targetId ? (entry.target as any)?.id === targetId : true;
    return close && sameTarget;
  });
}

function tagLine(value: string | null | undefined) {
  return `\`${truncate(value || "indisponivel", 80)}\``;
}

function codeBlock(value: string | null | undefined, max = 900) {
  const clean = truncate(value || "sem conteudo", max).replace(/```/g, "`\u200b``");
  return `\`\`\`\n${clean}\n\`\`\``;
}

function compactLogEmbed(input: {
  title: string;
  color: number;
  description: string;
  thumbnailUrl?: string | null;
}) {
  const embed = new EmbedBuilder()
    .setColor(input.color)
    .setTitle(input.title)
    .setDescription(input.description)
    .setTimestamp(new Date());

  if (input.thumbnailUrl) embed.setThumbnail(input.thumbnailUrl);
  return embed;
}

function moderationLogEmbed(input: {
  title: string;
  target: { mention: string; tag?: string | null; id: string; avatarUrl?: string | null };
  moderator?: { mention: string; tag?: string | null; id?: string | null };
  reason?: string | null;
  extra?: string[];
  color?: number;
}) {
  return compactLogEmbed({
    title: input.title,
    color: input.color ?? logPalette.danger,
    thumbnailUrl: input.target.avatarUrl,
    description: [
      `**Usuario:** ${input.target.mention}`,
      input.target.tag ? tagLine(input.target.tag) : null,
      tagLine(input.target.id),
      "",
      `**Motivo:** ${input.reason || "Nenhum motivo fornecido"}`,
      ...(input.extra?.length ? ["", ...input.extra] : []),
      "",
      "**Moderador(a):**",
      input.moderator?.mention ?? "Desconhecido",
      input.moderator?.tag ? tagLine(input.moderator.tag) : null,
      input.moderator?.id ? tagLine(input.moderator.id) : null
    ].filter(Boolean).join("\n")
  });
}

function messageLogEmbed(input: {
  title: string;
  userMention: string;
  userTag?: string | null;
  channelId: string;
  content?: string | null;
  after?: string | null;
  color?: number;
}) {
  const lines = [
    `**Usuario(a):** ${input.userMention}`,
    input.userTag ? tagLine(input.userTag) : null,
    `**Canal:** <#${input.channelId}>`,
    tagLine(`#${input.channelId}`),
    "",
    "**Conteudo:**",
    codeBlock(input.content, 700)
  ];

  if (input.after !== undefined) {
    lines.push("", "**Depois:**", codeBlock(input.after, 700));
  }

  return compactLogEmbed({
    title: input.title,
    color: input.color ?? logPalette.danger,
    description: lines.filter(Boolean).join("\n")
  });
}

function timeoutLabel(timestamp: number | null) {
  if (!timestamp || timestamp <= Date.now()) return "Removido";
  return `<t:${Math.floor(timestamp / 1000)}:R>`;
}

async function sendStaffAlert(guild: Guild, content: string) {
  const config = await getSecurityConfig(guild);
  const channelId = config.antiRaid.staffChannelId ?? config.logs.channels["entrada-saida"] ?? config.logs.channels.url;
  if (!channelId) return;
  const channel = await guild.client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased() && "send" in channel) await channel.send({ content }).catch(() => null);
}

async function handleRaidJoin(member: GuildMember) {
  const config = await getSecurityConfig(member.guild);
  if (!config.antiRaid.enabled || (await isSecurityBypassed(member))) return;

  const reasons = suspiciousMember(member, config.antiRaid.newAccountDays);
  const joins = await bumpWindowCounter(`security:joins:${member.guild.id}`, config.antiRaid.joinWindowSeconds);
  if (reasons.length) await bumpWindowCounter(`security:suspicious-joins:${member.guild.id}`, config.antiRaid.joinWindowSeconds);
  const raidDetected = joins.count >= config.antiRaid.joinLimit || reasons.length >= 2;
  if (!raidDetected) return;

  let actionTaken = "Log";
  
  // Logica Anti-Fake Ativa
  if (reasons.includes("conta nova") && config.antiRaid.severity === "CRITICAL") {
    await member.kick("Anti-Fake: Conta muito recente detectada durante suspeita de Raid").catch(() => null);
    actionTaken = "Expulso (Anti-Fake)";
  } else if (config.antiRaid.quarantineRoleId) {
    await member.roles.add(config.antiRaid.quarantineRoleId, "Anti-raid: conta suspeita/entrada massiva").catch(() => null);
    actionTaken = "Quarentena";
  } else if (config.antiRaid.timeoutSeconds > 0) {
    await member.timeout(config.antiRaid.timeoutSeconds * 1000, "Anti-raid: conta suspeita/entrada massiva").catch(() => null);
    actionTaken = "Timeout";
  }
  if (config.antiRaid.lockdownOnRaid && joins.count >= config.antiRaid.joinLimit) {
    await lockGuild(member.guild, "Anti-raid: entrada massiva detectada");
    actionTaken += " + Lockdown";
  }

  await sendStaffAlert(member.guild, `Anti-raid acionado para ${member} (${member.id}). Acao: ${actionTaken}.`);
  await sendSecurityLog({
    guild: member.guild,
    category: "entrada-saida",
    severity: config.antiRaid.severity,
    targetId: member.id,
    actionTaken,
    reason: reasons.join(", ") || "entrada massiva",
    metadata: { joinCount: joins.count, suspiciousReasons: reasons },
    embed: auditEmbed({
      action: "antiraid_trigger",
      moderator: "Sistema (Anti-Raid)",
      target: `${member.user.tag} (${member.id})`,
      reason: reasons.join(", ") || "Entrada massiva detectada",
      timestamp: new Date()
    }).addFields({ name: "Acao Aplicada", value: actionTaken, inline: true })
  });
}

async function handleUrls(message: Message) {
  if (!message.guild || message.author.bot) return false;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (await isSecurityBypassed(member, message.channel.id)) return false;

  const config = await getSecurityConfig(message.guild);
  if (!config.antiUrl.enabled) return false;
  const urls = extractUrls(message.content);
  if (!urls.length) return false;

  const blocked: string[] = [];
  for (const rawUrl of urls) {
    const domain = domainFromUrl(rawUrl);
    const allowed = config.antiUrl.allowedDomains.some((allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`));
    const blockedDomain = config.antiUrl.blockedDomains.some((badDomain) => domain.includes(badDomain.toLowerCase()));
    const externalInvite = config.antiUrl.blockExternalInvites && /discord\.gg\/|discord\.com\/invite\//i.test(rawUrl) && !allowed;
    if (blockedDomain || externalInvite) blocked.push(rawUrl);
  }

  if (!blocked.length) {
    await sendSecurityLog({
      guild: message.guild,
      category: "url",
      severity: "LOW",
      actorId: message.author.id,
      channelId: message.channel.id,
      metadata: { urls },
      embed: notificationEmbed({
        type: "info",
        title: "Link Enviado",
        message: `Autor: ${message.author} (\`${message.author.id}\`)\nCanal: ${message.channel}\nLinks: ${truncate(urls.join("\n"), 800)}`
      })
    });
    return false;
  }

  if (config.antiUrl.deleteMessage) await message.delete().catch(() => null);
  if (config.antiUrl.timeoutSeconds > 0 && member?.moderatable) {
    await member.timeout(config.antiUrl.timeoutSeconds * 1000, "Anti URL: link bloqueado").catch(() => null);
  }

  await sendSecurityLog({
    guild: message.guild,
    category: "url",
    severity: config.antiUrl.severity,
    actorId: message.author.id,
    channelId: message.channel.id,
    actionTaken: config.antiUrl.deleteMessage ? "mensagem apagada" : "log",
    reason: "dominio bloqueado/invite externo",
    metadata: { blocked },
    embed: auditEmbed({
      action: "warn",
      moderator: "Sistema (Anti-URL)",
      target: `${message.author.tag} (${message.author.id})`,
      reason: "Dominio bloqueado ou convite externo",
      timestamp: new Date()
    }).addFields(
      { name: "Acao", value: config.antiUrl.deleteMessage ? "Mensagem Apagada" : "Apenas Log", inline: true },
      { name: "Links", value: truncate(blocked.join("\n"), 400) }
    )
  });
  return true;
}

async function handleSpam(message: Message) {
  if (!message.guild || message.author.bot) return;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (await isSecurityBypassed(member, message.channel.id)) return;

  const abuse = await detectMessageAbuse(message);
  const repeat = await bumpWindowCounter(`security:repeat:${message.guild.id}:${message.author.id}:${message.content.slice(0, 80)}`, 20);
  const emojiCount = [...message.content.matchAll(/<a?:\w+:\d+>|[\u{1F300}-\u{1FAFF}]/gu)].length;
  const links = extractUrls(message.content);
  const abusive = abuse.abusive || repeat.count >= 4 || emojiCount >= 18 || links.length >= 5;
  if (!abusive) return;

  await message.delete().catch(() => null);
  if (member?.moderatable) await member.timeout(10 * 60 * 1000, "Anti-spam/flood").catch(() => null);
  await sendSecurityLog({
    guild: message.guild,
    category: "mensagens",
    severity: "MEDIUM",
    actorId: message.author.id,
    channelId: message.channel.id,
    actionTaken: "mensagem apagada + timeout",
    reason: abuse.reason ?? "flood/spam",
    metadata: { repeat: repeat.count, emojiCount, links },
    embed: auditEmbed({
      action: "mute",
      moderator: "Sistema (Anti-Spam)",
      target: `${message.author.tag} (${message.author.id})`,
      reason: abuse.reason ?? "Flood ou Spam detectado",
      duration: "10 minutos",
      timestamp: new Date()
    }).addFields({ name: "Detalhes", value: `Emojis: ${emojiCount} | Links: ${links.length} | Repeticoes: ${repeat.count}` })
  });
}

async function handleAntiNuke(guild: Guild, type: AuditLogEvent, action: string, category: "cargos" | "bans" | "calls", targetId?: string) {
  const entry = await latestExecutor(guild, type, targetId);
  const executorId = entry?.executorId;
  if (!executorId || executorId === guild.client.user?.id) return entry;

  const member = await guild.members.fetch(executorId).catch(() => null);
  if (await isSecurityBypassed(member)) return entry;
  const config = await getSecurityConfig(guild);
  if (!config.antiNuke.enabled) return entry;

  const counter = await bumpWindowCounter(`security:nuke:${guild.id}:${executorId}:${action}`, config.antiNuke.windowSeconds);
  if (counter.count < config.antiNuke.actionLimit) return entry;

  const reason = `Anti-nuke: ${action} em massa (${counter.count}/${config.antiNuke.windowSeconds}s)`;
  if (member && config.antiNuke.removeAdminRoles) await punishNukeExecutor(member, reason, config.antiNuke.banExecutor);
  if (config.antiNuke.lockdownOnTrigger) await lockGuild(guild, reason);

  await sendSecurityLog({
    guild,
    category,
    severity: config.antiNuke.severity,
    actorId: executorId,
    targetId,
    actionTaken: `${config.antiNuke.removeAdminRoles ? "cargos administrativos removidos" : "alerta"}${config.antiNuke.lockdownOnTrigger ? " + lockdown" : ""}`,
    reason,
    metadata: { count: counter.count, action },
    embed: auditEmbed({
      action: "antiraid_trigger",
      moderator: "Sistema (Anti-Nuke)",
      target: `<@${executorId}> (\`${executorId}\`)`,
      reason,
      timestamp: new Date()
    }).addFields({ name: "Medida", value: config.antiNuke.removeAdminRoles ? "Cargos administrativos removidos" : "Apenas Alerta", inline: true })
  });
  return entry;
}

export function bindSecurityHandlers(client: Client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const config = await getSecurityConfig(member.guild);
      const reasons = suspiciousMember(member, config.antiRaid.newAccountDays);

      const embed = notificationEmbed({
        type: reasons.length ? "warning" : "success",
        title: "Membro Entrou",
        message: `Usuario: ${member} (\`${member.id}\`)\nConta criada: <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\nTempo de conta: **${memberAgeDays(member)} dias**\nSuspeita: **${reasons.length ? reasons.join(", ") : "Nao"}**`
      });
      embed.setThumbnail(member.user.displayAvatarURL({ size: 256 }));
      
      await sendSecurityLog({ guild: member.guild, category: "entrada-saida", severity: reasons.length ? "MEDIUM" : "LOW", targetId: member.id, metadata: { suspicious: reasons }, embed });
      await handleRaidJoin(member);
    } catch (error) {
      log.error({ error }, "Erro em GuildMemberAdd");
    }
  });

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    if (!member.guild) return;
    await sendSecurityLog({
      guild: member.guild,
      category: "entrada-saida",
      targetId: member.id,
      embed: notificationEmbed({
        type: "neutral",
        title: "Membro Saiu",
        message: `Usuario: <@${member.id}> (\`${member.id}\`)\nConta criada: ${member.user?.createdTimestamp ? `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>` : "indisponivel"}`
      })
    });
  });

  client.on(Events.MessageCreate, async (message) => {
    try {
      if (await handleUrls(message)) return;
      await handleSpam(message);
    } catch (error) {
      log.error({ error }, "Erro em MessageCreate seguranca");
    }
  });

  client.on(Events.MessageDelete, async (message: Message | PartialMessage) => {
    if (!message.guild || message.author?.bot) return;
    const author = message.author;
    await sendSecurityLog({
      guild: message.guild,
      category: "mensagens",
      actorId: author?.id,
      channelId: message.channelId,
      embed: messageLogEmbed({
        title: "Mensagem Excluida - HUF",
        userMention: author ? `${author}` : "desconhecido",
        userTag: author?.tag,
        channelId: message.channelId,
        content: message.content,
        color: logPalette.danger
      })
    });
  });
  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    const author = newMessage.author;
    await sendSecurityLog({
      guild: newMessage.guild,
      category: "mensagens",
      actorId: author?.id,
      channelId: newMessage.channelId,
      embed: messageLogEmbed({
        title: "Mensagem Editada - HUF",
        userMention: author ? `${author}` : "desconhecido",
        userTag: author?.tag,
        channelId: newMessage.channelId,
        content: oldMessage.content,
        after: newMessage.content,
        color: logPalette.info
      })
    });
  });
  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const guild = newState.guild;
    const key = `${guild.id}:${newState.id}`;
    let title = "Call Atualizada";
    let description = `Usuario: <@${newState.id}> (\`${newState.id}\`)`;
    let type: "info" | "success" | "warning" = "info";

    if (!oldState.channelId && newState.channelId) {
      title = "Entrou em Call";
      type = "success";
      voiceSessions.set(key, Date.now());
      description += `\nCanal: <#${newState.channelId}>`;
    } else if (oldState.channelId && !newState.channelId) {
      title = "Saiu da Call";
      type = "warning";
      const startedAt = voiceSessions.get(key);
      voiceSessions.delete(key);
      description += `\nCanal: <#${oldState.channelId}>\nTempo em call: **${startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0}s**`;
    } else if (oldState.channelId !== newState.channelId) {
      title = "Mudou de Call";
      description += `\n**De:** <#${oldState.channelId}>\n**Para:** <#${newState.channelId}>`;
    } else if (oldState.selfMute !== newState.selfMute || oldState.serverMute !== newState.serverMute || oldState.selfDeaf !== newState.selfDeaf || oldState.serverDeaf !== newState.serverDeaf) {
      title = "Estado de Voz Alterado";
      description += `\nMudo: **${newState.selfMute || newState.serverMute ? "Sim" : "Nao"}**\nSurdo: **${newState.selfDeaf || newState.serverDeaf ? "Sim" : "Nao"}**`;
    } else return;

    await sendSecurityLog({
      guild,
      category: "calls",
      targetId: newState.id,
      channelId: newState.channelId ?? oldState.channelId ?? undefined,
      embed: notificationEmbed({ type, title, message: description })
    });
  });

  client.on(Events.GuildBanAdd, async (ban: GuildBan) => {
    const entry = await handleAntiNuke(ban.guild, AuditLogEvent.MemberBanAdd, "banimentos", "bans", ban.user.id);
    await sendSecurityLog({
      guild: ban.guild,
      category: "bans",
      actorId: entry?.executorId ?? undefined,
      targetId: ban.user.id,
      reason: entry?.reason ?? undefined,
      embed: moderationLogEmbed({
        title: "Usuario Banido - 2mg",
        target: {
          mention: `${ban.user}`,
          tag: ban.user.tag,
          id: ban.user.id,
          avatarUrl: ban.user.displayAvatarURL({ size: 256 })
        },
        moderator: entry?.executor ? {
          mention: `${entry.executor}`,
          tag: entry.executor.tag,
          id: entry.executor.id
        } : undefined,
        reason: entry?.reason,
        color: logPalette.danger
      })
    });
  });
  client.on(Events.GuildBanRemove, async (ban: GuildBan) => {
    const entry = await latestExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendSecurityLog({
      guild: ban.guild,
      category: "bans",
      actorId: entry?.executorId ?? undefined,
      targetId: ban.user.id,
      reason: entry?.reason ?? undefined,
      embed: moderationLogEmbed({
        title: "Usuario Desbanido - 2mg",
        target: {
          mention: `${ban.user}`,
          tag: ban.user.tag,
          id: ban.user.id,
          avatarUrl: ban.user.displayAvatarURL({ size: 256 })
        },
        moderator: entry?.executor ? {
          mention: `${entry.executor}`,
          tag: entry.executor.tag,
          id: entry.executor.id
        } : undefined,
        reason: entry?.reason,
        color: logPalette.success
      })
    });
  });
  client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (oldGuild.premiumTier !== newGuild.premiumTier || oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
      await sendSecurityLog({
        guild: newGuild,
        category: "boost",
        embed: notificationEmbed({
          type: "success",
          title: "Boost de Servidor Atualizado",
          message: `Nivel: **${oldGuild.premiumTier} -> ${newGuild.premiumTier}**\nBoosts totais: **${newGuild.premiumSubscriptionCount ?? 0}**`
        })
      });
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
      await sendSecurityLog({
        guild: newMember.guild,
        category: "boost",
        targetId: newMember.id,
        embed: notificationEmbed({
          type: newMember.premiumSinceTimestamp ? "success" : "warning",
          title: newMember.premiumSinceTimestamp ? "Novo Boost Recebido" : "Boost Removido",
          message: `Usuario: ${newMember} (\`${newMember.id}\`)\nBoosts totais: **${newMember.guild.premiumSubscriptionCount ?? 0}**`
        })
      });
    }

    const oldTimeout = oldMember.communicationDisabledUntilTimestamp ?? null;
    const newTimeout = newMember.communicationDisabledUntilTimestamp ?? null;
    if (oldTimeout !== newTimeout) {
      const entry = await latestExecutor(newMember.guild, AuditLogEvent.MemberUpdate, newMember.id);
      const active = !!newTimeout && newTimeout > Date.now();

      await sendSecurityLog({
        guild: newMember.guild,
        category: "bans",
        actorId: entry?.executorId ?? undefined,
        targetId: newMember.id,
        actionTaken: active ? "castigo aplicado" : "castigo removido",
        reason: entry?.reason ?? undefined,
        metadata: { oldTimeout, newTimeout },
        embed: moderationLogEmbed({
          title: active ? "Usuario Castigado - 2mg" : "Castigo Removido - 2mg",
          target: {
            mention: `${newMember}`,
            tag: newMember.user.tag,
            id: newMember.id,
            avatarUrl: newMember.user.displayAvatarURL({ size: 256 })
          },
          moderator: entry?.executor ? {
            mention: `${entry.executor}`,
            tag: entry.executor.tag,
            id: entry.executor.id
          } : undefined,
          reason: entry?.reason,
          extra: [
            "**Tempo:**",
            active ? timeoutLabel(newTimeout) : "Removido"
          ],
          color: active ? logPalette.warning : logPalette.success
        })
      });
    }

    const added = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    const removed = oldMember.roles.cache.filter((role) => !newMember.roles.cache.has(role.id));
    if (!added.size && !removed.size) return;
    const entry = await latestExecutor(newMember.guild, added.size ? AuditLogEvent.MemberRoleUpdate : AuditLogEvent.MemberRoleUpdate, newMember.id);
    
    await sendSecurityLog({
      guild: newMember.guild,
      category: "cargos",
      actorId: entry?.executorId ?? undefined,
      targetId: newMember.id,
      reason: entry?.reason ?? undefined,
      embed: auditEmbed({
        action: added.size ? "role_grant" : "role_remove",
        moderator: entry?.executor?.tag ?? "Desconhecido",
        target: `${newMember.user.tag} (${newMember.id})`,
        reason: entry?.reason ?? "Alteracao via Discord",
        timestamp: new Date()
      }).addFields(
        { name: "Adicionados", value: added.map((role) => role.toString()).join(", ") || "Nenhum", inline: true },
        { name: "Removidos", value: removed.map((role) => role.toString()).join(", ") || "Nenhum", inline: true }
      )
    });
  });

  const roleLog = async (guild: Guild, role: Role, title: string, type: AuditLogEvent, action: any) => {
    const entry = await handleAntiNuke(guild, type, title.toLowerCase(), "cargos", role.id);
    await sendSecurityLog({
      guild,
      category: "cargos",
      actorId: entry?.executorId ?? undefined,
      targetId: role.id,
      reason: entry?.reason ?? undefined,
      embed: auditEmbed({
        action,
        moderator: entry?.executor?.tag ?? "Desconhecido",
        target: `${role.name} (\`${role.id}\`)`,
        reason: entry?.reason ?? "Acao administrativa",
        timestamp: new Date()
      }).setTitle(title)
    });
  };
  client.on(Events.GuildRoleCreate, (role) => roleLog(role.guild, role, "Cargo Criado", AuditLogEvent.RoleCreate, "role_grant"));
  client.on(Events.GuildRoleDelete, (role) => roleLog(role.guild, role, "Cargo Excluido", AuditLogEvent.RoleDelete, "role_remove"));
  client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const entry = await latestExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await sendSecurityLog({
      guild: newRole.guild,
      category: "cargos",
      actorId: entry?.executorId ?? undefined,
      targetId: newRole.id,
      reason: entry?.reason ?? undefined,
      embed: notificationEmbed({
        type: "info",
        title: "Cargo Editado",
        message: `Cargo: ${newRole} (\`${newRole.id}\`)\n**Nome:** ${oldRole.name} -> ${newRole.name}\n**Cor:** ${oldRole.hexColor} -> ${newRole.hexColor}\n**Permissoes:** ${oldRole.permissions.bitfield === newRole.permissions.bitfield ? "Sem alteracao" : "Alteradas"}\n**Executor:** ${entry?.executor ?? "Desconhecido"}`
      })
    });
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAntiNuke(channel.guild, AuditLogEvent.ChannelCreate, "criacao de canais", channel.type === ChannelType.GuildVoice ? "calls" : "cargos", channel.id);
    if (channel.type === ChannelType.GuildVoice) {
      await sendSecurityLog({
        guild: channel.guild,
        category: "calls",
        channelId: channel.id,
        embed: notificationEmbed({
          type: "success",
          title: "Canal de Voz Criado",
          message: `Canal: ${channel} (\`${channel.id}\`)`
        })
      });
    }
  });
  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAntiNuke(channel.guild, AuditLogEvent.ChannelDelete, "exclusao de canais", channel.type === ChannelType.GuildVoice ? "calls" : "cargos", channel.id);
    if (channel.type === ChannelType.GuildVoice) {
      await sendSecurityLog({
        guild: channel.guild,
        category: "calls",
        channelId: channel.id,
        embed: notificationEmbed({
          type: "danger",
          title: "Canal de Voz Excluido",
          message: `Canal: **${channel.name}** (\`${channel.id}\`)`
        })
      });
    }
  });
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!("guild" in newChannel) || !newChannel.guild || newChannel.type !== ChannelType.GuildVoice || oldChannel.type !== ChannelType.GuildVoice) return;
    if (oldChannel.name === newChannel.name && oldChannel.userLimit === newChannel.userLimit) return;
    await sendSecurityLog({
      guild: newChannel.guild,
      category: "calls",
      channelId: newChannel.id,
      embed: notificationEmbed({
        type: "info",
        title: "Canal de Voz Editado",
        message: `Canal: ${newChannel} (\`${newChannel.id}\`)\n**Nome:** ${oldChannel.name} -> ${newChannel.name}\n**Limite:** ${oldChannel.userLimit ?? 0} -> ${newChannel.userLimit ?? 0}`
      })
    });
  });
}
