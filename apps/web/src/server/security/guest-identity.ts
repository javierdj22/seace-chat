import crypto from "crypto";
import { cookies } from "next/headers";

export const AI_GUEST_COOKIE_NAME = "ai_guest_session";

function getGuestCookieMaxAgeSeconds() {
  const configured = Number(process.env.AI_GUEST_COOKIE_MAX_AGE_SECONDS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return 60 * 60 * 24 * 30;
}

export async function getOrCreateGuestIdentity() {
  const cookieStore = await cookies();
  const existing = cookieStore.get(AI_GUEST_COOKIE_NAME)?.value;

  if (existing) {
    return {
      guestId: existing,
      isNew: false,
      maxAgeSeconds: getGuestCookieMaxAgeSeconds(),
    };
  }

  const guestId = crypto.randomBytes(24).toString("base64url");
  const maxAgeSeconds = getGuestCookieMaxAgeSeconds();

  cookieStore.set(AI_GUEST_COOKIE_NAME, guestId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return {
    guestId,
    isNew: true,
    maxAgeSeconds,
  };
}
