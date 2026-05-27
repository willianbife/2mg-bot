import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const ErrorEmbedSchema = z.object({
  code: z.string(),
  message: z.string(),
  suggestion: z.string().optional(),
  timestamp: z.date().optional()
});

export type ErrorEmbedOptions = z.infer<typeof ErrorEmbedSchema>;

export function errorEmbed(options: ErrorEmbedOptions): EmbedBuilder {
  const validated = ErrorEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const embed = new EmbedBuilder()
    .setColor(theme.colors.danger)
    .setTitle(`${theme.separators.main} Erro: ${validated.code}`)
    .setDescription(`\n${validated.message}`)
    .setFooter({ text: `2mg » ${theme.footer}` })
    .setTimestamp(validated.timestamp || new Date());

  if (validated.suggestion) {
    embed.addFields({ name: `${theme.separators.bullet} Sugestão`, value: validated.suggestion });
  }

  return embed;
}
