import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, premiumEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const urlCommand = {
  data: new SlashCommandBuilder()
    .setName("url")
    .setDescription("Gerencia dominios bloqueados pelo anti URL.")
    .addSubcommand((sub) => sub.setName("bloquear").setDescription("Bloqueia um dominio").addStringOption((option) => option.setName("dominio").setDescription("Dominio").setRequired(true)))
    .addSubcommand((sub) => sub.setName("desbloquear").setDescription("Remove um dominio bloqueado").addStringOption((option) => option.setName("dominio").setDescription("Dominio").setRequired(true)))
    .addSubcommand((sub) => sub.setName("lista").setDescription("Lista dominios bloqueados e permitidos.")),

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
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Dominio bloqueado", variant: "success", description: `Dominio: **${domain}**` })] });
      return;
    }

    if (sub === "desbloquear" && domain) {
      const blockedDomains = config.antiUrl.blockedDomains.filter((item) => item !== domain);
      await updateSecurityConfig(interaction.guild, { antiUrl: { ...config.antiUrl, blockedDomains } }, interaction.user.id);
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Dominio desbloqueado", variant: "warning", description: `Dominio: **${domain}**` })] });
      return;
    }

    await interaction.editReply({
      embeds: [
        premiumEmbed({
          title: "Lista anti URL",
          description: `Ativo: **${config.antiUrl.enabled ? "sim" : "nao"}**\nBloqueados:\n${config.antiUrl.blockedDomains.map((item) => `- ${item}`).join("\n") || "`vazio`"}\n\nPermitidos:\n${config.antiUrl.allowedDomains.map((item) => `- ${item}`).join("\n") || "`vazio`"}`
        })
      ]
    });
  }
};
