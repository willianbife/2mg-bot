import { GuildMember, Role } from "discord.js";
import { prisma } from "@neon/database";
import { audit } from "./auditService.js";
import { upsertDiscordUser } from "./userService.js";

export async function assertRoleEditable(executor: GuildMember, target: GuildMember, role: Role) {
  if (role.managed) throw new Error("Este cargo e gerenciado por integracao.");
  if (role.position >= executor.roles.highest.position && executor.guild.ownerId !== executor.id) {
    throw new Error("O cargo esta acima ou no mesmo nivel do executor.");
  }
  if (role.position >= target.guild.members.me!.roles.highest.position) {
    throw new Error("Meu cargo precisa estar acima do cargo solicitado.");
  }
}

export async function applyRoleAction(input: {
  executor: GuildMember;
  target: GuildMember;
  roles: Role[];
  action: "add" | "remove";
  reason: string;
}) {
  const guild = await prisma.guild.upsert({
    where: { discordId: input.executor.guild.id },
    update: { name: input.executor.guild.name },
    create: { discordId: input.executor.guild.id, name: input.executor.guild.name }
  });
  const targetUser = await upsertDiscordUser(input.target);

  for (const role of input.roles) {
    await assertRoleEditable(input.executor, input.target, role);
    if (input.action === "add") await input.target.roles.add(role, input.reason);
    else await input.target.roles.remove(role, input.reason);

    await prisma.roleHistory.create({
      data: {
        guildId: guild.id,
        targetId: targetUser.id,
        executorId: input.executor.id,
        roleId: role.id,
        roleName: role.name,
        action: input.action,
        reason: input.reason
      }
    });
  }

  await audit({
    guildId: guild.id,
    actorId: input.executor.id,
    targetId: targetUser.id,
    bot: "MODERATION",
    action: input.action === "add" ? "ROLE_ADD" : "ROLE_REMOVE",
    reason: input.reason,
    metadata: { roleIds: input.roles.map((role) => role.id) }
  });
}
