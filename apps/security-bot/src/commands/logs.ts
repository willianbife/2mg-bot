import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, logCategories, notificationEmbed, requirePermission, sendSecurityLog, updateSecurityConfig } from "@neon/core";

export const logsCommand = {
  data: new SlashCommandBuilder()
    .setName("logs")
    .setDescription("Configura e testa os logs de segurança profissionais.")
    .addSubcommand((sub) =>
      sub
        .setName("configurar")
        .setDescription("Define o canal de uma categoria de log.")
        .addStringOption((option) => option.setName("categoria").setDescription("Categoria").setRequired(true).addChoices(...logCategories.map((category) => ({ name: category, value: category }))))
        .addChannelOption((option) => option.setName("canal").setDescription("Canal de log").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement).setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra a configuração atual dos logs."))
    .addSubcommand((sub) =>
      sub
        .setName("testar")
        .setDescription("Envia um teste para uma categoria.")
        .addStringOption((option) => option.setName("categoria").setDescription("Categoria").setRequired(true).addChoices(...logCategories.map((category) => ({ name: category, value: category }))))
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.config");

    const sub = interaction.options.getSubcommand();
    if (sub === "configurar") {
      const category = interaction.options.getString("categoria", true) as (typeof logCategories)[number];
      const channel = interaction.options.getChannel("canal", true);
      const current = await getSecurityConfig(interaction.guild);
      await updateSecurityConfig(interaction.guild, { logs: { ...current.logs, channels: { ...current.logs.channels, [category]: channel.id } } }, interaction.user.id);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Log Configurado",
            message: `Categoria: **${category}**\nCanal: <#${channel.id}>`
          })
        ]
      });
      return;
    }

    if (sub === "status") {
      const config = await getSecurityConfig(interaction.guild);
      const lines = logCategories.map((category) => `**${category}:** ${config.logs.channels[category] ? `<#${config.logs.channels[category]}>` : "`Não configurado`"}`);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "info",
            title: "Status dos Logs",
            message: `Ativo: **${config.logs.enabled ? "Sim" : "Não"}**\n${lines.join("\n")}`
          })
        ]
      });
      return;
    }

    const category = interaction.options.getString("categoria", true) as (typeof logCategories)[number];
    await sendSecurityLog({
      guild: interaction.guild,
      category,
      actorId: interaction.user.id,
      actionTaken: "teste",
      embed: notificationEmbed({
        type: "success",
        title: "Teste de Log",
        message: `A categoria **${category}** está operando corretamente. Teste solicitado por ${interaction.user}.`
      })
    });
    await interaction.editReply({ content: `Teste enviado com sucesso para **${category}**.` });
  }
};
