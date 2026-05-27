import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const StatsEmbedSchema = z.object({
  type: z.enum(['voice_stats', 'role_history', 'user_stats']),
  data: z.record(z.union([z.string(), z.number()])),
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
    .setFooter({ text: `2mg » ${theme.footer}` })
    .setTimestamp();

  if (validated.userId) {
    embed.setDescription(`${theme.separators.sub} **Usuário:** <@${validated.userId}>${validated.period ? `\n${theme.separators.sub} **Período:** ${validated.period}` : ''}`);
  }

  const fields = Object.entries(validated.data).map(([key, value]) => ({
    name: `${theme.separators.bullet} ${key}`,
    value: String(value),
    inline: true
  }));

  embed.addFields(fields);

  return embed;
}
