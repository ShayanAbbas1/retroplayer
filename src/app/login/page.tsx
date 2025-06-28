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

      // Generate a random state parameter
      const state = Math.random().toString(36).substring(7);

      console.log("Attempting to sign in with state:", state);

      const result = await signIn("spotify", {
        callbackUrl: "/dashboard",
        state: state,
        redirect: false,
      });

      console.log("Sign in result:", result);

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
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">
          Spotify Playground
        </h1>
        {errorParam && (
          <p className="text-red-500 mb-4">
            {errorParam === "OAuthCallback"
              ? "Failed to authenticate with Spotify. Please try again."
              : `Error: ${errorParam}`}
          </p>
        )}
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="px-6 py-3 bg-green-500 text-white rounded-full text-lg font-medium hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
        >
          {isLoading ? (
            <>
              <svg
                className="animate-spin h-5 w-5 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Logging in...
            </>
          ) : (
            "Login with Spotify"
          )}
        </button>
        <div className="mt-8">
          <Link
            href="/streaming-insights"
            className="px-6 py-3 bg-gray-700 text-white rounded-full text-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Or analyze your streaming history
          </Link>
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
