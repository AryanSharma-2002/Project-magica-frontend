"use client";
import { useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { setTokenGetter } from "@/services";

/** Installs the Clerk token getter used by every `apiFetch` call. Renders nothing. */
export function ApiAuthBridge() {
  const { getToken } = useAuth();
  useEffect(() => {
    setTokenGetter(() => getToken());
  }, [getToken]);
  return null;
}
