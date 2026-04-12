import { cookies, headers } from "next/headers";
import { auth } from "@repo/auth/server";
import { authenticateSeaceCredentials } from "@/server/services/seace-auth";
import { apiError, apiOk } from "@/server/http/api-response";
import { checkRateLimit, getRequestClientIp } from "@/server/security/rate-limit";
import { createSeaceProviderSession } from "@/server/services/seace-provider-session";

export async function POST(req: Request) {
  try {
    const clientIp = getRequestClientIp(req);
    const rateLimit = checkRateLimit(`seace-verify:${clientIp}`, {
      maxRequests: 8,
      windowMs: 5 * 60_000,
    });

    if (!rateLimit.allowed) {
      return apiError(
        `Demasiados intentos de autenticacion. Intenta nuevamente en ${rateLimit.retryAfterSeconds}s.`,
        429,
      );
    }

    const { username, password } = await req.json();

    if (!username || !password) {
      return apiError("RUC/DNI y contrasena son requeridos.", 400);
    }

    const login = await authenticateSeaceCredentials(username, password);

    if (!login.token) {
      return apiError(login.message || "Credenciales incorrectas.", 401);
    }

    const cookieStore = await cookies();
    const authSession = await auth.api.getSession({
      headers: await headers(),
    });

    cookieStore.set("seace_token", login.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const session = await createSeaceProviderSession({
      username,
      password,
      userId: authSession?.user?.id || null,
    });

    cookieStore.set("seace_session", session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: session.maxAgeSeconds,
    });
    cookieStore.delete("seace_creds");

    return apiOk({
      success: true,
      name: login.razonSocial || username,
      email: login.email?.toLowerCase() || `${username}@seace.gob.pe`,
    });
  } catch (error) {
    console.error("[SEACE_VERIFY_ERROR]", error);
    return apiError("Error al comunicar con SEACE.", 500, error);
  }
}
