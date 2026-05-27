import { Message } from "discord.js";
import { env, notificationEmbed, PrefixCommand, PrefixCommandManager } from "@neon/core";

export function createPrefixHelpCommand(manager: PrefixCommandManager): PrefixCommand {
  return {
    name: "help",
    aliases: ["ajuda", "comandos"],
    description: "Lista todos os comandos por prefixo.",
    usage: `${env.BOT_PREFIX}help`,

    async execute(message: Message) {
      const commands = manager
        .list()
        .map((command) => `**${env.BOT_PREFIX}${command.name}**\n${command.description}\nUso: \`${command.usage}\``)
        .join("\n\n");

      await message.reply({
        embeds: [
          notificationEmbed({
            type: "info",
            title: "Comandos por Prefixo",
            message: commands || "Nenhum comando registrado."
          })
        ]
      });
    }
  };
}
