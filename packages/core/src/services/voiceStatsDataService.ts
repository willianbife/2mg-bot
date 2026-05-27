import { prisma } from "@neon/database";
import { weekKey } from "../utils/time.js";

export async function getUserTimeStats(guildDiscordId: string, userDiscordId: string) {
  const guild = await prisma.guild.findUnique({ where: { discordId: guildDiscordId } });
  const user = await prisma.user.findUnique({ where: { discordId: userDiscordId } });

  if (!guild || !user) return null;

  const currentWeek = weekKey();
  const previousDate = new Date();
  previousDate.setDate(previousDate.getDate() - 7);
  const previousWeek = weekKey(previousDate);

  const stats = await prisma.voiceStat.findMany({
    where: {
      guildId: guild.id,
      userId: user.id,
      weekKey: { in: [currentWeek, previousWeek] }
    }
  });

  const currentStat = stats.find(s => s.weekKey === currentWeek);
  const previousStat = stats.find(s => s.weekKey === previousWeek);

  // Calcular rank (simplificado: rank por total de segundos no servidor)
  const allGuildStats = await prisma.voiceStat.groupBy({
    by: ['userId'],
    where: { guildId: guild.id },
    _sum: { totalSeconds: true },
    orderBy: { _sum: { totalSeconds: 'desc' } }
  });

  const rankIndex = allGuildStats.findIndex(s => s.userId === user.id);
  const rank = rankIndex !== -1 ? `#${rankIndex + 1}` : "N/A";

  const totalSeconds = allGuildStats.find(s => s.userId === user.id)?._sum.totalSeconds ?? 0;

  return {
    rank,
    totalSeconds,
    currentWeek: {
      key: currentWeek,
      total: currentStat?.weeklySeconds ?? 0,
      muted: currentStat?.mutedSeconds ?? 0,
      active: (currentStat?.weeklySeconds ?? 0) - (currentStat?.mutedSeconds ?? 0)
    },
    previousWeek: {
      key: previousWeek,
      total: previousStat?.weeklySeconds ?? 0,
      muted: previousStat?.mutedSeconds ?? 0,
      active: (previousStat?.weeklySeconds ?? 0) - (previousStat?.mutedSeconds ?? 0)
    }
  };
}
