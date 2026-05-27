import { redis } from "../database/redis.js";
import { childLogger } from "../logger/logger.js";

const log = childLogger("cooldown");
const memoryBuckets = new Map<string, { count: number; expiresAt: number }>();

export class CooldownGuard {
  constructor(private readonly namespace: string) {}

  async consume(key: string, limit: number, windowSeconds: number) {
    const redisKey = `cooldown:${this.namespace}:${key}`;
    try {
      const current = await redis.incr(redisKey);
      if (current === 1) await redis.expire(redisKey, windowSeconds);
      const ttl = await redis.ttl(redisKey);
      return { allowed: current <= limit, remaining: Math.max(limit - current, 0), resetIn: ttl };
    } catch (error) {
      log.warn({ error, namespace: this.namespace }, "Redis indisponivel; usando cooldown em memoria");
      return consumeMemory(redisKey, limit, windowSeconds);
    }
  }
}

function consumeMemory(key: string, limit: number, windowSeconds: number) {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    const expiresAt = now + windowSeconds * 1000;
    memoryBuckets.set(key, { count: 1, expiresAt });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetIn: windowSeconds };
  }

  bucket.count += 1;
  const resetIn = Math.max(Math.ceil((bucket.expiresAt - now) / 1000), 1);
  return { allowed: bucket.count <= limit, remaining: Math.max(limit - bucket.count, 0), resetIn };
}
