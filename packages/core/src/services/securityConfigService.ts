import { EmbedBuilder, Guild, GuildMember, PermissionFlagsBits } from "discord.js";
import { z } from "zod";
import { prisma } from "@neon/database";
import { audit } from "./auditService.js";
import { childLogger } from "../logger/logger.js";
import { redis } from "../database/redis.js";
import { notificationEmbed } from "../embeds/index.js";

const log = childLogger("security-config");

export const logCategories = ["entrada-saida", "calls", "mensagens", "boost", "bans", "url", "cargos"] as const;
export type SecurityLogCategory = (typeof logCategories)[number];
type DbLogCategory = "ENTRADA_SAIDA" | "CALLS" | "MENSAGENS" | "BOOST" | "BANS" | "URL" | "CARGOS";
type SecuritySeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

const categoryMap: Record<SecurityLogCategory, DbLogCategory> = {
  "entrada-saida": "ENTRADA_SAIDA",
  calls: "CALLS",
  mensagens: "MENSAGENS",
  boost: "BOOST",
  bans: "BANS",
  url: "URL",
  cargos: "CARGOS"
};

const logConfigSchema = z.object({
  enabled: z.boolean().default(true),
  channels: z.record(z.string()).default({})
});

const antiRaidSchema = z.object({
  enabled: z.boolean().default(true),
  joinLimit: z.number().int().min(2).max(100).default(8),
  joinWindowSeconds: z.number().int().min(10).max(600).default(45),
  newAccountDays: z.number().int().min(1).max(90).default(7),
  suspiciousJoinThreshold: z.number().int().min(1).max(100).default(4),
  quarantineRoleId: z.string().optional(),
  staffChannelId: z.string().optional(),
  lockdownOnRaid: z.boolean().default(false),
  timeoutSeconds: z.number().int().min(10).max(2419200).default(900),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("HIGH")
});

const antiNukeSchema = z.object({
  enabled: z.boolean().default(true),
  actionLimit: z.number().int().min(2).max(50).default(5),
  windowSeconds: z.number().int().min(10).max(600).default(60),
  removeAdminRoles: z.boolean().default(true),
  banExecutor: z.boolean().default(false),
  lockdownOnTrigger: z.boolean().default(true),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("CRITICAL")
});

