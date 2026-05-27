import { VoiceState } from "discord.js";
import { prisma } from "@neon/database";
import { monthKey, weekKey } from "../utils/time.js";
import { upsertDiscordUser } from "./userService.js";

export async function handleVoiceState(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const guild = await prisma.guild.upsert({
    where: { discordId: member.guild.id },
    update: { name: member.guild.name },
    create: { discordId: member.guild.id, name: member.guild.name }
  });
  const user = await upsertDiscordUser(member);

  const currentWeek = weekKey();
  const currentMonth = monthKey();
  const stat = await prisma.voiceStat.upsert({
    where: { guildId_userId_weekKey_monthKey: { guildId: guild.id, userId: user.id, weekKey: currentWeek, monthKey: currentMonth } },
    update: {},
    create: { guildId: guild.id, userId: user.id, weekKey: currentWeek, monthKey: currentMonth }
  });

  if (!oldState.channelId && newState.channelId) {
    await prisma.voiceStat.update({ where: { id: stat.id }, data: { lastJoinedAt: new Date() } });
    return;
  }

  if (oldState.channelId && !newState.channelId && stat.lastJoinedAt) {
    const delta = Math.max(Math.floor((Date.now() - stat.lastJoinedAt.getTime()) / 1000), 0);
    await prisma.voiceStat.update({
      where: { id: stat.id },
      data: {
        totalSeconds: { increment: delta },
        weeklySeconds: { increment: delta },
        monthlySeconds: { increment: delta },
        mutedSeconds: { increment: oldState.selfMute || oldState.serverMute ? delta : 0 },
        deafSeconds: { increment: oldState.selfDeaf || oldState.serverDeaf ? delta : 0 },
        lastJoinedAt: null
      }
    });
  }
}
