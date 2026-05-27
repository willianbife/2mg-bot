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

  return new EmbedBuilder()
    .setColor(colorMap[validated.type])
    .setTitle(`${theme.separators.main} ${validated.title}`)
    .setDescription(`\n${validated.message}`)
    .setFooter({ text: `2mg » ${theme.footer}` })
    .setTimestamp(validated.timestamp || new Date());
}
