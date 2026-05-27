import { EmbedBuilder } from "discord.js";

export const neonTheme = {
  color: 0xff2bd6,
  danger: 0xff385c,
  success: 0x34f5c5,
  warning: 0xffc857,
  footer: "Neon Community Suite",
  separator: "━━━━━━━━━━━━━━━━━━━━"
};

type PremiumEmbedOptions = {
  title: string;
  description?: string;
  variant?: "default" | "success" | "danger" | "warning";
  thumbnail?: string;
};

export function premiumEmbed(options: PremiumEmbedOptions) {
  const color =
    options.variant === "danger"
      ? neonTheme.danger
      : options.variant === "success"
        ? neonTheme.success
        : options.variant === "warning"
          ? neonTheme.warning
          : neonTheme.color;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`✦ ${options.title}`)
    .setDescription(options.description ? `${options.description}\n\n${neonTheme.separator}` : neonTheme.separator)
    .setFooter({ text: neonTheme.footer })
    .setTimestamp();

  if (options.thumbnail) embed.setThumbnail(options.thumbnail);
  return embed;
}
