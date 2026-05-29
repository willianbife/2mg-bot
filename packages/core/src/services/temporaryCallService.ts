import { VoiceState, ChannelType, PermissionFlagsBits } from "discord.js";
import { prisma } from "@neon/database";
import { childLogger } from "../logger/logger.js";

const log = childLogger("temporary-call-service");

export class TemporaryCallService {
  async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const guildId = newState.guild.id;
    const config = await prisma.automationConfig.findUnique({ where: { guildId } });
    if (!config || !config.callGeneratorId) return;

    // 1. Entrou no canal gerador
    if (newState.channelId === config.callGeneratorId) {
      await this.createTemporaryCall(newState);
    }

    // 2. Saiu de um canal (verificar se era temporário e se ficou vazio)
    if (oldState.channelId && oldState.channelId !== newState.channelId) {
      const oldChannel = oldState.channel;
      if (oldChannel && oldChannel.type === ChannelType.GuildVoice) {
        // Verificar se este canal está no nosso banco de dados como uma Call gerenciada
        const call = await prisma.call.findUnique({ where: { channelId: oldChannel.id } });
        if (call && oldChannel.members.size === 0) {
          try {
            await oldChannel.delete("Call temporária vazia");
            await prisma.call.delete({ where: { channelId: oldChannel.id } });
            log.info({ channelId: oldChannel.id }, "Call temporária deletada");
          } catch (error) {
            log.error({ error, channelId: oldChannel.id }, "Erro ao deletar call temporária");
          }
        }
      }
    }
  }

  private async createTemporaryCall(state: VoiceState) {
    const member = state.member!;
    const guild = state.guild;

    try {
      const categoryId = state.channel?.parentId;
      
      const newChannel = await guild.channels.create({
        name: `📞 ${member.user.username}`,
        type: ChannelType.GuildVoice,
        parent: categoryId || undefined,
        permissionOverwrites: [
          {
            id: member.id,
            allow: [
              PermissionFlagsBits.ManageChannels,
              PermissionFlagsBits.Connect,
              PermissionFlagsBits.Speak,
              PermissionFlagsBits.MuteMembers,
              PermissionFlagsBits.DeafenMembers,
              PermissionFlagsBits.MoveMembers
            ]
          }
        ]
      });

      // Salvar no banco de dados
      const dbGuild = await prisma.guild.findUnique({ where: { discordId: guild.id } });
      if (dbGuild) {
        await prisma.call.create({
          data: {
            guildId: dbGuild.id,
            channelId: newChannel.id,
            ownerId: member.id,
            name: newChannel.name
          }
        });
      }

      // Mover o membro
      await member.voice.setChannel(newChannel);
      log.info({ userId: member.id, channelId: newChannel.id }, "Call temporária criada");
    } catch (error) {
      log.error({ error, userId: member.id }, "Erro ao criar call temporária");
    }
  }

  async setGeneratorChannel(guildId: string, channelId: string) {
    return await prisma.automationConfig.upsert({
      where: { guildId },
      create: { guildId, callGeneratorId: channelId },
      update: { callGeneratorId: channelId }
    });
  }
}

export const temporaryCallService = new TemporaryCallService();
