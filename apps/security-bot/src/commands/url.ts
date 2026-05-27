import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, notificationEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const urlCommand = {
  data: new SlashCommandBuilder()
    .setName("url")
    .setDescription("Gerencia domínios bloqueados pelo anti-URL profissional.")
    .addSubcommand((sub) => sub.setName("bloquear").setDescription("Bloqueia um domínio").addStringOption((option) => option.setName("dominio").setDescription("Domínio").setRequired(true)))
    .addSubcommand((sub) => sub.setName("desbloquear").setDescription("Remove um domínio bloqueado").addStringOption((option) => option.setName("dominio").setDescription("Domínio").setRequired(true)))
    .addSubcommand((sub) => sub.setName("lista").setDescription("Lista domínios bloqueados e permitidos.")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.config");

    const config = await getSecurityConfig(interaction.guild);
    const sub = interaction.options.getSubcommand();
    const domain = interaction.options.getString("dominio")?.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

    if (sub === "bloquear" && domain) {
      const blockedDomains = [...new Set([...config.antiUrl.blockedDomains, domain])];
      await updateSecurityConfig(interaction.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, interaction.user.id);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Domínio Bloqueado",
            message: `O domínio **${domain}** foi adicionado à lista de bloqueio.`
          })
        ]
      });
      return;
    }

    if (sub === "desbloquear" && domain) {
      const blockedDomains = config.antiUrl.blockedDomains.filter((item) => item !== domain);
      await updateSecurityConfig(interaction.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, interaction.user.id);
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "warning",
            title: "Domínio Desbloqueado",
            message: `O domínio **${domain}** foi removido da lista de bloqueio.`
          })
        ]
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Lista Anti-URL",
          message: `Ativo: **${config.antiUrl.enabled ? "Sim" : "Não"}**\n\n**Bloqueados:**\n${config.antiUrl.blockedDomains.map((item) => `- ${item}`).join("\n") || "`Vazio`"}\n\n**Permitidos:**\n${config.antiUrl.allowedDomains.map((item) => `- ${item}`).join("\n") || "`Vazio`"}`
        })
      ]
    });
  }
};
