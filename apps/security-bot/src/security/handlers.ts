import {
  AuditLogEvent,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  Guild,
  GuildAuditLogsEntry,
  GuildBan,
  GuildMember,
  Message,
  PartialGuildMember,
  PartialMessage,
  Role,
  VoiceState
} from "discord.js";
import {
  bumpWindowCounter,
  childLogger,
  detectMessageAbuse,
  domainFromUrl,
  extractUrls,
  getSecurityConfig,
  isSecurityBypassed,
  lockGuild,
  premiumEmbed,
  punishNukeExecutor,
  sendSecurityLog,
  truncate
} from "@neon/core";

const log = childLogger("security-handlers");
const voiceSessions = new Map<string, number>();

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

function baseEmbed(title: string, variant: "default" | "success" | "danger" | "warning" = "default", description?: string) {
  return premiumEmbed({ title, variant, description });
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

  let actionTaken = "log";
  if (config.antiRaid.quarantineRoleId) {
    await member.roles.add(config.antiRaid.quarantineRoleId, "Anti-raid: conta suspeita/entrada massiva").catch(() => null);
    actionTaken = "quarentena";
  } else if (config.antiRaid.timeoutSeconds > 0) {
    await member.timeout(config.antiRaid.timeoutSeconds * 1000, "Anti-raid: conta suspeita/entrada massiva").catch(() => null);
    actionTaken = "timeout";
  }
  if (config.antiRaid.lockdownOnRaid && joins.count >= config.antiRaid.joinLimit) {
    await lockGuild(member.guild, "Anti-raid: entrada massiva detectada");
    actionTaken += "+lockdown";
  }

  await sendStaffAlert(member.guild, `Anti-raid acionado para ${member} (${member.id}). Ação: ${actionTaken}.`);
  await sendSecurityLog({
    guild: member.guild,
    category: "entrada-saida",
    severity: config.antiRaid.severity,
    targetId: member.id,
    actionTaken,
    reason: reasons.join(", ") || "entrada massiva",
    metadata: { joinCount: joins.count, suspiciousReasons: reasons },
    embed: baseEmbed("Anti-raid acionado", "danger", `Membro: ${member} \`${member.id}\`\nAção: **${actionTaken}**\nMotivos: ${reasons.join(", ") || "entrada massiva"}\nEntradas na janela: **${joins.count}**`)
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
      embed: baseEmbed("Link enviado", "default", `Autor: ${message.author} \`${message.author.id}\`\nCanal: ${message.channel}\nLinks: ${truncate(urls.join("\n"), 800)}`)
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
    embed: baseEmbed("URL bloqueada", "danger", `Autor: ${message.author} \`${message.author.id}\`\nCanal: ${message.channel}\nAção: **${config.antiUrl.deleteMessage ? "mensagem apagada" : "log"}**\nLinks: ${truncate(blocked.join("\n"), 800)}`)
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
    embed: baseEmbed("Spam detectado", "warning", `Autor: ${message.author} \`${message.author.id}\`\nCanal: ${message.channel}\nMotivo: **${abuse.reason ?? "flood/spam"}**\nConteúdo: ${truncate(message.content)}`)
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
    embed: baseEmbed("Anti-nuke acionado", "danger", `Executor: <@${executorId}> \`${executorId}\`\nAção suspeita: **${action}**\nMedida: **${config.antiNuke.removeAdminRoles ? "cargos administrativos removidos" : "alerta"}**`)
  });
  return entry;
}

