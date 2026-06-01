import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const StatsEmbedSchema = z.object({
  type: z.enum(['voice_stats', 'role_history', 'user_stats']),
  fields: z.array(z.object({
    label: z.string(),
    value: z.string(),
    inline: z.boolean().optional().default(true),
  })),
  userId: z.string().optional(),
  period: z.string().optional()
});

export type StatsEmbedOptions = z.infer<typeof StatsEmbedSchema>;

export function statsEmbed(options: StatsEmbedOptions): EmbedBuilder {
  const validated = StatsEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const titleMap: Record<StatsEmbedOptions['type'], string> = {
    voice_stats: 'Estatísticas de Voz',
    role_history: 'Histórico de Cargos',
    user_stats: 'Estatísticas de Usuário',
  };

  const embed = new EmbedBuilder()
    .setColor(theme.colors.primary)
    .setTitle(`${theme.separators.main} ${titleMap[validated.type]}`)
    .setFooter({ text: `2mg » Community Suite` })
    .setTimestamp();

  if (validated.userId) {
    const descParts = [`${theme.separators.sub} **Usuário:** <@${validated.userId}>`];
    if (validated.period) descParts.push(`${theme.separators.sub} **Período:** ${validated.period}`);
    embed.setDescription(descParts.join('\n'));
  }

  embed.addFields(validated.fields.map(f => ({
    name: f.label,
    value: f.value,
    inline: f.inline ?? true,
  })));

  return embed;
}
