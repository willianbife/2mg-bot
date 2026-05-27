import * as IORedis from "ioredis";
import { env } from "../config/env.js";
import { childLogger } from "../logger/logger.js";

const log = childLogger("redis");
const RedisClient = IORedis.Redis;

export const redis = new RedisClient(env.REDIS_URL, {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: true,
  retryStrategy(times: number) {
    return Math.min(times * 250, 5000);
  }
});

redis.on("connect", () => log.info("Redis conectado"));
redis.on("error", (error: Error) => log.error({ error }, "Falha no Redis"));
