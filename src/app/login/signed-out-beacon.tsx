"use client";

import { useEffect } from "react";
import { broadcastAuthChange } from "@/lib/auth-channel";

/** Tells other tabs the session ended so they re-check. */
export function SignedOutBeacon() {
  useEffect(() => broadcastAuthChange(), []);
  return null;
}
