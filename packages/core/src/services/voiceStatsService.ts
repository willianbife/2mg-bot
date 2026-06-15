import { VoiceState } from "discord.js";
import { prisma } from "@neon/database";
import { monthKey, weekKey } from "../utils/time.js";
import { upsertDiscordUser } from "./userService.js";

const REWARD_INTERVAL_SECONDS = 600;
const COINS_PER_REWARD_INTERVAL = 100;

export async function handleVoiceState(oldState: VoiceState, newState: VoiceState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const stateChanged =
    oldState.channelId !== newState.channelId ||
    oldState.selfMute !== newState.selfMute ||
    oldState.serverMute !== newState.serverMute ||
    oldState.selfDeaf !== newState.selfDeaf ||
    oldState.serverDeaf !== newState.serverDeaf;

  if (!stateChanged) return;

  const stat = await getCurrentVoiceStat(member);
  const shouldContinueTracking = Boolean(newState.channelId);

  if (oldState.channelId && stat.lastJoinedAt) {
    await closeVoiceSegment(stat.id, stat.lastJoinedAt, {
      muted: Boolean(oldState.selfMute || oldState.serverMute),
      deafened: Boolean(oldState.selfDeaf || oldState.serverDeaf),
      continueTracking: shouldContinueTracking
    });
    await rewardVoiceTime(member.id, stat.lastJoinedAt);
  }

  if (newState.channelId && !stat.lastJoinedAt) {
    await prisma.voiceStat.update({ where: { id: stat.id }, data: { lastJoinedAt: new Date() } });
  }
}

async function getCurrentVoiceStat(member: NonNullable<VoiceState["member"]>) {
  const guild = await prisma.guild.upsert({
    where: { discordId: member.guild.id },
    update: { name: member.guild.name },
    create: { discordId: member.guild.id, name: member.guild.name }
  });
  const user = await upsertDiscordUser(member);
  const currentWeek = weekKey();
  const currentMonth = monthKey();

  return prisma.voiceStat.upsert({
    where: {
      guildId_userId_weekKey_monthKey: {
        guildId: guild.id,
        userId: user.id,
        weekKey: currentWeek,
        monthKey: currentMonth
      }
    },
    update: {},
    create: { guildId: guild.id, userId: user.id, weekKey: currentWeek, monthKey: currentMonth }
  });
}

async function closeVoiceSegment(
  statId: string,
  startedAt: Date,
  options: { muted: boolean; deafened: boolean; continueTracking: boolean }
) {
  const delta = Math.max(Math.floor((Date.now() - startedAt.getTime()) / 1000), 0);
  await prisma.voiceStat.update({
    where: { id: statId },
    data: {
      totalSeconds: { increment: delta },
      weeklySeconds: { increment: delta },
      monthlySeconds: { increment: delta },
      mutedSeconds: { increment: options.muted ? delta : 0 },
      deafSeconds: { increment: options.deafened ? delta : 0 },
      lastJoinedAt: options.continueTracking ? new Date() : null
    }
  });
}

async function rewardVoiceTime(userDiscordId: string, startedAt: Date) {
  const delta = Math.max(Math.floor((Date.now() - startedAt.getTime()) / 1000), 0);
  const rewards = Math.floor(delta / REWARD_INTERVAL_SECONDS) * COINS_PER_REWARD_INTERVAL;

  if (rewards <= 0) return;

  const { economyService } = await import("./economyService.js");
  await economyService.addBalance(userDiscordId, rewards, `Recompensa por tempo em call: ${Math.floor(delta / 60)} min`);
}
