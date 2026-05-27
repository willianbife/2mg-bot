import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";
import { applyRoleAction, premiumEmbed, requirePermission, resolveMember } from "@neon/core";

export const grolesCommand = {
  data: new SlashCommandBuilder()
    .setName("groles")
    .setDescription("Gerencia um cargo de um usuario com auditoria e visual premium.")
    .addStringOption((option) =>
      option.setName("acao").setDescription("Adicionar ou remover").setRequired(true).addChoices(
        { name: "Adicionar", value: "add" },
        { name: "Remover", value: "remove" }
      )
    )
    .addStringOption((option) => option.setName("usuario").setDescription("Mencao, ID ou nome/id").setRequired(true))
    .addRoleOption((option) => option.setName("cargo").setDescription("Cargo gerenciado").setRequired(true))
    .addStringOption((option) => option.setName("motivo").setDescription("Obrigatorio apenas ao remover").setMinLength(8)),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !(interaction.member instanceof GuildMember)) return;
    await interaction.deferReply({ ephemeral: true });
    await requirePermission(interaction.member, "roles.manage");

    const action = interaction.options.getString("acao", true) as "add" | "remove";
    const targetInput = interaction.options.getString("usuario", true);
    const target = await resolveMember(interaction.guild, targetInput);
    const role = interaction.options.getRole("cargo", true);
    const reason = interaction.options.getString("motivo") ?? `Cargo adicionado por ${interaction.user.tag}`;

    if (action === "remove" && reason.length < 8) {
      await interaction.editReply({ content: "Para remover cargo, informe um motivo com pelo menos 8 caracteres." });
      return;
    }

    await applyRoleAction({ executor: interaction.member, target, roles: [role as any], action, reason });

    await interaction.editReply({
      embeds: [
        premiumEmbed({
          title: `Gerenciamento de Cargos | ${interaction.guild.name}`,
          variant: action === "add" ? "success" : "warning",
          thumbnail: interaction.guild.iconURL({ size: 256 }) ?? target.displayAvatarURL({ size: 256 }),
          description: [
            `Ola, ${interaction.user}`,
            `Voce esta gerenciando cargos em **${interaction.guild.name}**`,
            "",
            `**Usuario:** ${target} \`${target.id}\``,
            `**Cargo:** ${role}`,
            `**Acao:** ${action === "add" ? "Adicionar" : "Remover"}`,
            `**Membros com o cargo:** ${"members" in role ? role.members.size : 0}`,
            `**Motivo:** ${reason}`,
            "",
            action === "add" ? "**Status:** Cargo adicionado com sucesso." : "**Status:** Cargo removido com sucesso."
          ].join("\n")
        })
      ]
    });
  }
};
