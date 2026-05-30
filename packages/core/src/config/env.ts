import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import { z } from "zod";

function loadRootEnv() {
  let current = process.cwd();
  for (let index = 0; index < 6; index += 1) {
    const candidate = join(current, ".env");
    if (existsSync(candidate)) {
      dotenv.config({ path: candidate });
      return;
    }
    const parent = dirname(current);
    if (parent === current) return;
    current = parent;
  }
}

loadRootEnv();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  DISCORD_CLIENT_ID: z.string().min(12),
  DISCORD_MODERATION_CLIENT_ID: z.string().optional(),
  DISCORD_INFO_CLIENT_ID: z.string().optional(),
  DISCORD_SECURITY_CLIENT_ID: z.string().optional(),
  DISCORD_GUILD_ID: z.string().optional(),
  DISCORD_MODERATION_TOKEN: z.string().optional(),
  DISCORD_INFO_TOKEN: z.string().optional(),
  DISCORD_SECURITY_TOKEN: z.string().optional(),
  DISCORD_OAUTH_CLIENT_SECRET: z.string().optional(),
  DISCORD_OAUTH_REDIRECT_URI: z.string().url().optional(),
  JWT_SECRET: z.string().min(24),
  INTERNAL_WS_SECRET: z.string().min(12),
  LOG_LEVEL: z.string().default("info"),
  BOT_PREFIX: z.string().min(1).default("."),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_BRAND_NAME: z.string().default("Neon Community")
});

export const env = envSchema.parse(process.env);
export type Env = typeof env;
