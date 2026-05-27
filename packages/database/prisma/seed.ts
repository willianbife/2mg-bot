import "dotenv/config";
import { prisma } from "../src/index.js";

const guildDiscordId = process.env.DISCORD_GUILD_ID ?? "000000000000000000";

async function main() {
  const guild = await prisma.guild.upsert({
    where: { discordId: guildDiscordId },
    update: {},
    create: {
      discordId: guildDiscordId,
      name: "Neon Community",
      config: {
        brandColor: "#ff2bd6",
        protectedRoles: [],
        logChannels: {
          roles: null,
          punishments: null,
          tickets: null,
          security: null,
          voice: null,
          admin: null
        },
        voiceGoals: {
          weeklySeconds: 7200,
          monthlySeconds: 28800
        }
      }
    }
  });

  await prisma.panel.upsert({
    where: { guildId_key: { guildId: guild.id, key: "welcome" } },
    update: {},
    create: {
      guildId: guild.id,
      key: "welcome",
      title: "Bem-vindo a Neon Community",
      description: "Escolha sua area, leia os links importantes e abra suporte quando precisar.",
      theme: { accent: "#ff2bd6", mode: "premium-dark" },
      components: [
        { type: "button", id: "links", label: "Links", style: "SECONDARY" },
        { type: "select", id: "areas", label: "Areas", options: ["suporte", "migracao", "pastime", "tellonym"] }
      ]
    }
  });

  await prisma.permission.createMany({
    data: [
      { guildId: guild.id, subjectId: "OWNER", scope: "WHITELIST", permission: "roles.manage", allow: true },
      { guildId: guild.id, subjectId: "OWNER", scope: "WHITELIST", permission: "security.manage", allow: true },
      { guildId: guild.id, subjectId: "STAFF", scope: "WHITELIST", permission: "tickets.manage", allow: true }
    ],
    skipDuplicates: true
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
