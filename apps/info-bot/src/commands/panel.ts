import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  StringSelectMenuBuilder
} from "discord.js";
import { premiumEmbed, requirePermission } from "@neon/core";

export const panelCommand = {
  data: new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Publica paineis informativos premium.")
    .addStringOption((option) =>
      option
        .setName("tipo")
        .setDescription("Tipo do painel")
        .setRequired(true)
        .addChoices(
          { name: "Boas-vindas", value: "welcome" },
          { name: "Links", value: "links" },
          { name: "Areas", value: "areas" },
          { name: "Suporte", value: "support" },
          { name: "Migracao", value: "migration" }
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guild || !interaction.inCachedGuild()) return;
    await requirePermission(interaction.member, "panels.manage");
    const type = interaction.options.getString("tipo", true);

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId("ticket:SUPPORT").setLabel("Suporte").setStyle(ButtonStyle.Secondary).setEmoji("🎫"),
      new ButtonBuilder().setCustomId("ticket:ROLE_RETURN").setLabel("Devolucao").setStyle(ButtonStyle.Secondary).setEmoji("💠"),
      new ButtonBuilder().setCustomId("ticket:MIGRATION").setLabel("Migracao").setStyle(ButtonStyle.Secondary).setEmoji("🚀")
    );

    const areas = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("areas:select")
        .setPlaceholder("Selecione uma area")
        .addOptions(
          { label: "Suporte", value: "suporte", emoji: "🎧" },
          { label: "Migracao", value: "migracao", emoji: "🚀" },
          { label: "Pastime", value: "pastime", emoji: "✨" },
          { label: "Tellonym", value: "tellonym", emoji: "💬" }
        )
    );

    await interaction.reply({
      embeds: [
        premiumEmbed({
          title: `Painel ${type}`,
          description: "Central premium da comunidade. Escolha uma opcao abaixo para iniciar o fluxo correto com logs, cooldown e auditoria."
        })
      ],
      components: type === "areas" ? [areas] : [buttons]
    });
  }
};
