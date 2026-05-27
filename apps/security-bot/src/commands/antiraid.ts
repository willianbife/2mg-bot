import { ChannelType, ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { getSecurityConfig, notificationEmbed, requirePermission, updateSecurityConfig } from "@neon/core";

export const antiraidCommand = {
  data: new SlashCommandBuilder()
    .setName("antiraid")
    .setDescription("Configura o anti-raid profissional do servidor.")
    .addSubcommand((sub) =>
      sub
        .setName("configurar")
        .setDescription("Atualiza limites e ações do anti-raid.")
        .addIntegerOption((option) => option.setName("limite_entradas").setDescription("Entradas permitidas na janela").setMinValue(2).setMaxValue(100))
        .addIntegerOption((option) => option.setName("janela_segundos").setDescription("Janela de detecção").setMinValue(10).setMaxValue(600))
        .addIntegerOption((option) => option.setName("dias_conta_nova").setDescription("Conta com menos dias que isso é suspeita").setMinValue(1).setMaxValue(90))
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
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: enabled ? "success" : "warning",
            title: `Anti-raid ${enabled ? "Ativado" : "Desativado"}`,
            message: `O sistema de anti-raid foi ${enabled ? "habilitado" : "desabilitado"} com êxito.`
          })
        ]
      });
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
      await interaction.editReply({
        embeds: [
          notificationEmbed({
            type: "success",
            title: "Configuração Atualizada",
            message: renderStatus(antiRaid)
          })
        ]
      });
      return;
    }

    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: "info",
          title: "Status do Anti-raid",
          message: renderStatus(current.antiRaid)
        })
      ]
    });
  }
};

function renderStatus(antiRaid: Awaited<ReturnType<typeof getSecurityConfig>>["antiRaid"]) {
  return [
    `Ativo: **${antiRaid.enabled ? "Sim" : "Não"}**`,
    `Limite: **${antiRaid.joinLimit} entradas / ${antiRaid.joinWindowSeconds}s**`,
    `Conta nova: **${antiRaid.newAccountDays} dias**`,
    `Quarentena: ${antiRaid.quarantineRoleId ? `<@&${antiRaid.quarantineRoleId}>` : "`Não configurado`"}`,
    `Alerta staff: ${antiRaid.staffChannelId ? `<#${antiRaid.staffChannelId}>` : "`Não configurado`"}`,
    `Lockdown: **${antiRaid.lockdownOnRaid ? "Sim" : "Não"}**`
  ].join("\n");
}
