import { OAuth2Client } from "google-auth-library";

export const youtubeMusicClients = new OAuth2Client(
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET,
  process.env.NEXT_PUBLIC_GOOGLE_REDIRECT_URI
);

export const youtubeMusicScopes = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export const getYouTubeMusicApi = (accessToken: string) => {
  const client = new OAuth2Client();
  client.setCredentials({ access_token: accessToken });
  return client;
};
