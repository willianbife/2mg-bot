import { prisma } from "@neon/database";
import { Prisma } from "@prisma/client";
import { childLogger } from "../logger/logger.js";

const log = childLogger("economy-service");

export class EconomyService {
  async getUser(discordId: string, username?: string) {
    return await prisma.user.upsert({
      where: { discordId },
      update: username ? { username } : {},
      create: {
        discordId,
        username: username || "Usuário Desconhecido"
      }
    });
  }

  async addBalance(discordId: string, amount: number, description?: string) {
    const user = await this.getUser(discordId);
    
    const updatedUser = await prisma.user.update({
      where: { discordId },
      data: {
        balance: { increment: amount }
      }
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount,
        type: "ADD",
        description: description || "Crédito manual"
      }
    });

    log.info({ discordId, amount, newBalance: updatedUser.balance }, "Saldo adicionado");
    return updatedUser;
  }

  async removeBalance(discordId: string, amount: number, description?: string) {
    const user = await this.getUser(discordId);
    
    if (user.balance < amount) {
      throw new Error("Saldo insuficiente");
    }

    const updatedUser = await prisma.user.update({
      where: { discordId },
      data: {
        balance: { decrement: amount }
      }
    });

    await prisma.transaction.create({
      data: {
        userId: user.id,
        amount: -amount,
        type: "REMOVE",
        description: description || "Débito manual"
      }
    });

    log.info({ discordId, amount, newBalance: updatedUser.balance }, "Saldo removido");
    return updatedUser;
  }

  async transfer(fromDiscordId: string, toDiscordId: string, amount: number) {
    const fromUser = await this.getUser(fromDiscordId);
    const toUser = await this.getUser(toDiscordId);

    if (fromUser.balance < amount) {
      throw new Error("Saldo insuficiente para transferência");
    }

    return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const updatedFrom = await tx.user.update({
        where: { discordId: fromDiscordId },
        data: { balance: { decrement: amount } }
      });

      const updatedTo = await tx.user.update({
        where: { discordId: toDiscordId },
        data: { balance: { increment: amount } }
      });

      await tx.transaction.create({
        data: {
          userId: fromUser.id,
          amount: -amount,
          type: "TRANSFER",
          description: `Transferência para ${toDiscordId}`
        }
      });

      await tx.transaction.create({
        data: {
          userId: toUser.id,
          amount,
          type: "TRANSFER",
          description: `Transferência de ${fromDiscordId}`
        }
      });

      return { updatedFrom, updatedTo };
    });
  }
}

export const economyService = new EconomyService();
