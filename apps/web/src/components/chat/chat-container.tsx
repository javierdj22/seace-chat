"use client";

import Link from "next/link";
import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";

type QuotaState = {
  used: number;
  limit: number;
  remaining: number;
  audience?: "guest" | "authenticated";
};

export function ChatContainer() {
  const [onlyQuoteable, setOnlyQuoteable] = useState(false);
  const [quota, setQuota] = useState<QuotaState | null>(null);
  const [quotaMessage, setQuotaMessage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function refreshQuota() {
    try {
      const response = await fetch("/api/ai-usage", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        setQuota(null);
        return;
      }

      const data = await response.json();
      if (data?.quota) {
        setQuota({
          ...data.quota,
          audience: data.audience,
        });
      }
    } catch {
      setQuota(null);
    }
  }

  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append, setInput } =
    useChat({
      api: "/api/chat",
      maxSteps: 5,
      keepLastMessageOnError: true,
      async onResponse(response) {
        if (!response.ok) {
          try {
            const data = await response.clone().json();
            if (typeof data?.message === "string") {
              setQuotaMessage(data.message);
            }
          } catch {
            setQuotaMessage("No se pudo procesar tu solicitud de chat.");
          }
        } else {
          setQuotaMessage(null);
        }
      },
      async onFinish() {
        await refreshQuota();
      },
      onError(error) {
        setQuotaMessage(error.message || "No se pudo procesar tu solicitud de chat.");
      },
    });

  const searchParams = useSearchParams();
  const initialSearchProcessed = useRef(false);

  const guestTrialExhausted = quota?.audience === "guest" && quota.remaining <= 0;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    refreshQuota();
  }, []);

  function appendWithQuoteable(prompt: string) {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt) return;

    if (onlyQuoteable && !trimmedPrompt.toLowerCase().includes("cotiza")) {
      append({
        role: "user",
        content: `${trimmedPrompt} (Deben ser contrataciones vigentes y aptas para cotizar)`,
      });
      return;
    }

    append({ role: "user", content: trimmedPrompt });
  }

  useEffect(() => {
    const query = searchParams.get("search");
    if (query && !initialSearchProcessed.current && messages.length === 0) {
      initialSearchProcessed.current = true;
      const prompt = query === "ultimas"
        ? "Muestra las últimas contrataciones públicas publicadas"
        : query;
      appendWithQuoteable(prompt);
    }
  }, [searchParams, messages.length]);

  function handleViewDetail(id: number) {
    append({
      role: "user",
      content: `Dame el detalle completo de la contratacion con ID ${id}`,
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <ScrollArea className="min-h-0 flex-1" ref={scrollRef}>
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-3 pb-6 pt-4 sm:px-4">
          {quota?.audience === "guest" && (
            <div
              className={`rounded-2xl border px-4 py-3 text-sm shadow-sm ${
                guestTrialExhausted
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-sky-200 bg-sky-50 text-sky-900"
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="font-semibold">
                    {guestTrialExhausted
                      ? "Tu prueba gratuita ya se agoto"
                      : `Te quedan ${quota.remaining} consulta${quota.remaining === 1 ? "" : "s"} de prueba`}
                  </p>
                  <p className="text-xs leading-5 text-inherit/80">
                    {guestTrialExhausted
                      ? "Inicia sesion o registrate para seguir usando el chat con una cuota mensual completa."
                      : "Puedes explorar el chat como invitado. Cuando se agote la prueba, te pediremos iniciar sesion para continuar."}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href="/login?redirect=/chat"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
                  >
                    Iniciar sesion
                  </Link>
                  <Link
                    href="/register?redirect=/chat"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    Registrarme
                  </Link>
                </div>
              </div>
            </div>
          )}

          {quotaMessage && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <p className="font-medium">{quotaMessage}</p>
              {guestTrialExhausted && (
                <div className="mt-3 flex gap-2">
                  <Link
                    href="/login?redirect=/chat"
                    className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white"
                  >
                    Iniciar sesion
                  </Link>
                  <Link
                    href="/register?redirect=/chat"
                    className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                  >
                    Crear cuenta
                  </Link>
                </div>
              )}
            </div>
          )}

          {messages.length === 0 && (
            <div className="flex min-h-[58vh] flex-col justify-center gap-5 py-4">
              <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-sm">
                <div className="mb-4 inline-flex size-11 items-center justify-center rounded-2xl bg-slate-900 text-white">
                  <Sparkles className="size-5" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Encuentra contrataciones rapido
                  </h2>
                  <p className="max-w-xl text-sm leading-6 text-slate-600">
                    Busca procesos, revisa detalle tecnico y continua con tu flujo de cotizacion desde una experiencia pensada para movil.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Sugerencias
                  </p>
                  <p className="text-xs text-slate-500">Toca una para empezar</p>
                </div>
                <div className="grid max-w-lg grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {[
                    "Busca contrataciones de servicios vigentes en Lima",
                    "Muestra las ultimas contrataciones de bienes en Cusco",
                    "Busca contratos de consultoria de obra este anio",
                    "Que departamentos estan disponibles para filtrar?",
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => appendWithQuoteable(suggestion)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-medium leading-5 text-slate-700 shadow-sm transition-all active:scale-[0.99] hover:border-slate-300 hover:bg-slate-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onViewDetail={handleViewDetail} />
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
              <Loader2 className="size-4 animate-spin" />
              Buscando la mejor respuesta...
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="border-t border-slate-200 bg-white/95 px-safe pb-safe backdrop-blur supports-[backdrop-filter]:bg-white/90">
        <form onSubmit={handleSubmit} className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 sm:px-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setOnlyQuoteable(!onlyQuoteable)}
              className={`inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border px-4 text-xs font-semibold transition-all ${
                onlyQuoteable
                  ? "border-green-700 bg-green-600 text-white shadow-sm shadow-green-200"
                  : "border-slate-200 bg-slate-100 text-slate-600"
              }`}
              title="Solo contrataciones vigentes y cotizables"
            >
              <CheckCircle2 className={`size-4 ${onlyQuoteable ? "text-white" : "text-slate-400"}`} />
              Solo cotizables
            </button>

            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 rounded-2xl border-slate-200 bg-white px-4 text-slate-600"
                onClick={() => setMessages([])}
                title="Limpiar chat"
              >
                <Trash2 className="size-4" />
                Limpiar
              </Button>
            )}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white p-2 shadow-sm">
            <div className="relative flex items-end gap-2">
              <input
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && input.trim()) {
                    e.preventDefault();
                    appendWithQuoteable(input);
                    setInput("");
                  }
                }}
                placeholder={
                  guestTrialExhausted
                    ? "Inicia sesion para seguir usando el chat"
                    : "Escribe tu busqueda. Ejemplo: servicios en Lima"
                }
                className="min-h-[52px] w-full rounded-[18px] border-0 bg-transparent px-3 py-3 pr-14 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                disabled={isLoading || guestTrialExhausted}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim() || guestTrialExhausted}
                className="absolute bottom-1.5 right-1.5 size-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                onClick={(e) => {
                  if (input.trim()) {
                    e.preventDefault();
                    appendWithQuoteable(input);
                    setInput("");
                  }
                }}
              >
                {isLoading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              </Button>
            </div>

            <div className="flex items-center justify-between px-2 pt-1">
              <p className="text-[11px] text-slate-400">
                {quota?.audience === "guest"
                  ? `Modo invitado: ${quota.remaining} consulta${quota.remaining === 1 ? "" : "s"} restante${quota.remaining === 1 ? "" : "s"}`
                  : "Respuesta asistida por busqueda en SEACE"}
              </p>
              <p className="text-[11px] text-slate-400">{guestTrialExhausted ? "Login requerido" : "Enter para enviar"}</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
