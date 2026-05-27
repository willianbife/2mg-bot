import { prisma } from "@neon/database";
import { childLogger } from "../logger/logger.js";

const log = childLogger("audit");

type BotType = "MODERATION" | "INFO" | "SECURITY" | "DASHBOARD";
type AuditAction =
  | "ROLE_ADD"
  | "ROLE_REMOVE"
  | "TICKET_CREATE"
  | "TICKET_CLOSE"
  | "PUNISHMENT_CREATE"
  | "BLACKLIST_CREATE"
  | "BLACKLIST_REMOVE"
  | "VOICE_UPDATE"
  | "PANEL_UPDATE"
  | "CALL_UPDATE"
  | "SECURITY_TRIGGER"
  | "LOGIN"
  | "CONFIG_UPDATE";

export async function audit(data: {
  guildId?: string;
  actorId?: string;
  targetId?: string;
  bot: BotType;
  action: AuditAction;
  reason?: string;
  metadata?: unknown;
}) {
  try {
    await prisma.audit.create({
      data: {
        guildId: data.guildId,
        actorId: data.actorId,
        targetId: data.targetId,
        bot: data.bot,
        action: data.action,
        reason: data.reason,
        metadata: data.metadata ?? {}
      }
    });
  } catch (error) {
    log.error({ error, data }, "Falha ao gravar auditoria");
  }
}
