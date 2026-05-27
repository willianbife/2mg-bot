import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { applyRoleAction, notificationEmbed, requirePermission, resolveMember } from "@neon/core";

export const grolesCommand = {
  data: new SlashCommandBuilder()
    .setName("groles")
    .setDescription("Gerencia cargos de usuários com auditoria profissional.")
    .addStringOption((option) =>
      option.setName("acao").setDescription("Adicionar ou remover").setRequired(true).addChoices(
        { name: "Adicionar", value: "add" },
        { name: "Remover", value: "remove" }
      )
    )
    .addStringOption((option) => option.setName("usuario").setDescription("Menção, ID ou nome/id").setRequired(true))
    .addRoleOption((option) => option.setName("cargo").setDescription("Cargo gerenciado").setRequired(true))
    .addStringOption((option) => option.setName("motivo").setDescription("Obrigatório ao remover").setMinLength(8)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "roles.manage");

    const action = interaction.options.getString("acao", true) as "add" | "remove";
    const targetInput = interaction.options.getString("usuario", true);
    const target = await resolveMember(interaction.guild, targetInput);
    const role = interaction.options.getRole("cargo", true);
    const reason = interaction.options.getString("motivo") ?? `Ação executada por ${interaction.user.tag}`;

    if (action === "remove" && reason.length < 8) {
      await interaction.editReply({ content: "Para remover cargo, informe um motivo com pelo menos 8 caracteres." });
      return;
    }

    await applyRoleAction({ executor: interaction.member, target, roles: [role as any], action, reason });

    await interaction.editReply({
      embeds: [
        notificationEmbed({
          type: action === "add" ? "success" : "warning",
          title: "Gerenciamento de Cargos",
          message: [
            `Usuário: ${target} (\`${target.id}\`)`,
            `Cargo: ${role}`,
            `Ação: **${action === "add" ? "Adicionado" : "Removido"}**`,
            `Motivo: ${reason}`
          ].join("\n")
        }).setThumbnail(interaction.guild.iconURL({ size: 256 }) ?? target.displayAvatarURL({ size: 256 }))
      ]
    });
  }
};
