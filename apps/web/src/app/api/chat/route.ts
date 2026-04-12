import { streamText } from "ai";
import { headers } from "next/headers";
import { auth } from "@repo/auth/server";
import { gemini } from "@/lib/ai";
import { seaceTools } from "@/lib/ai/tools";
import { apiError } from "@/server/http/api-response";
import { getOrCreateGuestIdentity } from "@/server/security/guest-identity";
import {
  ensureAiCreditAvailable,
  ensureGuestAiCreditAvailable,
  recordAiUsage,
  recordGuestAiUsage,
} from "@/server/services/ai-usage";
import { checkRateLimit, getRequestClientIp } from "@/server/security/rate-limit";

export const maxDuration = 60;

const systemPrompt = `Eres un asistente experto en contrataciones publicas del estado peruano. Tu funcion es ayudar a los usuarios a buscar y cotizar las contrataciones menores o iguales a 8 UIT publicadas en el sistema SEACE.

Reglas:
- Responde siempre en espanol
- Cuando el usuario pida buscar contrataciones, usa la herramienta searchContracts con los filtros apropiados
- REGLA ESTRICTA: SOLO debes usar 'searchContracts' una (1) vez por mensaje de usuario para buscar. NO llames ningun otro servicio a menos que se te pida especificamente.
- PROHIBIDO llamar a 'getContractDetail' iterativamente. SOLO usalo si el usuario te pide explicitamente "Ver detalles tecnicos" o "Dame detalles de X".
- Si el usuario te pide "mis borradores", "ordenes guardadas como borradores", "filtro de guardados" o cualquier referencia a tus borradores locales, usa la herramienta 'listSavedDrafts' para obtener su historial y muestralos.
- El ano actual es ${new Date().getFullYear()}
- Si searchContracts o listSavedDrafts devuelve contracts: [], debes decirselo claramente al usuario. En ese caso debes responder que no encontraste resultados para los filtros solicitados y sugerir una reformulacion breve, por ejemplo ampliar palabra clave, cambiar ano, quitar departamento o cambiar tipo de objeto.
- Si contracts: [] nunca digas "se encontraron X resultados", aunque exista pagination.total o sourcePagination. Cuando contracts este vacio, la respuesta correcta es que no hubo resultados utiles despues de aplicar los filtros.
- Cuando muestres resultados de busqueda o borradores, limitate a decir cuantos encontraste y deja que las tarjetas de la UI hagan el trabajo. NO llames a los detalles de cada uno para hacer un resumen.`;

export async function POST(req: Request) {
  try {
    const clientIp = getRequestClientIp(req);
    const rateLimit = checkRateLimit(`chat:${clientIp}`, {
      maxRequests: 20,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return apiError(
        `Demasiadas solicitudes al chat. Intenta nuevamente en ${rateLimit.retryAfterSeconds}s.`,
        429,
      );
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return apiError("Falta GOOGLE_GENERATIVE_AI_API_KEY en el entorno del servidor.", 500);
    }

    const [authSession, guestIdentity] = await Promise.all([
      auth.api.getSession({
        headers: await headers(),
      }),
      getOrCreateGuestIdentity(),
    ]);

    const userId = authSession?.user?.id ?? null;
    const guestId = userId ? null : guestIdentity.guestId;

    if (userId) {
      const credit = await ensureAiCreditAvailable(userId, 1);

      if (!credit.allowed) {
        return apiError(
          `Has alcanzado tu limite mensual de consultas de IA. Tu cuota se reinicia el ${credit.resetAt.toISOString().slice(0, 10)}.`,
          402,
        );
      }
    } else if (guestId) {
      const guestCredit = await ensureGuestAiCreditAvailable(guestId, 1);

      if (!guestCredit.allowed) {
        return apiError(
          "Ya usaste tus 2 consultas de prueba. Inicia sesion o registrate para seguir usando el chat y acceder a una cuota mensual completa.",
          402,
        );
      }
    }

    const { messages } = await req.json();

    if (!Array.isArray(messages)) {
      return apiError("El formato de mensajes no es valido.", 400);
    }

    const result = streamText({
      model: gemini,
      system: systemPrompt,
      messages,
      tools: seaceTools,
      maxSteps: 5,
      async onFinish({ usage, finishReason }) {
        try {
          if (userId) {
            const recorded = await recordAiUsage({
              userId,
              endpoint: "/api/chat",
              model: "gemini-2.5-flash",
              usage,
              metadata: {
                ip: clientIp,
                finishReason,
                audience: "authenticated",
              },
            });

            if (recorded.overageCredits > 0) {
              console.warn("[/api/chat quota overage]", {
                userId,
                overageCredits: recorded.overageCredits,
                chargedCredits: recorded.chargedCredits,
              });
            }
          } else if (guestId) {
            const recorded = await recordGuestAiUsage({
              guestId,
              endpoint: "/api/chat",
              model: "gemini-2.5-flash",
              usage,
              metadata: {
                ip: clientIp,
                finishReason,
                audience: "guest",
              },
            });

            if (recorded.overageCredits > 0) {
              console.warn("[/api/chat guest quota overage]", {
                guestId,
                overageCredits: recorded.overageCredits,
                chargedCredits: recorded.chargedCredits,
              });
            }
          }
        } catch (error) {
          console.error("[/api/chat usage recording error]", error);
        }
      },
      onError({ error }) {
        console.error("[/api/chat stream error]", error);
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error("[/api/chat response error]", error);

        if (process.env.NODE_ENV === "development") {
          return error instanceof Error ? error.message : "Error desconocido en /api/chat";
        }

        return "Ocurrio un error procesando el chat.";
      },
    });
  } catch (error) {
    console.error("[/api/chat fatal error]", error);

    return apiError(
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : "No se pudo procesar la solicitud del chat.",
      500,
      error,
    );
  }
}
