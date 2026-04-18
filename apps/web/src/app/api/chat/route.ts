import { streamText } from "ai";
import { headers } from "next/headers";
import { auth } from "@repo/auth/server";
import { gemini } from "@/lib/ai";
import { getSeaceTools } from "@/lib/ai/tools";
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

function buildSystemPrompt(isGuest: boolean) {
  return `Eres un asistente experto en SEACE (Perú). Tu ÚNICA función es buscar y mostrar contrataciones de 8 UIT.

${isGuest ? "\nMODO VISITANTE: No dejes que el usuario guarde borradores. Si lo intenta, dile brevemente que debe loguearse.\n" : ""}

FILTROS Y LÍMITES ESTRICTOS:
1. CANTIDAD: Siempre limita tus búsquedas a un máximo de 5 resultados (page_size: 5). El usuario prefiere ver pocos pero relevantes (3 a 5 registros).
2. SOLO COTIZABLES POR DEFECTO: Si el usuario te pide una búsqueda general ("lo último", "búscame algo", "ver contratos") sin especificar estados pasados, SIEMPRE usa el filtro solo_cotizables: true. Queremos que el usuario vea lo que puede cotizar hoy.
3. ESTADOS PASADOS: Solo busca contratos culminados o en evaluación si el usuario lo pide explícitamente (ej: "busca procesos culminados de 2024").
4. SILENCIO TOTAL: NO escribas textos introductorios, explicaciones ni resúmenes. Si vas a mostrar contratos, tu respuesta de texto debe ser un string VACÍO "".
5. SOLO TARJETAS: Deja que la interfaz visual hable por sí sola.

REGLA ESTRICTA DE HERRAMIENTAS:
- SOLO debes usar 'searchContracts' una (1) vez por mensaje de usuario para buscar. NO llames ningun otro servicio a menos que se te pida especificamente.
- PROHIBIDO llamar a 'getContractDetail' iterativamente. SOLO usalo si el usuario te pide explicitamente "Ver detalles tecnicos" o "Dame detalles de X".
- Si el usuario te pide "mis borradores", "ordenes guardadas como borradores", "filtro de guardados" o cualquier referencia a sus borradores locales, usa la herramienta 'listSavedDrafts' para obtener su historial.

El año actual es ${new Date().getFullYear()}.

Tu objetivo: Ser eficiente, mostrar entre 3 y 5 resultados vigentes y cotizables, y no decir nada de texto.`;
}

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

    // Hidden Prompt Augmentation: para búsquedas no-preguntas y no-históricas,
    // reforzamos al motor la preferencia por resultados vigentes y cotizables.
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "user" && typeof lastMessage.content === "string") {
      const content = lastMessage.content.toLowerCase();
      const isQuestion = content.includes("?") || content.includes("qué es") || content.includes("cómo");
      const isHistorySearch =
        content.includes("pasado") ||
        content.includes("vencido") ||
        content.includes("2024") ||
        content.includes("2023");
      if (!isQuestion && !isHistorySearch) {
        lastMessage.content += " (Priorizar resultados vigentes y aptos para cotizar)";
      }
    }

    const result = streamText({
      model: gemini,
      system: buildSystemPrompt(!userId),
      messages,
      tools: getSeaceTools(userId ?? undefined),
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
