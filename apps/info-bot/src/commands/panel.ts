import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { panelEmbed, requirePermission } from "@neon/core";

export const panelCommand = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Publica painéis informativos profissionais.")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo do painel")
        .setRequired(true)
        .addChoices(
          { name: "Boas-vindas", value: "welcome" },
          { name: "Links", value: "links" },
          { name: "Áreas", value: "areas" },
          { name: "Suporte", value: "support" },
          { name: "Migração", value: "migration" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await requirePermission(interaction.member, "panels.manage");
    const type = interaction.options.getString("tipo", true) as any;

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:SUPPORT").setLabel("Suporte").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:ROLE_RETURN").setLabel("Devolução").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId("ticket:MIGRATION").setLabel("Migração").setStyle(ButtonStyle.Secondary)
    );

    const areas = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("areas:select")
        .setPlaceholder("Selecione uma área")
        .addOptions(
          { label: "Suporte", value: "suporte" },
          { label: "Migração", value: "migracao" },
          { label: "Passatempo", value: "pastime" },
          { label: "Tellonym", value: "tellonym" }
        )
    );

    await interaction.reply({
      embeds: [
        panelEmbed({
          type,
          title: `Painel: ${type.charAt(0).toUpperCase() + type.slice(1)}`,
          description: "Central profissional da comunidade. Escolha uma opção abaixo para iniciar o fluxo correspondente com rastreabilidade completa."
        })
      ],
      components: type === "areas" ? [areas] : [buttons]
    });
  }
};
