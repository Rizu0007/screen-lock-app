"use client";

import { useEffect } from "react";
import { broadcastAuthChange } from "@/lib/auth-channel";

/**
 * The login page only renders for a signed-out browser, so announcing it lets
 * every other open tab re-check and leave protected content immediately.
 */
export function SignedOutBeacon() {
  useEffect(() => broadcastAuthChange(), []);
  return null;
}
