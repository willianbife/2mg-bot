import { Client, Events, Message } from "discord.js";
import { env } from "../config/env.js";
import { CooldownGuard } from "../guards/cooldown.js";
import { childLogger } from "../logger/logger.js";

export type PrefixCommand = {
  name: string;
  aliases?: string[];
  description: string;
  usage: string;
  execute(message: Message, args: string[]): Promise<void>;
};

export class PrefixCommandManager {
  private readonly commands = new Map<string, PrefixCommand>();
  private readonly log = childLogger("prefix-commands");
  private readonly cooldown = new CooldownGuard("prefix");

  constructor(private readonly prefix = env.BOT_PREFIX) {}

  register(command: PrefixCommand) {
    this.commands.set(command.name, command);
    for (const alias of command.aliases ?? []) this.commands.set(alias, command);
    return this;
  }

  list() {
    return [...new Set(this.commands.values())];
  }

  bind(client: Client) {
    client.on(Events.MessageCreate, async (message) => {
      if (!message.guild || message.author.bot) return;
      const mentionPrefix = new RegExp(`^<@!?${client.user?.id}>\\s*`);
      const usedMention = mentionPrefix.test(message.content);
      if (!message.content.startsWith(this.prefix) && !usedMention) return;

      const hit = await this.cooldown.consume(`${message.guild.id}:${message.author.id}`, 4, 10);
      if (!hit.allowed) {
        await message.reply(`Aguarde ${hit.resetIn}s antes de usar outro comando.`);
        return;
      }

      const raw = usedMention ? message.content.replace(mentionPrefix, "").trim() : message.content.slice(this.prefix.length).trim();
      const [name, ...args] = raw.split(/\s+/);
      const command = this.commands.get(name?.toLowerCase());
      if (!command) return;

      try {
        await command.execute(message, args);
      } catch (error) {
        this.log.error({ error: normalizeError(error), command: command.name }, "Erro em comando por prefixo");
        const detail = env.NODE_ENV === "development" && error instanceof Error ? `\nDetalhe dev: \`${error.message.slice(0, 160)}\`` : "";
        await message.reply(`Nao consegui executar esse comando.${detail}`);
      }
    });
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack, code: (error as any).code };
  }
  return { message: String(error) };
}
