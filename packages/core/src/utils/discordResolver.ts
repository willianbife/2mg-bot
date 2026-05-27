import { Guild, GuildMember, Role } from "discord.js";

export function extractDiscordId(input: string) {
  const trimmed = input.trim();
  const mention = trimmed.match(/^<@!?(\d{15,25})>$/);
  if (mention) return mention[1];

  const roleMention = trimmed.match(/^<@&(\d{15,25})>$/);
  if (roleMention) return roleMention[1];

  const slashId = trimmed.match(/\/(\d{15,25})$/);
  if (slashId) return slashId[1];

  const rawId = trimmed.match(/^(\d{15,25})$/);
  return rawId?.[1] ?? null;
}

export async function resolveMember(guild: Guild, input: string): Promise<GuildMember> {
  const id = extractDiscordId(input);
  if (!id) throw new Error("Informe uma mencao, ID ou texto no formato nome/id.");
  return guild.members.fetch(id);
}

export async function resolveRole(guild: Guild, input: string): Promise<Role> {
  const id = extractDiscordId(input);
  if (id) {
    const role = await guild.roles.fetch(id);
    if (role) return role;
  }

  const normalized = input.trim().toLowerCase();
  const role = guild.roles.cache.find((item) => item.name.toLowerCase() === normalized);
  if (!role) throw new Error("Cargo nao encontrado. Use mencao, ID ou nome exato do cargo.");
  return role;
}
