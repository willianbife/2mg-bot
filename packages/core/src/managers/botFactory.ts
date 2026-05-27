import { Client, GatewayIntentBits, Partials } from "discord.js";
import { childLogger } from "../logger/logger.js";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return error;
}

type BotClientOptions = {
  messageContent?: boolean;
  guildMembers?: boolean;
};

export function createBotClient(name: string, options: BotClientOptions = {}) {
  const log = childLogger(name);
  const intents = [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildModeration
  ];

  if (options.messageContent) intents.push(GatewayIntentBits.MessageContent);
  if (options.guildMembers) intents.push(GatewayIntentBits.GuildMembers);

  const client = new Client({
    intents,
    partials: [Partials.Channel, Partials.GuildMember, Partials.Message, Partials.User]
  });

  client.once("ready", () => log.info({ tag: client.user?.tag }, "Bot online"));
  client.on("error", (error) => log.error({ error: serializeError(error) }, "Erro do client Discord"));
  client.on("shardError", (error) => log.error({ error: serializeError(error) }, "Erro de shard"));
  client.on("warn", (message) => log.warn({ message }, "Aviso Discord.js"));

  process.on("unhandledRejection", (error) => log.error({ error: serializeError(error) }, "Unhandled rejection"));
  process.on("uncaughtException", (error) => log.fatal({ error: serializeError(error) }, "Uncaught exception"));

  return client;
}
