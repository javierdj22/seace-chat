import crypto from "crypto";
import { db, eq } from "@repo/db";
import { seaceProviderSession } from "@repo/db/schema";
import { decryptSeaceCredentials, encryptSeaceCredentials } from "@/server/security/seace-credentials";

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;

function getTtlMs() {
  const configured = Number(process.env.SEACE_SESSION_TTL_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_TTL_MS;
}

export async function createSeaceProviderSession(params: {
  username: string;
  password: string;
  userId?: string | null;
}) {
  const sessionId = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + getTtlMs());

  await db.insert(seaceProviderSession).values({
    id: sessionId,
    userId: params.userId || null,
    encryptedCredentials: encryptSeaceCredentials(params.username, params.password),
    expiresAt,
  });

  return {
    sessionId,
    maxAgeSeconds: Math.floor(getTtlMs() / 1000),
  };
}

export async function getSeaceProviderSession(sessionId: string) {
  const [session] = await db
    .select()
    .from(seaceProviderSession)
    .where(eq(seaceProviderSession.id, sessionId))
    .limit(1);

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await db.delete(seaceProviderSession).where(eq(seaceProviderSession.id, sessionId));
    return null;
  }

  const credentials = decryptSeaceCredentials(session.encryptedCredentials);

  return {
    sessionId: session.id,
    userId: session.userId,
    username: credentials.username,
    password: credentials.password,
    expiresAt: session.expiresAt,
  };
}

export async function deleteSeaceProviderSession(sessionId: string) {
  await db.delete(seaceProviderSession).where(eq(seaceProviderSession.id, sessionId));
}

export async function attachSeaceProviderSessionToUser(params: {
  sessionId: string;
  userId: string;
}) {
  await db
    .update(seaceProviderSession)
    .set({
      userId: params.userId,
      updatedAt: new Date(),
    })
    .where(eq(seaceProviderSession.id, params.sessionId));
}
