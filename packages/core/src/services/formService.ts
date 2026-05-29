import { ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ModalSubmitInteraction, TextChannel, EmbedBuilder } from "discord.js";
import { prisma } from "@neon/database";
import { childLogger } from "../logger/logger.js";

const log = childLogger("form-service");

export interface FormField {
  label: string;
  placeholder?: string;
  style: "SHORT" | "PARAGRAPH";
  required?: boolean;
}

export class FormService {
  async createModal(customId: string, title: string, fields: FormField[]) {
    const modal = new ModalBuilder()
      .setCustomId(customId)
      .setTitle(title);

    const rows = fields.map((field, index) => {
      const input = new TextInputBuilder()
        .setCustomId(`field_${index}`)
        .setLabel(field.label)
        .setPlaceholder(field.placeholder || "")
        .setStyle(field.style === "SHORT" ? TextInputStyle.Short : TextInputStyle.Paragraph)
        .setRequired(field.required ?? true);

      return new ActionRowBuilder<TextInputBuilder>().addComponents(input);
    });

    modal.addComponents(...rows);
    return modal;
  }

  async handleFormSubmit(interaction: ModalSubmitInteraction, logChannelId: string) {
    const fields = interaction.fields;
    const entries = Array.from({ length: 5 }, (_, i) => {
      try {
        return fields.getTextInputValue(`field_${i}`);
      } catch {
        return null;
      }
    }).filter(Boolean);

    const channel = interaction.guild?.channels.cache.get(logChannelId) as TextChannel;
    if (channel) {
      const embed = new EmbedBuilder()
        .setTitle(`📝 Novo Formulário: ${interaction.customId}`)
        .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
        .setColor("Blue")
        .setTimestamp();

      entries.forEach((value, index) => {
        embed.addFields({ name: `Pergunta ${index + 1}`, value: value || "Sem resposta" });
      });

      await channel.send({ embeds: [embed] });
      await interaction.reply({ content: "✅ Seu formulário foi enviado com sucesso!", ephemeral: true });
    } else {
      await interaction.reply({ content: "❌ Erro ao processar formulário: Canal de log não encontrado.", ephemeral: true });
    }
  }
}

export const formService = new FormService();
