import { execSync } from "node:child_process";

/** Resets the demo accounts (credentials, PIN counter, sessions, throttle). */
export default function globalSetup() {
  execSync("npm run db:seed", { stdio: "inherit" });
}
