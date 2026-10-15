import { createHash, randomBytes } from "node:crypto";

export const shareSessionCookieName = (shareLinkId: string) => `gh_spec_share_${shareLinkId}`;

export function hashShareSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function newShareSecret() {
  return randomBytes(32).toString("base64url");
}
