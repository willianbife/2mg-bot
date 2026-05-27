import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, premiumEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const securityCommand = {
  data: new SlashCommandBuilder()
    .setName("security")
    .setDescription("Status e whitelist do sistema de seguranca.")
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra o status geral."))
    .addSubcommand((sub) => sub.setName("whitelist").setDescription("Adiciona usuario a whitelist").addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(true)))
    .addSubcommand((sub) => sub.setName("unwhitelist").setDescription("Remove usuario da whitelist").addUserOption((option) => option.setName("usuario").setDescription("Usuario").setRequired(true))),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.config");

    const config = await getSecurityConfig(interaction.guild);
    const sub = interaction.options.getSubcommand();
    const user = interaction.options.getUser("usuario");

    if (sub === "whitelist" && user) {
      await updateSecurityConfig(interaction.guild, { whitelistedUsers: [...new Set([...config.whitelistedUsers, user.id])] }, interaction.user.id);
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Whitelist atualizada", variant: "success", description: `${user} foi adicionado a whitelist de seguranca.` })] });
      return;
    }

    if (sub === "unwhitelist" && user) {
      await updateSecurityConfig(interaction.guild, { whitelistedUsers: config.whitelistedUsers.filter((id) => id !== user.id) }, interaction.user.id);
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Whitelist atualizada", variant: "warning", description: `${user} foi removido da whitelist de seguranca.` })] });
      return;
    }

    await interaction.editReply({
      embeds: [
        premiumEmbed({
          title: "Status de seguranca",
          description: [
            `Anti-raid: **${config.antiRaid.enabled ? "ativo" : "inativo"}**`,
            `Anti-nuke: **${config.antiNuke.enabled ? "ativo" : "inativo"}**`,
            `Anti URL: **${config.antiUrl.enabled ? "ativo" : "inativo"}**`,
            `Logs: **${config.logs.enabled ? "ativo" : "inativo"}**`,
            `Whitelist: **${config.whitelistedUsers.length} usuario(s)**`,
            `Canais ignorados: **${config.ignoredChannels.length}**`,
            `Cargos ignorados: **${config.ignoredRoles.length}**`
          ].join("\n")
        })
      ]
    });
  }
};