export function bindSecurityHandlers(client: Client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      const config = await getSecurityConfig(member.guild);
      const reasons = suspiciousMember(member, config.antiRaid.newAccountDays);
      const embed = baseEmbed("Membro entrou", reasons.length ? "warning" : "success", `Usuário: ${member} \`${member.id}\`\nConta criada: <t:${Math.floor(member.user.createdTimestamp / 1000)}:F>\nTempo de conta: **${memberAgeDays(member)} dias**\nSuspeita: **${reasons.length ? reasons.join(", ") : "não"}**`);
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
      embed: baseEmbed("Membro saiu", "warning", `Usuário: <@${member.id}> \`${member.id}\`\nConta criada: ${member.user?.createdTimestamp ? `<t:${Math.floor(member.user.createdTimestamp / 1000)}:F>` : "indisponível"}`)
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
    await sendSecurityLog({
      guild: message.guild,
      category: "mensagens",
      actorId: message.author?.id,
      channelId: message.channelId,
      embed: baseEmbed("Mensagem apagada", "warning", `Autor: ${message.author ?? "desconhecido"}\nCanal: <#${message.channelId}>\nConteúdo: ${truncate(message.content)}`)
    });
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    if (!newMessage.guild || newMessage.author?.bot || oldMessage.content === newMessage.content) return;
    await sendSecurityLog({
      guild: newMessage.guild,
      category: "mensagens",
      actorId: newMessage.author?.id,
      channelId: newMessage.channelId,
      embed: baseEmbed("Mensagem editada", "default", `Autor: ${newMessage.author}\nCanal: <#${newMessage.channelId}>\nAntes: ${truncate(oldMessage.content)}\nDepois: ${truncate(newMessage.content)}`)
    });
  });

  client.on(Events.VoiceStateUpdate, async (oldState: VoiceState, newState: VoiceState) => {
    const guild = newState.guild;
    const key = `${guild.id}:${newState.id}`;
    let title = "Call atualizada";
    let description = `Usuário: <@${newState.id}> \`${newState.id}\``;
    if (!oldState.channelId && newState.channelId) {
      title = "Entrou em call";
      voiceSessions.set(key, Date.now());
      description += `\nCall: <#${newState.channelId}>`;
    } else if (oldState.channelId && !newState.channelId) {
      title = "Saiu da call";
      const startedAt = voiceSessions.get(key);
      voiceSessions.delete(key);
      description += `\nCall: <#${oldState.channelId}>\nTempo em call: **${startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0}s**`;
    } else if (oldState.channelId !== newState.channelId) {
      title = "Mudou de call";
      description += `\nDe: <#${oldState.channelId}>\nPara: <#${newState.channelId}>`;
    } else if (oldState.selfMute !== newState.selfMute || oldState.serverMute !== newState.serverMute || oldState.selfDeaf !== newState.selfDeaf || oldState.serverDeaf !== newState.serverDeaf) {
      title = "Mute/deafen alterado";
      description += `\nMute: **${newState.selfMute || newState.serverMute ? "sim" : "não"}**\nDeafen: **${newState.selfDeaf || newState.serverDeaf ? "sim" : "não"}**`;
    } else return;
    await sendSecurityLog({ guild, category: "calls", targetId: newState.id, channelId: newState.channelId ?? oldState.channelId ?? undefined, embed: baseEmbed(title, "default", description) });
  });

  client.on(Events.GuildBanAdd, async (ban: GuildBan) => {
    const entry = await handleAntiNuke(ban.guild, AuditLogEvent.MemberBanAdd, "banimentos", "bans", ban.user.id);
    await sendSecurityLog({ guild: ban.guild, category: "bans", actorId: entry?.executorId ?? undefined, targetId: ban.user.id, reason: entry?.reason ?? undefined, embed: baseEmbed("Usuário banido", "danger", `Alvo: ${ban.user} \`${ban.user.id}\`\nExecutor: ${entry?.executor ?? "desconhecido"}\nMotivo: ${entry?.reason ?? "não informado"}`) });
  });

  client.on(Events.GuildBanRemove, async (ban: GuildBan) => {
    const entry = await latestExecutor(ban.guild, AuditLogEvent.MemberBanRemove, ban.user.id);
    await sendSecurityLog({ guild: ban.guild, category: "bans", actorId: entry?.executorId ?? undefined, targetId: ban.user.id, reason: entry?.reason ?? undefined, embed: baseEmbed("Usuário desbanido", "success", `Alvo: ${ban.user} \`${ban.user.id}\`\nExecutor: ${entry?.executor ?? "desconhecido"}`) });
  });

  client.on(Events.GuildUpdate, async (oldGuild, newGuild) => {
    if (oldGuild.premiumTier !== newGuild.premiumTier || oldGuild.premiumSubscriptionCount !== newGuild.premiumSubscriptionCount) {
      await sendSecurityLog({ guild: newGuild, category: "boost", embed: baseEmbed("Boost atualizado", "success", `Nível: **${oldGuild.premiumTier} -> ${newGuild.premiumTier}**\nBoosts totais: **${newGuild.premiumSubscriptionCount ?? 0}**`) });
    }
  });

  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    if (oldMember.premiumSinceTimestamp !== newMember.premiumSinceTimestamp) {
      await sendSecurityLog({ guild: newMember.guild, category: "boost", targetId: newMember.id, embed: baseEmbed(newMember.premiumSinceTimestamp ? "Boost recebido" : "Boost removido", newMember.premiumSinceTimestamp ? "success" : "warning", `Usuário: ${newMember} \`${newMember.id}\`\nBoosts totais: **${newMember.guild.premiumSubscriptionCount ?? 0}**`) });
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
      embed: baseEmbed("Cargo de membro alterado", "default", `Membro: ${newMember} \`${newMember.id}\`\nAdicionados: ${added.map((role) => role.toString()).join(", ") || "nenhum"}\nRemovidos: ${removed.map((role) => role.toString()).join(", ") || "nenhum"}\nExecutor: ${entry?.executor ?? "desconhecido"}`)
    });
  });

  const roleLog = async (guild: Guild, role: Role, title: string, type: AuditLogEvent, variant: "default" | "danger" | "warning" = "default") => {
    const entry = await handleAntiNuke(guild, type, title.toLowerCase(), "cargos", role.id);
    await sendSecurityLog({ guild, category: "cargos", actorId: entry?.executorId ?? undefined, targetId: role.id, reason: entry?.reason ?? undefined, embed: baseEmbed(title, variant, `Cargo: ${role} \`${role.id}\`\nNome: **${role.name}**\nExecutor: ${entry?.executor ?? "desconhecido"}`) });
  };
  client.on(Events.GuildRoleCreate, (role) => roleLog(role.guild, role, "Cargo criado", AuditLogEvent.RoleCreate));
  client.on(Events.GuildRoleDelete, (role) => roleLog(role.guild, role, "Cargo excluído", AuditLogEvent.RoleDelete, "danger"));
  client.on(Events.GuildRoleUpdate, async (oldRole, newRole) => {
    const entry = await latestExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
    await sendSecurityLog({ guild: newRole.guild, category: "cargos", actorId: entry?.executorId ?? undefined, targetId: newRole.id, reason: entry?.reason ?? undefined, embed: baseEmbed("Cargo editado", "warning", `Cargo: ${newRole} \`${newRole.id}\`\nNome: **${oldRole.name} -> ${newRole.name}**\nCor: **${oldRole.hexColor} -> ${newRole.hexColor}**\nPermissões alteradas: **${oldRole.permissions.bitfield === newRole.permissions.bitfield ? "não" : "sim"}**\nExecutor: ${entry?.executor ?? "desconhecido"}`) });
  });

  client.on(Events.ChannelCreate, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAntiNuke(channel.guild, AuditLogEvent.ChannelCreate, "criação de canais", channel.type === ChannelType.GuildVoice ? "calls" : "cargos", channel.id);
    if (channel.type === ChannelType.GuildVoice) await sendSecurityLog({ guild: channel.guild, category: "calls", channelId: channel.id, embed: baseEmbed("Call criada", "success", `Canal: ${channel} \`${channel.id}\``) });
  });
  client.on(Events.ChannelDelete, async (channel) => {
    if (!("guild" in channel) || !channel.guild) return;
    await handleAntiNuke(channel.guild, AuditLogEvent.ChannelDelete, "exclusão de canais", channel.type === ChannelType.GuildVoice ? "calls" : "cargos", channel.id);
    if (channel.type === ChannelType.GuildVoice) await sendSecurityLog({ guild: channel.guild, category: "calls", channelId: channel.id, embed: baseEmbed("Call excluída", "danger", `Canal: **${channel.name}** \`${channel.id}\``) });
  });
  client.on(Events.ChannelUpdate, async (oldChannel, newChannel) => {
    if (!("guild" in newChannel) || !newChannel.guild || newChannel.type !== ChannelType.GuildVoice || oldChannel.type !== ChannelType.GuildVoice) return;
    if (oldChannel.name === newChannel.name && oldChannel.userLimit === newChannel.userLimit) return;
    await sendSecurityLog({ guild: newChannel.guild, category: "calls", channelId: newChannel.id, embed: baseEmbed("Call editada", "warning", `Canal: ${newChannel} \`${newChannel.id}\`\nNome: **${oldChannel.name} -> ${newChannel.name}**\nLimite: **${oldChannel.userLimit ?? 0} -> ${newChannel.userLimit ?? 0}**`) });
  });
}
