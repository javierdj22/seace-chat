import { cookies, headers } from "next/headers";
import { auth } from "@repo/auth/server";
import { apiError, apiOk } from "@/server/http/api-response";
import { attachSeaceProviderSessionToUser } from "@/server/services/seace-provider-session";

export async function POST() {
  try {
    const authSession = await auth.api.getSession({
      headers: await headers(),
    });

    if (!authSession?.user?.id) {
      return apiError("No hay una sesion local activa.", 401);
    }

    const cookieStore = await cookies();
    const seaceSessionId = cookieStore.get("seace_session")?.value;

    if (!seaceSessionId) {
      return apiOk({ linked: false, reason: "missing_seace_session" });
    }

    await attachSeaceProviderSessionToUser({
      sessionId: seaceSessionId,
      userId: authSession.user.id,
    });

    return apiOk({ linked: true });
  } catch (error) {
    console.error("[SEACE_SESSION_LINK_ERROR]", error);
    return apiError("No se pudo vincular la sesion de SEACE.", 500, error);
  }
}
