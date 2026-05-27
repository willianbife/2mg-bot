import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, notificationEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const securityCommand = {
  data: new SlashCommandBuilder()
    .setName("security")
    .setDescription("Status e whitelist do sistema de segurança profissional.")
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra o status geral."))
    .addSubcommand((sub) => sub.setName("whitelist").setDescription("Adiciona usuário à whitelist").addUserOption((option) => option.setName("usuario").setDescription("Usuário").setRequired(true)))
    .addSubcommand((sub) => sub.setName("unwhitelist").setDescription("Remove usuário da whitelist").addUserOption((option) => option.setName("usuario").setDescription("Usuário").setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.config");

    const config = await getSecurityConfig(interaction.guild);
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("usuario");

    if (sub === "whitelist" && user) {
      await updateSecurityConfig(interaction.guild, { whitelistedUsers: [...new Set([...config.whitelistedUsers, user.id])] }, interaction.user.id);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Whitelist Atualizada",
            message: `${user} foi adicionado à lista de confiança.`
          })
        ]
      });
      return;
    }

    if (sub === "unwhitelist" && user) {
      await updateSecurityConfig(interaction.guild, { whitelistedUsers: config.whitelistedUsers.filter((id) => id !== user.id) }, interaction.user.id);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "warning",
            title: "Whitelist Atualizada",
            message: `${user} foi removido da lista de confiança.`
          })
        ]
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Status de Segurança",
          message: [
            `Anti-raid: **${config.antiRaid.enabled ? "Ativo" : "Inativo"}**`,
            `Anti-nuke: **${config.antiNuke.enabled ? "Ativo" : "Inativo"}**`,
            `Anti-URL: **${config.antiUrl.enabled ? "Ativo" : "Inativo"}**`,
            `Logs: **${config.logs.enabled ? "Ativo" : "Inativo"}**`,
            `Whitelist: **${config.whitelistedUsers.length} usuário(s)**`,
            `Canais ignorados: **${config.ignoredChannels.length}**`,
            `Cargos ignorados: **${config.ignoredRoles.length}**`
          ].join("\n")
        })
      ]
    });
  }
};
