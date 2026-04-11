"use client";

import { useChat } from "ai/react";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";

export function ChatContainer() {
  const { messages, input, handleInputChange, handleSubmit, isLoading, setMessages, append, setInput } =
    useChat({
      api: "/api/chat",
      maxSteps: 5,
    });

  const [onlyQuoteable, setOnlyQuoteable] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
            <MessageBubble
              key={message.id}
              message={message}
              onViewDetail={handleViewDetail}
            />
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
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 sm:px-4"
        >
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
                  if (e.key === "Enter" && onlyQuoteable && input.trim() && !input.toLowerCase().includes("cotiza")) {
                    e.preventDefault();
                    appendWithQuoteable(input);
                    setInput("");
                  }
                }}
                placeholder="Escribe tu busqueda. Ejemplo: servicios en Lima"
                className="min-h-[52px] w-full rounded-[18px] border-0 bg-transparent px-3 py-3 pr-14 text-[15px] text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={isLoading || !input.trim()}
                className="absolute bottom-1.5 right-1.5 size-10 rounded-2xl bg-slate-900 text-white hover:bg-slate-800"
                onClick={(e) => {
                  if (onlyQuoteable && input.trim() && !input.toLowerCase().includes("cotiza")) {
                    e.preventDefault();
                    appendWithQuoteable(input);
                    setInput("");
                  }
                }}
              >
                {isLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>

            <div className="flex items-center justify-between px-2 pt-1">
              <p className="text-[11px] text-slate-400">Respuesta asistida por busqueda en SEACE</p>
              <p className="text-[11px] text-slate-400">Enter para enviar</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
