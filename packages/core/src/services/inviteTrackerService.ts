import { Guild, Collection } from "discord.js";
import { childLogger } from "../logger/logger.js";

const log = childLogger("invite-tracker");

export class InviteTrackerService {
  private invites = new Collection<string, Collection<string, number>>();

  async cacheInvites(guild: Guild) {
    try {
      const guildInvites = await guild.invites.fetch();
      const inviteCounts = new Collection<string, number>();
      
      guildInvites.forEach(invite => {
        inviteCounts.set(invite.code, invite.uses || 0);
      });

      this.invites.set(guild.id, inviteCounts);
      log.info({ guildId: guild.id, count: guildInvites.size }, "Convites cacheados");
    } catch (error) {
      log.error({ error, guildId: guild.id }, "Erro ao cachear convites");
    }
  }

  async findInviter(guild: Guild) {
    try {
      const cachedInvites = this.invites.get(guild.id);
      const currentInvites = await guild.invites.fetch();
      
      this.invites.set(guild.id, currentInvites.mapValues(i => i.uses || 0));

      if (!cachedInvites) return null;

      const usedInvite = currentInvites.find(i => (i.uses || 0) > (cachedInvites.get(i.code) || 0));
      return usedInvite || null;
    } catch (error) {
      log.error({ error, guildId: guild.id }, "Erro ao encontrar convidador");
      return null;
    }
  }
}

export const inviteTrackerService = new InviteTrackerService();
