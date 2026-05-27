import { Message } from "discord.js";
import { env, PrefixCommand, PrefixCommandManager, notificationEmbed } from "@neon/core";

export function createModerationHelpCommand(manager: PrefixCommandManager): PrefixCommand {
  return {
    name: "help",
    aliases: ["ajuda"],
    description: "Lista comandos de moderação por prefixo.",
    usage: `${env.BOT_PREFIX}help`,
    async execute(message: Message) {
      const description = manager
        .list()
        .map((command) => `**${env.BOT_PREFIX}${command.name}**\n${command.description}\nUso: \`${command.usage}\``)
        .join("\n\n");
      await message.reply({
        embeds: [
          notificationEmbed({
            type: "info",
            title: "Comandos de Moderação",
            message: description || "Nenhum comando registrado."
          })
        ]
      });
    }
  };
}
