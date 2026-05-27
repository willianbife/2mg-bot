import pino from "pino";
import { env } from "../config/env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: ["token", "password", "authorization", "*.token", "*.password"],
  transport:
    env.NODE_ENV === "development"
      ? {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "SYS:standard" }
        }
      : undefined
});

export function childLogger(scope: string) {
  return logger.child({ scope });
}
