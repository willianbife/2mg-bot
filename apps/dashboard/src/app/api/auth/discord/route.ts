import { NextResponse } from "next/server";
import { env } from "@neon/core/config/env";

export async function GET() {
  const params = new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID,
    redirect_uri: env.DISCORD_OAUTH_REDIRECT_URI ?? `${env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
    response_type: "code",
    scope: "identify guilds"
  });

  return NextResponse.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
}
