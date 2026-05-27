import { Message } from "discord.js";
import { env, PrefixCommand, PrefixCommandManager, premiumEmbed } from "@neon/core";

export function createInfoHelpCommand(manager: PrefixCommandManager): PrefixCommand {
  return {
    name: "help",
    aliases: ["ajuda"],
    description: "Lista comandos por prefixo de informacoes.",
    usage: `${env.BOT_PREFIX}help`,
    async execute(message: Message) {
      const description = manager
        .list()
        .map((command) => `**${env.BOT_PREFIX}${command.name}**\n${command.description}\nUso: \`${command.usage}\``)
        .join("\n\n");
      await message.reply({ embeds: [premiumEmbed({ title: "Comandos de Informacoes", description })] });
    }
  };
}
