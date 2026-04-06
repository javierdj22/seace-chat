import { streamText } from "ai";
import { gemini } from "@/lib/ai";
import { getSeaceTools } from "@/lib/ai/tools";
import { auth } from "@repo/auth/server";
import { headers } from "next/headers";

export const maxDuration = 60;

export async function POST(req: Request) {
  const { messages } = await req.json();
  const lastMessage = messages[messages.length - 1];

  // Aumento interno (Hidden Prompt Augmentation): 
  // Si el último mensaje es del usuario y es una búsqueda (no es pregunta directa), 
  // le inyectamos la instrucción interna para priorizar lo cotizable, pero SOLO para el motor de la IA.
  if (lastMessage?.role === "user") {
    const content = lastMessage.content.toLowerCase();
    const isQuestion = content.includes("?") || content.includes("qué es") || content.includes("cómo");
    const isHistorySearch = content.includes("pasado") || content.includes("vencido") || content.includes("2024") || content.includes("2023");
    
    if (!isQuestion && !isHistorySearch) {
      lastMessage.content += " (Priorizar resultados vigentes y aptos para cotizar)";
    }
  }

  const session = await auth.api.getSession({ headers: await headers() });
  const isGuest = !session?.user;
  const userId = session?.user?.id;

  const result = streamText({
    model: gemini,
    system: `Eres un asistente experto en SEACE (Perú). Tu ÚNICA función es buscar y mostrar contrataciones de 8 UIT.

${isGuest ? "\nMODO VISITANTE: No dejes que el usuario guarde borradores. Si lo intenta, dile brevemente que debe loguearse.\n" : ""}

FILTROS Y LÍMITES ESTRICTOS:
1. CANTIDAD: Siempre limita tus búsquedas a un máximo de 5 resultados (page_size: 5). El usuario prefiere ver pocos pero relevantes (3 a 5 registros).
2. SOLO COTIZABLES POR DEFECTO: Si el usuario te pide una búsqueda general ("lo último", "búscame algo", "ver contratos") sin especificar estados pasados, SIEMPRE usa el filtro solo_cotizables: true. Queremos que el usuario vea lo que puede cotizar hoy.
3. ESTADOS PASADOS: Solo busca contratos culminados o en evaluación si el usuario lo pide explícitamente (ej: "busca procesos culminados de 2024").
4. SILENCIO TOTAL: NO escribas textos introductorios, explicaciones ni resúmenes. Si vas a mostrar contratos, tu respuesta de texto debe ser un string VACÍO "".
5. SOLO TARJETAS: Deja que la interfaz visual hable por sí sola.

Tu objetivo: Ser eficiente, mostrar entre 3 y 5 resultados vigentes y cotizables, y no decir nada de texto.`,
    messages,
    tools: getSeaceTools(userId),
    maxSteps: 5,
  });

  return result.toDataStreamResponse();
}
