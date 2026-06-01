import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const PanelEmbedSchema = z.object({
  type: z.enum(['welcome', 'links', 'areas', 'support', 'migration']),
  title: z.string(),
  description: z.string().optional(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional()
  })).optional()
});

export type PanelEmbedOptions = z.infer<typeof PanelEmbedSchema>;

export function panelEmbed(options: PanelEmbedOptions): EmbedBuilder {
  const validated = PanelEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const colorMap: Record<PanelEmbedOptions['type'], number> = {
    welcome: theme.colors.primary,
    links: theme.colors.secondary,
    areas: theme.colors.info,
    support: theme.colors.accent,
    migration: theme.colors.warning,
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[validated.type])
    .setTitle(`${theme.separators.main} ${validated.title}`)
    .setFooter({ text: `2mg » Community Suite` })
    .setTimestamp();

  if (validated.description) {
    embed.setDescription(validated.description);
  }

  if (validated.fields) {
    embed.addFields(validated.fields);
  }

  return embed;
}
