import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const TicketEmbedSchema = z.object({
  status: z.enum(['opened', 'pending', 'resolved', 'closed']),
  title: z.string(),
  ticketId: z.string(),
  userId: z.string(),
  timestamp: z.date(),
  reason: z.string().optional(),
  metadata: z.record(z.string()).optional()
});

export type TicketEmbedOptions = z.infer<typeof TicketEmbedSchema>;

export function ticketEmbed(options: TicketEmbedOptions): EmbedBuilder {
  const validated = TicketEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const colorMap: Record<TicketEmbedOptions['status'], number> = {
    opened: theme.colors.success,
    pending: theme.colors.warning,
    resolved: theme.colors.info,
    closed: theme.colors.danger,
  };

  const statusLabel: Record<TicketEmbedOptions['status'], string> = {
    opened: 'Aberto',
    pending: 'Pendente',
    resolved: 'Resolvido',
    closed: 'Fechado',
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[validated.status])
    .setTitle(`${theme.separators.main} Ticket — ${validated.title}`)
    .setFooter({ text: `2mg » Community Suite` })
    .setTimestamp(validated.timestamp);

  embed.addFields(
    { name: 'ID', value: `\`${validated.ticketId}\``, inline: true },
    { name: 'Usuário', value: `<@${validated.userId}>`, inline: true },
    { name: 'Status', value: statusLabel[validated.status], inline: true },
  );

  if (validated.reason) {
    embed.addFields({ name: 'Motivo', value: validated.reason, inline: false });
  }

  if (validated.metadata) {
    for (const [key, value] of Object.entries(validated.metadata)) {
      embed.addFields({ name: key, value: String(value), inline: true });
    }
  }

  return embed;
}
