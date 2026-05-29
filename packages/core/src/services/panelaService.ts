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

export async function addMemberToPanela(panelaId: string, memberId: string) {
  const panela = await prisma.groupPanela.findUnique({ where: { id: panelaId } });
  if (!panela) throw new Error("Grupo não encontrado");

  const metadata = panela.metadata as any;
  const members = metadata.members || [];

  if (members.length >= panela.memberLimit) {
    throw new Error("Limite de membros do grupo atingido");
  }

  if (members.includes(memberId)) {
    throw new Error("Usuário já faz parte deste grupo");
  }

  members.push(memberId);
  return prisma.groupPanela.update({
    where: { id: panelaId },
    data: { metadata: { ...metadata, members } }
  });
}

export async function removeMemberFromPanela(panelaId: string, memberId: string) {
  const panela = await prisma.groupPanela.findUnique({ where: { id: panelaId } });
  if (!panela) throw new Error("Grupo não encontrado");

  const metadata = panela.metadata as any;
  const members = (metadata.members || []).filter((id: string) => id !== memberId);

  return prisma.groupPanela.update({
    where: { id: panelaId },
    data: { metadata: { ...metadata, members } }
  });
}
