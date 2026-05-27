-- CreateEnum
CREATE TYPE "LogCategory" AS ENUM ('ENTRADA_SAIDA', 'CALLS', 'MENSAGENS', 'BOOST', 'BANS', 'URL', 'CARGOS');

-- CreateEnum
CREATE TYPE "SecuritySeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateTable
CREATE TABLE "SecurityConfig" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "guildDiscordId" TEXT NOT NULL,
    "logs" JSONB NOT NULL DEFAULT '{}',
    "antiRaid" JSONB NOT NULL DEFAULT '{}',
    "antiNuke" JSONB NOT NULL DEFAULT '{}',
    "antiUrl" JSONB NOT NULL DEFAULT '{}',
    "ignoredRoles" JSONB NOT NULL DEFAULT '[]',
    "ignoredChannels" JSONB NOT NULL DEFAULT '[]',
    "whitelistedUsers" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SecurityConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SecurityEvent" (
    "id" TEXT NOT NULL,
    "guildId" TEXT NOT NULL,
    "category" "LogCategory" NOT NULL,
    "severity" "SecuritySeverity" NOT NULL DEFAULT 'LOW',
    "actorId" TEXT,
    "targetId" TEXT,
    "channelId" TEXT,
    "actionTaken" TEXT,
    "reason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SecurityConfig_guildId_key" ON "SecurityConfig"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityConfig_guildDiscordId_key" ON "SecurityConfig"("guildDiscordId");

-- CreateIndex
CREATE INDEX "SecurityEvent_guildId_category_createdAt_idx" ON "SecurityEvent"("guildId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "SecurityEvent_guildId_severity_createdAt_idx" ON "SecurityEvent"("guildId", "severity", "createdAt");

-- AddForeignKey
ALTER TABLE "SecurityConfig" ADD CONSTRAINT "SecurityConfig_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "Guild"("id") ON DELETE CASCADE ON UPDATE CASCADE;
