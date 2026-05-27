import { GuildMember, Message } from "discord.js";
import { extractDiscordId, premiumEmbed, PrefixCommand, requirePermission } from "@neon/core";

export const prefixBanCommand: PrefixCommand = {
  name: "ban",
  aliases: ["banir"],
  description: "Bane um usuario por ID ou mencao.",
  usage: "2mg!ban @usuario motivo",

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.ban");

    const targetRaw = args.shift();
    const reason = args.join(" ").trim();
    const targetId = targetRaw ? extractDiscordId(targetRaw) : null;

    if (!targetId || !/^\d{15,25}$/.test(targetId)) {
      await message.reply(`Uso correto: \`${this.usage}\``);
      return;
    }

    if (reason.length < 8) {
      await message.reply("Informe um motivo com pelo menos 8 caracteres.");
      return;
    }

    await message.guild.members.ban(targetId, { reason, deleteMessageSeconds: 0 });
    await message.reply({
      embeds: [
        premiumEmbed({
          title: "Usuario banido",
          variant: "danger",
          description: `Alvo: <@${targetId}>\nExecutor: ${message.author}\nMotivo: ${reason}`
        })
      ]
    });
  }
};
