import { streamText } from "ai";
import { gemini } from "@/lib/ai";
import { seaceTools } from "@/lib/ai/tools";

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
    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
      return Response.json(
        { error: "Falta GOOGLE_GENERATIVE_AI_API_KEY en el entorno del servidor." },
        { status: 500 },
      );
    }

    const { messages } = await req.json();

    const result = streamText({
      model: gemini,
      system: systemPrompt,
      messages,
      tools: seaceTools,
      maxSteps: 5,
      onError({ error }) {
        console.error("[/api/chat stream error]", error);
      },
    });

    return result.toDataStreamResponse({
      getErrorMessage(error) {
        console.error("[/api/chat response error]", error);

        if (process.env.NODE_ENV === "development") {
          return error instanceof Error
            ? error.message
            : "Error desconocido en /api/chat";
        }

        return "Ocurrio un error procesando el chat.";
      },
    });
  } catch (error) {
    console.error("[/api/chat fatal error]", error);

    return Response.json(
      {
        error:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : "No se pudo procesar la solicitud del chat.",
      },
      { status: 500 },
    );
  }
}