const antiUrlSchema = z.object({
  enabled: z.boolean().default(true),
  blockExternalInvites: z.boolean().default(true),
  deleteMessage: z.boolean().default(true),
  timeoutSeconds: z.number().int().min(0).max(2419200).default(600),
  warn: z.boolean().default(true),
  blockedDomains: z.array(z.string()).default([
    "discord-nitro", "steamcommunity.ru", "free-nitro", "bit.ly", "tinyurl.com",
    "gift-nitro", "discord-gift", "dlscord", "discorcl", "cliscord"
  ]),
  allowedDomains: z.array(z.string()).default(["discord.com", "discord.gg", "discordapp.com"]),
  blockedWords: z.array(z.string()).default(["nitro", "gift", "free", "promocao", "ganhe"]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM")
});

const securityConfigSchema = z.object({
  logs: logConfigSchema.default({ enabled: true, channels: {} }),
  antiRaid: antiRaidSchema.default({}),
  antiNuke: antiNukeSchema.default({}),
  antiUrl: antiUrlSchema.default({}),
  ignoredRoles: z.array(z.string()).default([]),
  ignoredChannels: z.array(z.string()).default([]),
  whitelistedUsers: z.array(z.string()).default([])
});

export type SecurityConfigData = z.infer<typeof securityConfigSchema>;

function deepMerge<T extends Record<string, any>>(base: T, update: Partial<T>): T {
  const output = { ...base };
  for (const [key, value] of Object.entries(update)) {
    if (value && typeof value === "object" && !Array.isArray(value) && typeof output[key] === "object" && !Array.isArray(output[key])) {
      output[key as keyof T] = deepMerge(output[key], value as any);
    } else if (value !== undefined) {
      output[key as keyof T] = value as T[keyof T];
    }
  }
  return output;
}

export async function upsertGuild(guild: Guild) {
  return prisma.guild.upsert({
    where: { discordId: guild.id },
    update: { name: guild.name, iconUrl: guild.iconURL() },
    create: { discordId: guild.id, name: guild.name, iconUrl: guild.iconURL() }
  });
}

export async function getSecurityConfig(guild: Guild): Promise<SecurityConfigData> {
  const dbGuild = await upsertGuild(guild);
  const record = await prisma.securityConfig.upsert({
    where: { guildDiscordId: guild.id },
    update: {},
    create: { guildId: dbGuild.id, guildDiscordId: guild.id }
  });

  return securityConfigSchema.parse({
    logs: record.logs,
    antiRaid: record.antiRaid,
    antiNuke: record.antiNuke,
    antiUrl: record.antiUrl,
    ignoredRoles: record.ignoredRoles,
    ignoredChannels: record.ignoredChannels,
    whitelistedUsers: record.whitelistedUsers
  });
}

export async function updateSecurityConfig(guild: Guild, patch: Partial<SecurityConfigData>, actorId?: string) {
  const current = await getSecurityConfig(guild);
  const next = securityConfigSchema.parse(deepMerge(current, patch));
  const dbGuild = await upsertGuild(guild);

  await prisma.securityConfig.upsert({
    where: { guildDiscordId: guild.id },
    update: {
      logs: next.logs,
      antiRaid: next.antiRaid,
      antiNuke: next.antiNuke,
      antiUrl: next.antiUrl,
      ignoredRoles: next.ignoredRoles,
      ignoredChannels: next.ignoredChannels,
      whitelistedUsers: next.whitelistedUsers
    },
    create: {
      guildId: dbGuild.id,
      guildDiscordId: guild.id,
      logs: next.logs,
      antiRaid: next.antiRaid,
      antiNuke: next.antiNuke,
      antiUrl: next.antiUrl,
      ignoredRoles: next.ignoredRoles,
      ignoredChannels: next.ignoredChannels,
      whitelistedUsers: next.whitelistedUsers
    }
  });

  await audit({ guildId: dbGuild.id, actorId, bot: "SECURITY", action: "CONFIG_UPDATE", metadata: patch });
  return next;
}

export async function isSecurityBypassed(member: GuildMember | null | undefined, channelId?: string) {
  if (!member) return false;
  if (member.guild.ownerId === member.id) return true;
  const config = await getSecurityConfig(member.guild);
  if (config.whitelistedUsers.includes(member.id)) return true;
  if (channelId && config.ignoredChannels.includes(channelId)) return true;
  return member.roles.cache.some((role) => config.ignoredRoles.includes(role.id));
}

export async function recordSecurityEvent(input: {
  guild: Guild;
  category: SecurityLogCategory;
  severity?: SecuritySeverity;
  actorId?: string;
  targetId?: string;
  channelId?: string;
  actionTaken?: string;
  reason?: string;
  metadata?: unknown;
}) {
  const dbGuild = await upsertGuild(input.guild);
  await prisma.securityEvent.create({
    data: {
      guildId: dbGuild.id,
      category: categoryMap[input.category],
      severity: input.severity ?? "LOW",
      actorId: input.actorId,
      targetId: input.targetId,
      channelId: input.channelId,
      actionTaken: input.actionTaken,
      reason: input.reason,
      metadata: input.metadata ?? {}
    }
  });
}

export async function sendSecurityLog(input: {
  guild: Guild;
  category: SecurityLogCategory;
  embed: EmbedBuilder;
  severity?: SecuritySeverity;
  actorId?: string;
  targetId?: string;
  channelId?: string;
  actionTaken?: string;
  reason?: string;
  metadata?: unknown;
}) {
  try {
    const config = await getSecurityConfig(input.guild);
    await recordSecurityEvent(input);
    if (!config.logs.enabled) return;
    const targetChannelId = config.logs.channels[input.category];
    if (!targetChannelId) return;
    const channel = await input.guild.client.channels.fetch(targetChannelId).catch(() => null);
    if (channel?.isTextBased() && "send" in channel) await channel.send({ embeds: [input.embed] }).catch(() => null);
  } catch (error) {
    log.error({ error, category: input.category, guildId: input.guild.id }, "Falha ao enviar log de seguranca");
  }
}

export function truncate(value: string | null | undefined, max = 900) {
  if (!value) return "`sem conteudo`";
  return value.length > max ? `${value.slice(0, max - 3)}...` : value;
}

export function extractUrls(content: string) {
  return [...content.matchAll(/https?:\/\/[^\s<>)]+|discord\.gg\/[A-Za-z0-9-]+/gi)].map((match) => match[0]);
}

export function domainFromUrl(rawUrl: string) {
  const normalized = rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`;
  try {
    return new URL(normalized).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return rawUrl.toLowerCase();
  }
}

export async function lockGuild(guild: Guild, reason: string) {
  const everyone = guild.roles.everyone;
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel) continue;
    await channel.permissionOverwrites.edit(everyone, { SendMessages: false, Connect: false }, { reason }).catch(() => null);
  }
}

export async function unlockGuild(guild: Guild, reason: string) {
  const everyone = guild.roles.everyone;
  const channels = await guild.channels.fetch();
  for (const channel of channels.values()) {
    if (!channel) continue;
    await channel.permissionOverwrites.edit(everyone, { SendMessages: null, Connect: null }, { reason }).catch(() => null);
  }
}

export async function punishNukeExecutor(member: GuildMember, reason: string, banExecutor: boolean) {
  const dangerous = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.ManageWebhooks
  ];
  const removableRoles = member.roles.cache.filter(
    (role) => !role.managed && role.id !== member.guild.id && role.position < (member.guild.members.me?.roles.highest.position ?? 0) && dangerous.some((permission) => role.permissions.has(permission))
  );
  for (const role of removableRoles.values()) await member.roles.remove(role, reason).catch(() => null);
  if (banExecutor && member.bannable) await member.ban({ reason }).catch(() => null);
}

export async function bumpWindowCounter(key: string, windowSeconds: number) {
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  const ttl = await redis.ttl(key);
  return { count, ttl };
}

export function statusEmbed(title: string, lines: string[]) {
  return notificationEmbed({
    type: "info",
    title,
    message: lines.join("\n")
  });
}
