import { prisma } from "@neon/database";

export async function createPanela(input: {
  guildId: string;
  name: string;
  ownerId: string;
  roleId?: string;
  memberLimit?: number;
}) {
  return prisma.groupPanela.create({
    data: {
      guildId: input.guildId,
      name: input.name,
      ownerId: input.ownerId,
      roleId: input.roleId,
      memberLimit: input.memberLimit ?? 12,
      metadata: { members: [input.ownerId], permissions: ["panela.manage"] }
    }
  });
}

export async function listPanelas(guildId: string) {
  return prisma.groupPanela.findMany({ where: { guildId }, orderBy: { createdAt: "desc" } });
}
