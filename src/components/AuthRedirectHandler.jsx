"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthRedirectHandler() {
  const router = useRouter();

  useEffect(() => {
    // Check for stored redirect URL after OAuth callback
    const storedRedirect = localStorage.getItem("authRedirect");
    if (storedRedirect) {
      localStorage.removeItem("authRedirect");
      router.push(storedRedirect);
    }
  }, [router]);

  return null;
}
