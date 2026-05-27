import { EmbedBuilder } from "discord.js";
import { z } from "zod";
import { getCurrentTheme } from "../theme.js";

export const PremiumEmbedSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  variant: z.enum(["default", "success", "warning", "danger", "info"]).optional(),
  fields: z.array(z.object({
    name: z.string(),
    value: z.string(),
    inline: z.boolean().optional()
  })).optional(),
  footer: z.string().optional(),
  timestamp: z.date().optional()
});

export type PremiumEmbedOptions = z.infer<typeof PremiumEmbedSchema>;

export function premiumEmbed(options: PremiumEmbedOptions): EmbedBuilder {
  const validated = PremiumEmbedSchema.parse(options);
  const { theme } = getCurrentTheme();
  const variant = validated.variant ?? "default";

  const colorMap: Record<NonNullable<PremiumEmbedOptions["variant"]>, number> = {
    default: theme.colors.primary,
    success: theme.colors.success,
    warning: theme.colors.warning,
    danger: theme.colors.danger,
    info: theme.colors.info
  };

  const embed = new EmbedBuilder()
    .setColor(colorMap[variant])
    .setTitle(validated.title)
    .setFooter({ text: validated.footer ?? `2mg - ${theme.footer}` })
    .setTimestamp(validated.timestamp ?? new Date());

  if (validated.description) {
    embed.setDescription(validated.description);
  }

  if (validated.fields?.length) {
    embed.addFields(validated.fields);
  }

  return embed;
}
