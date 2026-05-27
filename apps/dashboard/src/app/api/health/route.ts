import { NextResponse } from "next/server";
import { prisma } from "@neon/database";

export async function GET() {
  const { redis } = await import("@neon/core/database/redis");
  await prisma.$queryRaw`SELECT 1`;
  await redis.ping();
  return NextResponse.json({ ok: true, service: "2mg-dashboard" });
}
