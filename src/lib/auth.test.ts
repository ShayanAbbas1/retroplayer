import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { JWT } from "next-auth/jwt";
import { isExpired, refreshSpotifyToken } from "./auth";

const nowSeconds = () => Math.floor(Date.now() / 1000);

const baseToken: JWT = {
  accessToken: "old-access",
  refreshToken: "old-refresh",
  expiresAt: nowSeconds() + 3600,
};

describe("isExpired", () => {
  it("is false well before expiry", () => {
    expect(isExpired({ ...baseToken, expiresAt: nowSeconds() + 3600 })).toBe(false);
  });

  it("is true once past expiry", () => {
    expect(isExpired({ ...baseToken, expiresAt: nowSeconds() - 10 })).toBe(true);
  });

  it("is true inside the clock-skew buffer", () => {
    expect(isExpired({ ...baseToken, expiresAt: nowSeconds() + 30 })).toBe(true);
  });

  it("is true when there's no expiresAt", () => {
    expect(isExpired({ accessToken: "x" } as JWT)).toBe(true);
  });
});

describe("refreshSpotifyToken", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SPOTIFY_CLIENT_ID", "test-client-id");
    vi.stubEnv("NEXT_SPOTIFY_CLIENT_SECRET", "test-client-secret");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps a successful refresh response onto the token", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        expires_in: 3600,
        refresh_token: "new-refresh",
      }),
    } as Response);

    const result = await refreshSpotifyToken(baseToken);

    expect(result.accessToken).toBe("new-access");
    expect(result.refreshToken).toBe("new-refresh");
    expect(result.expiresAt).toBeGreaterThan(nowSeconds());
    expect(result.error).toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("https://accounts.spotify.com/api/token");
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Basic ${Buffer.from("test-client-id:test-client-secret").toString("base64")}`
    );
  });

  it("keeps the old refresh token when Spotify doesn't rotate it", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-access",
        expires_in: 3600,
      }),
    } as Response);

    const result = await refreshSpotifyToken(baseToken);

    expect(result.refreshToken).toBe("old-refresh");
  });

  it("returns a RefreshTokenError on a non-OK response", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "invalid_grant" }),
    } as Response);

    const result = await refreshSpotifyToken(baseToken);

    expect(result.error).toBe("RefreshTokenError");
    expect(result.accessToken).toBe("old-access");
  });
});
