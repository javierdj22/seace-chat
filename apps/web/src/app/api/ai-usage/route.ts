import { headers } from "next/headers";
import { auth } from "@repo/auth/server";
import { apiError, apiOk } from "@/server/http/api-response";
import { getOrCreateGuestIdentity } from "@/server/security/guest-identity";
import { getAiQuotaSnapshot, getGuestAiQuotaSnapshot } from "@/server/services/ai-usage";

export async function GET() {
  try {
    const authSession = await auth.api.getSession({
      headers: await headers(),
    });

    if (authSession?.user?.id) {
      const quota = await getAiQuotaSnapshot(authSession.user.id);
      return apiOk({ audience: "authenticated", quota });
    }

    const guestIdentity = await getOrCreateGuestIdentity();
    const quota = await getGuestAiQuotaSnapshot(guestIdentity.guestId);
    return apiOk({ audience: "guest", quota });
  } catch (error) {
    console.error("[AI_USAGE_ERROR]", error);
    return apiError("No se pudo obtener la cuota de IA.", 500, error);
  }
}
