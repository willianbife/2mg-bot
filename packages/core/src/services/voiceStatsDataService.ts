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
  const activeDelta = currentStat?.lastJoinedAt ? secondsSince(currentStat.lastJoinedAt) : 0;

  const allGuildStats = await prisma.voiceStat.groupBy({
    by: ['userId'],
    where: { guildId: guild.id },
    _sum: { totalSeconds: true }
  });

  const activeStats = await prisma.voiceStat.findMany({
    where: { guildId: guild.id, lastJoinedAt: { not: null } },
    select: { userId: true, lastJoinedAt: true }
  });
  const activeByUser = new Map(
    activeStats.map((stat) => [stat.userId, stat.lastJoinedAt ? secondsSince(stat.lastJoinedAt) : 0])
  );
  const rankedStats = allGuildStats
    .map((stat) => ({
      userId: stat.userId,
      totalSeconds: (stat._sum.totalSeconds ?? 0) + (activeByUser.get(stat.userId) ?? 0)
    }))
    .sort((a, b) => b.totalSeconds - a.totalSeconds);

  const rankIndex = rankedStats.findIndex(s => s.userId === user.id);
  const rank = rankIndex !== -1 ? `#${rankIndex + 1}` : "N/A";

  const totalSeconds = rankedStats.find(s => s.userId === user.id)?.totalSeconds ?? activeDelta;
  const currentWeeklySeconds = (currentStat?.weeklySeconds ?? 0) + activeDelta;
  const currentMutedSeconds = currentStat?.mutedSeconds ?? 0;

  return {
    rank,
    totalSeconds,
    currentWeek: {
      key: currentWeek,
      total: currentWeeklySeconds,
      muted: currentMutedSeconds,
      active: Math.max(currentWeeklySeconds - currentMutedSeconds, 0)
    },
    previousWeek: {
      key: previousWeek,
      total: previousStat?.weeklySeconds ?? 0,
      muted: previousStat?.mutedSeconds ?? 0,
      active: (previousStat?.weeklySeconds ?? 0) - (previousStat?.mutedSeconds ?? 0)
    }
  };
}

function secondsSince(date: Date) {
  return Math.max(Math.floor((Date.now() - date.getTime()) / 1000), 0);
}
