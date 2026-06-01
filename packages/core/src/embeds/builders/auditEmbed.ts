import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const AuditEmbedSchema = z.object({
  action: z.enum(['ban', 'kick', 'mute', 'role_grant', 'role_remove', 'warn', 'antiraid_trigger']),
  moderator: z.string(),
  target: z.string(),
  reason: z.string().optional(),
  duration: z.string().optional(),
  timestamp: z.date()
});

export type AuditEmbedOptions = z.infer<typeof AuditEmbedSchema>;

export function auditEmbed(options: AuditEmbedOptions): EmbedBuilder {
  const validated = AuditEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  
  const colorMap: Record<AuditEmbedOptions['action'], number> = {
    ban: theme.colors.danger,
    kick: theme.colors.warning,
    mute: theme.colors.warning,
    role_grant: theme.colors.success,
    role_remove: theme.colors.neutral,
    warn: theme.colors.accent,
    antiraid_trigger: theme.colors.danger,
  };

  const actionLabels: Record<AuditEmbedOptions['action'], string> = {
    ban: 'Banimento',
    kick: 'Expulsão',
    mute: 'Silenciamento',
    role_grant: 'Cargo Adicionado',
    role_remove: 'Cargo Removido',
    warn: 'Aviso',
    antiraid_trigger: 'Anti-Raid Ativado',
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[validated.action])
    .setTitle(`${theme.separators.main} Auditoria — ${actionLabels[validated.action]}`)
    .setFooter({ text: `2mg » Community Suite` })
    .setTimestamp(validated.timestamp);

  embed.addFields(
    { name: 'Alvo', value: validated.target, inline: true },
    { name: 'Moderador', value: validated.moderator, inline: true },
  );

  if (validated.reason) {
    embed.addFields({ name: 'Motivo', value: validated.reason, inline: false });
  }

  if (validated.duration) {
    embed.addFields({ name: 'Duração', value: validated.duration, inline: true });
  }

  return embed;
}
