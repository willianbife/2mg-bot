import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, premiumEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const antiraidCommand = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("Configura o anti-raid do servidor.")
    .addSubcommand((sub) =>
      sub
        .setName("configurar")
        .setDescription("Atualiza limites e acoes do anti-raid.")
        .addIntegerOption((option) => option.setName("limite_entradas").setDescription("Entradas permitidas na janela").setMinValue(2).setMaxValue(100))
        .addIntegerOption((option) => option.setName("janela_segundos").setDescription("Janela de deteccao").setMinValue(10).setMaxValue(600))
        .addIntegerOption((option) => option.setName("dias_conta_nova").setDescription("Conta com menos dias que isso e suspeita").setMinValue(1).setMaxValue(90))
        .addRoleOption((option) => option.setName("cargo_quarentena").setDescription("Cargo aplicado em contas suspeitas"))
        .addChannelOption((option) => option.setName("canal_staff").setDescription("Canal para alertas").addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement))
        .addBooleanOption((option) => option.setName("lockdown").setDescription("Ativar lockdown em raid massiva"))
    )
    .addSubcommand((sub) => sub.setName("status").setDescription("Mostra status do anti-raid."))
    .addSubcommand((sub) => sub.setName("ativar").setDescription("Ativa o anti-raid."))
    .addSubcommand((sub) => sub.setName("desativar").setDescription("Desativa o anti-raid.")),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "security.config");

    const sub = interaction.options.getSubcommand();
    const current = await getSecurityConfig(interaction.guild);
    if (sub === "ativar" || sub === "desativar") {
      const enabled = sub === "ativar";
      await updateSecurityConfig(interaction.guild, { antiRaid: { ...current.antiRaid, enabled } }, interaction.user.id);
      await interaction.editReply({ embeds: [premiumEmbed({ title: `Anti-raid ${enabled ? "ativado" : "desativado"}`, variant: enabled ? "success" : "warning" })] });
      return;
    }

    if (sub === "configurar") {
      const antiRaid = {
        ...current.antiRaid,
        joinLimit: interaction.options.getInteger("limite_entradas") ?? current.antiRaid.joinLimit,
        joinWindowSeconds: interaction.options.getInteger("janela_segundos") ?? current.antiRaid.joinWindowSeconds,
        newAccountDays: interaction.options.getInteger("dias_conta_nova") ?? current.antiRaid.newAccountDays,
        quarantineRoleId: interaction.options.getRole("cargo_quarentena")?.id ?? current.antiRaid.quarantineRoleId,
        staffChannelId: interaction.options.getChannel("canal_staff")?.id ?? current.antiRaid.staffChannelId,
        lockdownOnRaid: interaction.options.getBoolean("lockdown") ?? current.antiRaid.lockdownOnRaid
      };
      await updateSecurityConfig(interaction.guild, { antiRaid }, interaction.user.id);
      await interaction.editReply({ embeds: [premiumEmbed({ title: "Anti-raid configurado", variant: "success", description: renderStatus(antiRaid) })] });
      return;
    }

    await interaction.editReply({ embeds: [premiumEmbed({ title: "Status do anti-raid", description: renderStatus(current.antiRaid) })] });
  }
};

function renderStatus(antiRaid: Awaited<ReturnType<typeof getSecurityConfig>>["antiRaid"]) {
  return [
    `Ativo: **${antiRaid.enabled ? "sim" : "nao"}**`,
    `Limite: **${antiRaid.joinLimit} entradas / ${antiRaid.joinWindowSeconds}s**`,
    `Conta nova: **${antiRaid.newAccountDays} dias**`,
    `Quarentena: ${antiRaid.quarantineRoleId ? `<@&${antiRaid.quarantineRoleId}>` : "`nao configurado`"}`,
    `Alerta staff: ${antiRaid.staffChannelId ? `<#${antiRaid.staffChannelId}>` : "`nao configurado`"}`,
    `Lockdown: **${antiRaid.lockdownOnRaid ? "sim" : "nao"}**`
  ].join("\n");
}
