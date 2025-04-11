"use client";

import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  useEffect(() => {
    const handleLogin = async () => {
      await signIn("spotify", {
        callbackUrl: callbackUrl,
        redirect: true,
      });
    };

    handleLogin();
  }, [callbackUrl]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-8">Spotify Stats</h1>
        <p className="text-white">Redirecting to Spotify login...</p>
      </div>
    </div>
  );
}
