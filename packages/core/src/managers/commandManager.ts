import { ChatInputCommandInteraction, Collection, Events, REST, Routes } from "discord.js";
import { env } from "../config/env.js";
import { childLogger } from "../logger/logger.js";

export type SlashCommand = {
  data: {
    name: string;
    toJSON(): unknown;
  };
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
};

export class CommandManager {
  private readonly commands = new Collection<string, SlashCommand>();
  private readonly log = childLogger("commands");

  register(command: SlashCommand) {
    this.commands.set(command.data.name, command);
    return this;
  }

  bind(client: { on: Function }) {
    client.on(Events.InteractionCreate, async (interaction: unknown) => {
      if (!(interaction instanceof ChatInputCommandInteraction)) return;
      const command = this.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        const normalized = normalizeError(error);
        this.log.error({ error: normalized, command: interaction.commandName }, "Erro em comando slash");
        const detail = env.NODE_ENV === "development" && normalized.message ? `\n\nDetalhe dev: \`${normalized.message.slice(0, 160)}\`` : "";
        const content = `Ocorreu um erro ao executar este comando. A acao foi registrada para auditoria.${detail}`;
        if (interaction.replied || interaction.deferred) await interaction.followUp({ content, ephemeral: true });
        else await interaction.reply({ content, ephemeral: true });
      }
    });
  }

  async deploy(clientId: string, token: string, guildId?: string) {
    const rest = new REST({ version: "10" }).setToken(token);
    const body = this.commands.map((command) => command.data.toJSON());
    const route = guildId ? Routes.applicationGuildCommands(clientId, guildId) : Routes.applicationCommands(clientId);
    await rest.put(route, { body });
    this.log.info({ count: body.length, guildId }, "Comandos publicados");
  }

  toJSON() {
    return this.commands.map((command) => command.data.toJSON());
  }
}

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code
    };
  }
  return { message: String(error) };
}
