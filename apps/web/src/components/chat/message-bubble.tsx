"use client";

import type { Message } from "ai";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import { ContractList } from "./contract-list";
import { ContractCard } from "./contract-card";
import ReactMarkdown from "react-markdown";

function ToolResult({
  toolName,
  result,
  onViewDetail,
}: {
  toolName: string;
  result: unknown;
  onViewDetail?: (id: number) => void;
}) {
  if ((toolName === "searchContracts" || toolName === "listSavedDrafts") && result && typeof result === "object") {
    const data = result as any;
    const rawContracts = data.contracts || data.data || [];
    const emptyHint =
      rawContracts.length === 0 && typeof data.userMessageHint === "string"
        ? data.userMessageHint
        : null;
    
    // Mapear los contratos para que tengan la estructura que espera ContractCard
    const mappedContracts = rawContracts.map((c: any) => ({
        id: c.id || c.idContrato,
        // Ser extremadamente exhaustivos buscando el ID de cotización
        idCotizacion: c.idCotizacion || c.id_cotizacion || c.codCotizacion || (c.idEstadoCotiza === 1 ? c.idCotizacion : null),
        numero: c.numero || c.desContratacion || c.nroContratacion || "N/A",
        tipo: c.tipo || c.nomObjetoContrato || "Servicio",
        descripcion: c.descripcion || c.desObjetoContrato || "",
        entidad: c.entidad || c.nomEntidad || "",
        estado: c.estado || c.nomEstadoContrato || "Vigente",
        fechaPublicacion: c.fechaPublicacion || c.fecPublica || "",
        inicioCotizacion: c.inicioCotizacion || c.fecIniCotizacion || "",
        finCotizacion: c.finCotizacion || c.fecFinCotizacion || "",
        puedesCotizar: c.puedesCotizar ?? c.cotizar ?? false,
        nomSigla: c.nomSigla,
        nomTipoCotizacion: c.nomTipoCotizacion
    }))
    // Ordenar: 1. Puedes Cotizar activamente (verde). 2. Borradores Guardados (azul). 3. Resto.
    .sort((a: any, b: any) => {
        const canQuoteA = a.puedesCotizar && !a.idCotizacion && !(a as any).id_cotizacion;
        const canQuoteB = b.puedesCotizar && !b.idCotizacion && !(b as any).id_cotizacion;

        if (canQuoteA && !canQuoteB) return -1;
        if (!canQuoteA && canQuoteB) return 1;

        const hasDraftA = !!(a.idCotizacion || (a as any).id_cotizacion);
        const hasDraftB = !!(b.idCotizacion || (b as any).id_cotizacion);

        if (hasDraftA && !hasDraftB) return -1;
        if (!hasDraftA && hasDraftB) return 1;

        return 0;
    });

    return (
      <div className="space-y-3">
        {emptyHint && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            {emptyHint}
          </div>
        )}
        <ContractList
          contracts={mappedContracts}
          pagination={data.pagination || data.pageable || { page: 1, pageSize: rawContracts.length, total: rawContracts.length }}
          onViewDetail={onViewDetail}
        />
      </div>
    );
  }

  if (toolName === "getContractDetail" && result && typeof result === "object") {
    const detail = result as any;
    // Mapear el detalle completo a la interfaz de ContractCard para uniformizar
    const contract = {
      id: detail.id || (detail.contrato && detail.contrato.idContrato),
      idCotizacion: detail.idCotizacion || (detail.contrato && detail.contrato.idCotizacion),
      numero: detail.numero || (detail.contrato && detail.contrato.nroDescripcion) || detail.nroContratacion || "N/A",
      tipo: detail.tipo || (detail.contrato && detail.contrato.nomObjetoContrato) || detail.nomObjetoContrato || "Servicio",
      descripcion: detail.descripcion || (detail.contrato && detail.contrato.desObjetoContrato) || detail.desObjetoContrato || "",
      entidad: detail.entidad || (detail.contrato && detail.contrato.nomEntidad) || detail.nomEntidad || "",
      estado: detail.estado || (detail.contrato && detail.contrato.nomEstadoContrato) || detail.nomEstadoContrato || "Vigente",
      fechaPublicacion: detail.fechaPublicacion || (detail.contrato && detail.contrato.fecPublica) || detail.fecPublica || "",
      inicioCotizacion: detail.inicioCotizacion || (detail.contrato && detail.contrato.fecIniCotizacion) || detail.fecIniCotizacion || "",
      finCotizacion: detail.finCotizacion || (detail.contrato && detail.contrato.fecFinCotizacion) || detail.fecFinCotizacion || "",
      puedesCotizar: detail.puedesCotizar ?? (detail.contrato && detail.contrato.ingresarInvProveedor === 1) ?? detail.cotizar ?? false,
      nomSigla: detail.nomSigla || (detail.contrato && detail.contrato.nomSigla),
      nomTipoCotizacion: detail.nomTipoCotizacion || (detail.contrato && detail.contrato.nomTipoCotizacion),
    };
    return <ContractCard contract={contract as any} onViewDetail={onViewDetail} />;
  }

  if (
    (toolName === "listDepartments" ||
      toolName === "listContractTypes" ||
      toolName === "listContractStates") &&
    Array.isArray(result)
  ) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {(result as Array<{ id: number; nombre: string }>).map((item) => (
          <span
            key={item.id}
            className="inline-flex items-center rounded-md border px-2 py-0.5 text-xs"
          >
            {item.nombre}
          </span>
        ))}
      </div>
    );
  }

  return null;
}

export function MessageBubble({
  message,
  onViewDetail,
}: {
  message: Message;
  onViewDetail?: (id: number) => void;
}) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <Avatar className="shrink-0 mt-1">
        <AvatarFallback
          className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}
        >
          {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={`flex flex-col gap-2 max-w-[85%] ${isUser ? "items-end" : ""}`}
      >
        {message.content && (
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm ${
              isUser
                ? "bg-primary text-primary-foreground rounded-tr-sm"
                : "bg-muted rounded-tl-sm"
            }`}
          >
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 mb-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 mb-1">{children}</ol>
                ),
                li: ({ children }) => <li className="mb-0.5">{children}</li>,
                strong: ({ children }) => (
                  <strong className="font-semibold">{children}</strong>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.toolInvocations?.map((invocation) => {
          if (invocation.state === "result") {
            return (
              <div key={invocation.toolCallId} className="w-full">
                <ToolResult
                  toolName={invocation.toolName}
                  result={invocation.result}
                  onViewDetail={onViewDetail}
                />
              </div>
            );
          }
          if (invocation.state === "call") {
            return (
              <div
                key={invocation.toolCallId}
                className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse"
              >
                <div className="size-2 rounded-full bg-primary animate-bounce" />
                Buscando en SEACE...
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}
