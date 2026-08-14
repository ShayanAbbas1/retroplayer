"use client";

import { signIn, signOut } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function LoginContent() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Sign out any existing session first
      await signOut({ redirect: false });

      const result = await signIn("spotify", {
        callbackUrl: "/dashboard",
        redirect: false,
      });

      if (result?.error) {
        if (result.error === "OAuthCallback") {
          setError("Failed to authenticate with Spotify. Please try again.");
        } else {
          setError(result.error);
        }
        return;
      }

      if (result?.url) {
        router.push(result.url);
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError("Failed to login. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="win-window w-full max-w-sm">
        <div className="win-titlebar">RetroPlayer</div>
        <div className="p-6 text-center space-y-4">
          <h1 className="text-xl font-bold">Welcome</h1>
          <p>Sign in with your Spotify account to continue.</p>
          {errorParam && (
            <p className="text-red-500">
              {errorParam === "OAuthCallback"
                ? "Failed to authenticate with Spotify. Please try again."
                : `Error: ${errorParam}`}
            </p>
          )}
          {error && <p className="text-red-500">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={isLoading}
            className="px-8 py-1 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Logging in…" : "Login with Spotify"}
          </button>
          <div>
            <Link href="/streaming-insights" className="text-blue-500 underline">
              Or analyze your streaming history
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
