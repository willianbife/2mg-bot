import { GuildMember, Message } from "discord.js";
import { extractDiscordId, PrefixCommand, premiumEmbed, requirePermission } from "@neon/core";

export const prefixUnbanCommand: PrefixCommand = {
  name: "unban",
  aliases: ["desbanir"],
  description: "Remove banimento por ID ou nome/id.",
  usage: "2mg!unban usuario/id motivo",

  async execute(message: Message, args: string[]) {
    if (!message.guild || !(message.member instanceof GuildMember)) return;
    await requirePermission(message.member, "security.ban");

    const targetRaw = args.shift();
    const targetId = targetRaw ? extractDiscordId(targetRaw) : null;
    const reason = args.join(" ").trim();

    if (!targetId) {
      await message.reply(`Uso correto: \`${this.usage}\``);
      return;
    }
    if (reason.length < 8) {
      await message.reply("Informe um motivo com pelo menos 8 caracteres.");
      return;
    }

    await message.guild.members.unban(targetId, reason);
    await message.reply({
      embeds: [premiumEmbed({ title: "Usuario desbanido", variant: "success", description: `Alvo: <@${targetId}> \`${targetId}\`\nMotivo: ${reason}` })]
    });
  }
};
