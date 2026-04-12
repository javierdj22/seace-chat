import crypto from "crypto";

type SeaceSessionRecord = {
  username: string;
  password: string;
  expiresAt: number;
};

const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000;
const sessions = new Map<string, SeaceSessionRecord>();

function getTtlMs() {
  const configured = Number(process.env.SEACE_SESSION_TTL_MS);
  if (Number.isFinite(configured) && configured > 0) {
    return configured;
  }

  return DEFAULT_TTL_MS;
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

export function createSeaceSession(username: string, password: string) {
  cleanupExpiredSessions();

  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, {
    username,
    password,
    expiresAt: Date.now() + getTtlMs(),
  });

  return {
    sessionId,
    maxAgeSeconds: Math.floor(getTtlMs() / 1000),
  };
}

export function getSeaceSession(sessionId: string) {
  cleanupExpiredSessions();
  const session = sessions.get(sessionId);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return null;
  }

  return {
    username: session.username,
    password: session.password,
  };
}

export function deleteSeaceSession(sessionId: string) {
  sessions.delete(sessionId);
}
