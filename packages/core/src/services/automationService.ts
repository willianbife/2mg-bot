import { GuildMember, TextChannel, EmbedBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { childLogger } from "../logger/logger.js";

const log = childLogger("automation-service");

export class AutomationService {
  async getAutomationConfig(guildId: string) {
    return await prisma.automationConfig.findUnique({
      where: { guildId }
    });
  }

  async handleMemberJoin(member: GuildMember) {
    const config = await this.getAutomationConfig(member.guild.id);
    if (!config) return;

    // 1. Auto Role
    if (config.autoRoleEnabled && config.autoRoleIds) {
      try {
        const roleIds = config.autoRoleIds as string[];
        if (roleIds.length > 0) {
          await member.roles.add(roleIds, "Auto Role de entrada");
          log.info({ guildId: member.guild.id, userId: member.id, roleIds }, "Auto roles aplicados");
        }
      } catch (error) {
        log.error({ error, guildId: member.guild.id, userId: member.id }, "Erro ao aplicar auto roles");
      }
    }

    // 2. Welcome Message
    if (config.welcomeEnabled && config.welcomeChannelId) {
      const channel = member.guild.channels.cache.get(config.welcomeChannelId) as TextChannel;
      if (channel) {
        try {
          let content = config.welcomeMessage || "";
          content = content
            .replace(/{user}/g, `<@${member.id}>`)
            .replace(/{username}/g, member.user.username)
            .replace(/{guild}/g, member.guild.name)
            .replace(/{memberCount}/g, member.guild.memberCount.toString());

          if (config.welcomeEmbed) {
            const embedData = config.welcomeEmbed as any;
            const embed = new EmbedBuilder(embedData);
            await channel.send({ content: content || undefined, embeds: [embed] });
          } else if (content) {
            await channel.send({ content });
          }
        } catch (error) {
          log.error({ error, guildId: member.guild.id, channelId: config.welcomeChannelId }, "Erro ao enviar mensagem de boas-vindas");
        }
      }
    }
  }

  async handleMemberLeave(member: GuildMember) {
    const config = await this.getAutomationConfig(member.guild.id);
    if (!config || !config.leaveEnabled || !config.leaveChannelId) return;

    const channel = member.guild.channels.cache.get(config.leaveChannelId) as TextChannel;
    if (channel) {
      try {
        let content = config.leaveMessage || "";
        content = content
          .replace(/{user}/g, member.user.username)
          .replace(/{guild}/g, member.guild.name)
          .replace(/{memberCount}/g, member.guild.memberCount.toString());

        await channel.send({ content });
      } catch (error) {
        log.error({ error, guildId: member.guild.id, channelId: config.leaveChannelId }, "Erro ao enviar mensagem de saída");
      }
    }
  }

  async updateWelcomeConfig(guildId: string, data: { channelId: string; message: string; enabled: boolean }) {
    return await prisma.automationConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        welcomeChannelId: data.channelId,
        welcomeMessage: data.message,
        welcomeEnabled: data.enabled
      },
      update: {
        welcomeChannelId: data.channelId,
        welcomeMessage: data.message,
        welcomeEnabled: data.enabled
      }
    });
  }

  async updateAutoRoleConfig(guildId: string, data: { roleId: string; enabled: boolean }) {
    const config = await this.getAutomationConfig(guildId);
    let roles = (config?.autoRoleIds as string[]) || [];

    if (data.enabled) {
      if (!roles.includes(data.roleId)) roles.push(data.roleId);
    } else {
      roles = roles.filter(id => id !== data.roleId);
    }

    return await prisma.automationConfig.upsert({
      where: { guildId },
      create: {
        guildId,
        autoRoleIds: roles,
        autoRoleEnabled: roles.length > 0
      },
      update: {
        autoRoleIds: roles,
        autoRoleEnabled: roles.length > 0
      }
    });
  }
}

export const automationService = new AutomationService();
