import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const NotificationEmbedSchema = z.object({
  type: z.enum(['success', 'info', 'warning', 'pending', 'danger', 'neutral']),
  title: z.string(),
  message: z.string(),
  timestamp: z.date().optional()
});

export type NotificationEmbedOptions = z.infer<typeof NotificationEmbedSchema>;

export function notificationEmbed(options: NotificationEmbedOptions): EmbedBuilder {
  const validated = NotificationEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const colorMap: Record<NotificationEmbedOptions['type'], number> = {
    success: theme.colors.success,
    info: theme.colors.info,
    warning: theme.colors.warning,
    pending: theme.colors.neutral,
    danger: theme.colors.danger,
    neutral: theme.colors.neutral,
  };

  const iconMap: Record<NotificationEmbedOptions['type'], string> = {
    success: '▸ Sucesso',
    info: '▸ Informação',
    warning: '▸ Atenção',
    pending: '▸ Pendente',
    danger: '▸ Erro',
    neutral: '▸ Aviso',
  };

  return new EmbedBuilder()
    .setColor(colorMap[validated.type])
    .setTitle(`${iconMap[validated.type]} — ${validated.title}`)
    .setDescription(validated.message)
    .setFooter({ text: `2mg » Community Suite` })
    .setTimestamp(validated.timestamp || new Date());
}
