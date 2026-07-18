import { JWT } from "next-auth/jwt";

const REFRESH_SKEW_SECONDS = 60; // ponytail: clock-drift buffer, tune if refreshes still race expiry

export function isExpired(token: JWT): boolean {
  if (!token.expiresAt) return true;
  return Date.now() >= token.expiresAt * 1000 - REFRESH_SKEW_SECONDS * 1000;
}

export async function refreshSpotifyToken(token: JWT): Promise<JWT> {
  try {
    const basic = Buffer.from(
      `${process.env.NEXT_PUBLIC_SPOTIFY_CLIENT_ID}:${process.env.NEXT_SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: token.refreshToken ?? "",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { ...token, error: "RefreshTokenError" };
    }

    return {
      ...token,
      accessToken: data.access_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.expires_in,
      refreshToken: data.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch {
    return { ...token, error: "RefreshTokenError" };
  }
}
