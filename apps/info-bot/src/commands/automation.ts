import { ChatInputCommandInteraction, SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { automationService, temporaryCallService } from "@neon/core";

export const automationCommands = {
  data: new SlashCommandBuilder()
    .setName("automation")
    .setDescription("Configura automações do servidor")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
      sub.setName("welcome")
        .setDescription("Configura mensagens de boas-vindas")
        .addChannelOption(opt => opt.setName("channel").setDescription("Canal de boas-vindas").setRequired(true))
        .addStringOption(opt => opt.setName("message").setDescription("Mensagem (Use {user}, {guild}, etc)").setRequired(true))
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Habilitar/Desabilitar").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("autorole")
        .setDescription("Configura cargos automáticos")
        .addRoleOption(opt => opt.setName("role").setDescription("Cargo para adicionar").setRequired(true))
        .addBooleanOption(opt => opt.setName("enabled").setDescription("Habilitar/Desabilitar").setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName("call-generator")
        .setDescription("Configura canal gerador de calls temporárias")
        .addChannelOption(opt => opt.setName("channel").setDescription("Canal gerador").setRequired(true))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId!;

    if (subcommand === "welcome") {
      const channel = interaction.options.getChannel("channel", true);
      const message = interaction.options.getString("message", true);
      const enabled = interaction.options.getBoolean("enabled", true);

      await automationService.updateWelcomeConfig(guildId, {
        channelId: channel.id,
        message,
        enabled
      });

      await interaction.reply({
        content: `✅ Configuração de boas-vindas atualizada!\nCanal: <#${channel.id}>\nStatus: ${enabled ? "Ativado" : "Desativado"}`
      });
    }

    if (subcommand === "autorole") {
      const role = interaction.options.getRole("role", true);
      const enabled = interaction.options.getBoolean("enabled", true);

      await automationService.updateAutoRoleConfig(guildId, {
        roleId: role.id,
        enabled
      });

      await interaction.reply({
        content: `✅ Configuração de Auto Role atualizada!\nCargo: <@&${role.id}>\nStatus: ${enabled ? "Adicionado" : "Removido"}`
      });
    }

    if (subcommand === "call-generator") {
      const channel = interaction.options.getChannel("channel", true);
      
      await temporaryCallService.setGeneratorChannel(guildId, channel.id);

      await interaction.reply({
        content: `✅ Canal gerador de calls definido!\nCanal: <#${channel.id}>`
      });
    }
  }
};
