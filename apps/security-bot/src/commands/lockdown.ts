import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";
import { lockGuild, premiumEmbed, requirePermission, sendSecurityLog, unlockGuild } from "@neon/core";

async function runLock(interaction: ChatInputCommandInteraction, locked: boolean, panic = false) {
  if (!interaction.guild || !interaction.inCachedGuild()) return;
  await interaction.deferReply({ ephemeral: true });
  await requirePermission(interaction.member, "security.lockdown");
  const reason = interaction.options.getString("motivo") ?? (panic ? "Panic acionado" : locked ? "Lockdown manual" : "Unlockdown manual");
  if (locked) await lockGuild(interaction.guild, reason);
  else await unlockGuild(interaction.guild, reason);
  await sendSecurityLog({
    guild: interaction.guild,
    category: "url",
    severity: panic ? "CRITICAL" : "HIGH",
    actorId: interaction.user.id,
    actionTaken: locked ? "lockdown" : "unlockdown",
    reason,
    embed: premiumEmbed({ title: panic ? "Panic acionado" : locked ? "Lockdown ativado" : "Lockdown removido", variant: locked ? "danger" : "success", description: `Executor: ${interaction.user}\nMotivo: ${reason}` })
  });
  await interaction.editReply({ embeds: [premiumEmbed({ title: locked ? "Servidor bloqueado" : "Servidor desbloqueado", variant: locked ? "danger" : "success", description: `Motivo: ${reason}` })] });
}

export const lockdownCommand = {
  data: new SlashCommandBuilder().setName("lockdown").setDescription("Bloqueia envio de mensagens e entrada em calls.").addStringOption((option) => option.setName("motivo").setDescription("Motivo")),
  execute: (interaction: ChatInputCommandInteraction) => runLock(interaction, true)
};

export const unlockdownCommand = {
  data: new SlashCommandBuilder().setName("unlockdown").setDescription("Remove o lockdown aplicado pelo bot.").addStringOption((option) => option.setName("motivo").setDescription("Motivo")),
  execute: (interaction: ChatInputCommandInteraction) => runLock(interaction, false)
};

export const panicCommand = {
  data: new SlashCommandBuilder().setName("panic").setDescription("Aciona lockdown emergencial e registra alerta critico.").addStringOption((option) => option.setName("motivo").setDescription("Motivo")),
  execute: (interaction: ChatInputCommandInteraction) => runLock(interaction, true, true)
};
