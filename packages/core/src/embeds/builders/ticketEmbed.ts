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

  const embed = new EmbedBuilder()
    .setColor(colorMap[validated.status])
    .setTitle(`${theme.separators.main} Ticket: ${validated.title}`)
    .setDescription(`\n${theme.separators.sub} **ID:** \`${validated.ticketId}\`\n${theme.separators.sub} **Usuário:** <@${validated.userId}>`)
    .setFooter({ text: `2mg » ${theme.footer}` })
    .setTimestamp(validated.timestamp);

  if (validated.reason) {
    embed.addFields({ name: `${theme.separators.bullet} Motivo`, value: validated.reason });
  }

  if (validated.metadata) {
    const metaStr = Object.entries(validated.metadata)
      .map(([key, value]) => `${theme.separators.bullet} **${key}:** ${value}`)
      .join('\n');
    embed.addFields({ name: `${theme.separators.bullet} Informações Adicionais`, value: metaStr });
  }

  return embed;
}
