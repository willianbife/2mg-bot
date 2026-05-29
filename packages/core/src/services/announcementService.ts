import { TextChannel, EmbedBuilder, Client } from "discord.js";
import { prisma } from "@neon/database";
import { childLogger } from "../logger/logger.js";

const log = childLogger("announcement-service");

export class AnnouncementService {
  private intervals = new Map<string, NodeJS.Timeout>();

  async startAnnouncements(client: Client) {
    // Buscar todos os anúncios ativos no banco (ou Guild.config)
    // Por agora, vamos implementar a lógica de envio
  }

  async sendAnnouncement(client: Client, guildId: string, channelId: string, content: string, embedData?: any) {
    try {
      const guild = client.guilds.cache.get(guildId);
      if (!guild) return;

      const channel = guild.channels.cache.get(channelId) as TextChannel;
      if (!channel) return;

      const options: any = { content };
      if (embedData) {
        options.embeds = [new EmbedBuilder(embedData)];
      }

      await channel.send(options);
      log.info({ guildId, channelId }, "Anúncio enviado");
    } catch (error) {
      log.error({ error, guildId, channelId }, "Erro ao enviar anúncio");
    }
  }

  async scheduleAnnouncement(client: Client, guildId: string, channelId: string, content: string, intervalMs: number) {
    const key = `${guildId}:${channelId}`;
    if (this.intervals.has(key)) {
      clearInterval(this.intervals.get(key)!);
    }

    const interval = setInterval(() => {
      this.sendAnnouncement(client, guildId, channelId, content);
    }, intervalMs);

    this.intervals.set(key, interval);
  }
}

export const announcementService = new AnnouncementService();
