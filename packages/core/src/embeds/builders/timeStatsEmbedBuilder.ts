import { EmbedBuilder, AttachmentBuilder } from 'discord.js';
import { theme2mg, separators } from '../theme.js';
import { generateCanvasImage } from '../utils/canvasGenerator.js';
import { z } from 'zod';

export const TimeStatsDataSchema = z.object({
  userId: z.string(),
  username: z.string(),
  globalName: z.string(),
  userTag: z.string(),
  avatarURL: z.string().url(),
  rank: z.string(),
  totalTime: z.string(),
  currentWeek: z.object({
    period: z.string(),
    accumulated: z.string(),
    callTime: z.string(),
    mutedTime: z.string(),
  }),
  previousWeek: z.object({
    period: z.string(),
    callTime: z.string(),
    mutedTime: z.string(),
  }),
  serverName: z.string(),
  guildId: z.string(),
});

export type TimeStatsData = z.infer<typeof TimeStatsDataSchema>;

export async function timeStatsEmbedBuilder(
  data: TimeStatsData,
  options?: { imageBuffer?: Buffer; theme?: string }
): Promise<{
  embeds: EmbedBuilder[];
  files?: AttachmentBuilder[];
}> {
  // 1. Validar dados
  const validData = TimeStatsDataSchema.parse(data);

  // 2. Gerar imagem (se não passou buffer)
  let imageBuffer = options?.imageBuffer;
  if (!imageBuffer) {
    imageBuffer = await generateCanvasImage(validData);
  }

  // 3. Salvar imagem como attachment
  const imageAttachment = new AttachmentBuilder(imageBuffer, {
    name: `stats-${validData.userId}.png`,
  });

  // 4. Criar embed com a imagem
  const embed = new EmbedBuilder()
    .setColor(theme2mg.colors.primary)
    .setImage(`attachment://stats-${validData.userId}.png`)
    .addFields(
      {
        name: `${separators.main} SEMANA ATUAL (${validData.currentWeek.period})`,
        value:
          `Tempo acumulado: **${validData.currentWeek.accumulated}**\n\n` +
          `**${validData.currentWeek.callTime}** ${separators.divider} Tempo ativo\n` +
          `**${validData.currentWeek.mutedTime}** ${separators.divider} Tempo silenciado`,
        inline: false,
      },
      {
        name: `${separators.main} SEMANA PASSADA (${validData.previousWeek.period})`,
        value:
          `**${validData.previousWeek.callTime}** ${separators.divider} Tempo ativo\n` +
          `**${validData.previousWeek.mutedTime}** ${separators.divider} Tempo silenciado`,
        inline: false,
      }
    )
    .setFooter({ text: `${validData.serverName} » Community Suite` })
    .setTimestamp();

  return {
    embeds: [embed],
    files: [imageAttachment],
  };
}
