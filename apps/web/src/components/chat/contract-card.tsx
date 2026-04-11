"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, FileText, Save, LayoutTemplate, Eye, X, Info, FileDown, LogIn, ShieldAlert } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import { ContractDetailModal } from "./contract-detail-modal";

interface Contract {
  id: number;
  idCotizacion?: number;
  numero: string;
  tipo: string;
  descripcion: string;
  entidad: string;
  estado: string;
  fechaPublicacion: string;
  inicioCotizacion: string;
  finCotizacion: string;
  puedesCotizar: boolean;
}

function getEstadoVariant(estado: string): "default" | "secondary" | "destructive" | "outline" {
  switch (estado) {
    case "Vigente": return "default";
    case "En Evaluación": return "secondary";
    case "Culminado": return "outline";
    default: return "secondary";
  }
}

function getTipoIcon(tipo: string) {
  switch (tipo) {
    case "Servicio": return "S";
    case "Bien": return "B";
    case "Obra": return "O";
    case "Consultoría de Obra": return "CO";
    default: return "?";
  }
}

export function ContractCard({
  contract,
  onViewDetail,
}: {
  contract: Contract;
  onViewDetail?: (id: number) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: session } = useSession();

  // Estado local para cuando el modal guarda un borrador en esta sesión o se detecta asíncronamente
  const [localDraftSaved, setLocalDraftSaved] = useState(false);

  // Un contrato es un borrador si viene con ID de SEACE o si lo hemos marcado/hidratado localmente
  const hasDraft = !!(contract as any).id_cotizacion || !!contract.idCotizacion || localDraftSaved;

  const userId = session?.user?.id;
  useEffect(() => {
    // Si ya viene como borrador directamente o ya lo detectamos, no hace falta buscar
    if (hasDraft || !userId || localDraftSaved) return;

    fetch(`/api/seace-contract?action=get-draft-for-contract&contractId=${contract.id}&userId=${userId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.exists && !localDraftSaved) {
          setLocalDraftSaved(true);
        }
      })
      .catch(() => { });
  }, [contract.id, hasDraft, userId, localDraftSaved]);


  return (
    <>
      <Card className="gap-3 py-4 hover:shadow-md transition-shadow relative">
        <CardHeader className="pb-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                {getTipoIcon(contract.tipo)}
              </div>
              <div>
                <CardTitle className="text-sm">{contract.numero}</CardTitle>
                <CardDescription className="text-xs">{contract.tipo}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <Badge variant={getEstadoVariant(contract.estado)}>
                {contract.estado}
              </Badge>
              {/* {hasDraft && (
                <Badge variant="outline" className="border-blue-300 text-blue-600 bg-blue-50 gap-1 flex items-center">
                  <Save className="size-3" /> Borrador Guardado
                </Badge>
              )} */}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5 pb-0">
          <p className="text-sm text-muted-foreground line-clamp-2 leading-snug">{contract.descripcion}</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1.5">
              <Building2 className="size-3.5 text-slate-400" />
              {(contract as any).nomSigla || contract.entidad}
            </span>
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5 text-slate-400" />
              {contract.fechaPublicacion}
            </span>
            {(contract as any).nomTipoCotizacion && (
              <span className="flex items-center gap-1.5 bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                <FileText className="size-3" />
                {(contract as any).nomTipoCotizacion}
              </span>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex items-center justify-between gap-2 border-t pt-3 mt-3">
          <button
            onClick={() => setIsDetailOpen(true)}
            className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded px-2.5 py-1.5 hover:bg-blue-100 flex items-center gap-1.5 transition-colors font-medium shadow-sm"
          >
            <Info className="size-3.5" /> Ver detalle técnico
          </button>
          {contract.puedesCotizar && !hasDraft && (
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition-colors"
            >
              <LayoutTemplate className="size-3" /> Cotizar
            </button>
          )}
          {hasDraft && (
            <button
              onClick={() => setIsOpen(true)}
              className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
            >
              <Eye className="size-3" /> Ver borrador
            </button>
          )}
        </CardFooter>
      </Card>

      {isOpen && (
        <CotizacionModal
          contract={contract}
          onClose={() => setIsOpen(false)}
          userId={session?.user?.id}
          setHasDraft={() => setLocalDraftSaved(true)}
        />
      )}

      {isDetailOpen && (
        <ContractDetailModal
          contractId={contract.id}
          contractNumero={contract.numero}
          onClose={() => setIsDetailOpen(false)}
        />
      )}
    </>
  );
}

/* ======================================================================
   COMPONENTE DOCCARD - Previsualización de TDR / Documentos
   ====================================================================== */

function DocCard({ doc, index, contractId }: { doc: any; index: number; contractId: number }) {
  const [showPreview, setShowPreview] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);

  const idArchivo = doc.idContratoArchivo || doc.idArchivo || doc.id;
  const fileName = doc.nombre || doc.nomArchivo || doc.nombreArchivo || "documento";
  const label = doc.desDocumento || doc.descripcion || "DOCUMENTO REQUERIDO";
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  // URL del formato original en SEACE (vía nuestro proxy)
  const formatUrl = idArchivo
    ? `/api/seace-contract?action=download-file&id_archivo=${idArchivo}&id_contrato=${contractId}`
    : doc.urlArchivo || doc.rutaArchivo || "";

  // Google Docs Viewer permite previsualizar
  const previewUrl = ext === "pdf"
    ? formatUrl
    : `https://docs.google.com/gview?url=${encodeURIComponent(formatUrl)}&embedded=true`;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFile(file);
      setUploadedUrl(URL.createObjectURL(file));
    }
  };

  const removeFile = () => {
    if (uploadedUrl) URL.revokeObjectURL(uploadedUrl);
    setUploadedFile(null);
    setUploadedUrl(null);
  };

  return (
    <>
      <div className={`border-2 rounded-lg p-4 transition-colors ${uploadedFile ? "border-green-300 bg-green-50/30" : "border-gray-200 bg-gray-50/50"}`}>
        <p className="font-bold text-sm text-gray-800 uppercase tracking-tight">
          {index + 1}. {label}
        </p>

        <div className="flex flex-wrap items-center gap-2 mt-3">
          {formatUrl && (
            <button
              onClick={() => setShowPreview(true)}
              className="inline-flex items-center gap-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors font-medium"
            >
              <Eye className="size-3.5" />
              Previsualizar formato
            </button>
          )}

          {formatUrl && (
            <a
              href={formatUrl}
              download={fileName}
              className="inline-flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-100 transition-colors font-medium bg-white"
            >
              <FileDown className="size-3.5" />
              Descargar {ext ? `(.${ext})` : ""}
              {doc.tamanio && <span className="text-gray-400 ml-1">({(parseInt(doc.tamanio) / 1024).toFixed(1)} KB)</span>}
            </a>
          )}

          {!uploadedFile && (
            <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs border border-dashed border-amber-400 bg-amber-50 rounded-lg px-3 py-1.5 hover:bg-amber-100 transition-colors text-amber-700 font-bold">
              <svg className="size-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
              </svg>
              SUBIR ARCHIVO
              <input type="file" className="hidden" onChange={handleFileUpload} />
            </label>
          )}
        </div>

        {uploadedFile && (
          <div className="mt-3 flex items-center gap-3 bg-white border border-green-200 rounded-lg px-3 py-2 shadow-sm">
            <div className="size-8 rounded bg-green-50 flex items-center justify-center text-green-600 border border-green-100">
              <FileText className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-green-800 truncate">{uploadedFile.name}</p>
              <p className="text-[10px] text-green-600">{(uploadedFile.size / 1024).toFixed(1)} KB — Listo para enviar</p>
            </div>
            <button onClick={removeFile} className="text-red-500 hover:text-red-700 text-xs font-bold bg-red-50 rounded-full size-6 flex items-center justify-center" title="Eliminar">🗑️</button>
          </div>
        )}
      </div>

      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-blue-600" />
                <span className="text-sm font-bold text-gray-800">Vista previa — {label}</span>
              </div>
              <button onClick={() => setShowPreview(false)} className="rounded-full bg-white border text-gray-500 size-8 flex items-center justify-center hover:bg-gray-100 transition-colors">
                <X className="size-5" />
              </button>
            </div>
            <div className="flex-1 bg-gray-200">
              <iframe
                src={uploadedUrl && uploadedFile?.type === "application/pdf" ? uploadedUrl : previewUrl}
                className="w-full h-full border-0"
                title="Vista previa del documento"
              />
            </div>
            <div className="px-4 py-2 border-t bg-slate-50 flex justify-between items-center text-xs text-gray-500">
              <span>Si el visor no carga, descargue el archivo y ábralo localmente.</span>
              <a href={formatUrl} download={fileName} className="text-blue-600 hover:underline font-bold bg-white border border-blue-100 px-3 py-1 rounded-lg">
                Descargar archivo completo
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ======================================================================
   COMPONENTE DOCCARD LOCAL - Documento fijo TDR/EETT (siempre visible)
   ====================================================================== */


/* ======================================================================
   MODAL DE COTIZACIÓN - Replica la interfaz oficial de SEACE
   ====================================================================== */

function extractItems(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Buscar en estructuras conocidas de SEACE
  for (const key of ["data", "lsCotizacionItem", "lista", "lsContratoItem", "lsItems"]) {
    if (raw[key] && Array.isArray(raw[key])) return raw[key];
  }
  if (typeof raw === "object") {
    const found = Object.values(raw).find((v) => Array.isArray(v) && v.length > 0 && (v[0].idContratoItem || v[0].idItem || v[0].descripcion));
    if (found) return found as any[];
  }
  return [];
}

function extractRtm(raw: any): any[] {
  if (!raw) return [];
  // Agregamos raw.items porque el endpoint de cotización mapea ahí el listar-completo
  const sources = [raw.contrato, raw.items, raw];
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    for (const key of [
      "uitContratoRtmCotizacionProjectionList",
      "lsContratoRtm",
      "lsRtm",
      "rtmList",
      "lsContratoRtmValor",
      "lsCotizacionRtm"
    ]) {
      if (src[key] && Array.isArray(src[key])) return src[key];
    }
    // Buscar dentro de lsContratoItem[].lsContratoRtm
    if (src.lsContratoItem && Array.isArray(src.lsContratoItem)) {
      for (const item of src.lsContratoItem) {
        if (item.lsContratoRtm && Array.isArray(item.lsContratoRtm) && item.lsContratoRtm.length > 0) {
          return item.lsContratoRtm;
        }
        if (item.lsContratoRtmValor && Array.isArray(item.lsContratoRtmValor) && item.lsContratoRtmValor.length > 0) {
          return item.lsContratoRtmValor;
        }
      }
    }
  }
  return [];
}

function extractDocs(raw: any): any[] {
  if (!raw) return [];
  // Agregamos raw.items porque el endpoint de cotización mapea ahí el listar-completo
  const sources = [raw.contrato, raw.items, raw];
  for (const src of sources) {
    if (!src || typeof src !== "object") continue;
    // Agregamos contratoArchivoCotizacionProjectionList según reporte del usuario
    for (const key of [
      "contratoArchivoCotizacionProjectionList",
      "lsContratoDocumento",
      "lsDocumento",
      "documentos",
      "lsContratoArchivo"
    ]) {
      if (src[key] && Array.isArray(src[key])) return src[key];
    }
  }
  return [];
}

function isSeaceAuthError(error: string) {
  return error.includes("FALTA_COOKIE") || error.includes("OSCE_RECHAZO");
}

function CotizacionModal({
  contract,
  onClose,
  userId,
  setHasDraft,
}: {
  contract: Contract;
  onClose: () => void;
  userId?: string;
  setHasDraft: (v: boolean) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  // Estado editable del formulario
  const [itemPrices, setItemPrices] = useState<Record<number, number>>({});
  const [itemChecks, setItemChecks] = useState<Record<number, boolean>>({});
  const [rtmValues, setRtmValues] = useState<Record<number, string>>({});
  const [vigencia, setVigencia] = useState("");
  const [correo, setCorreo] = useState("");
  const [celular, setCelular] = useState("");

  // Helper para obtener IDs únicos y que el borrador sea persistente
  const getItKey = (it: any, i: number) => it.idContratoItem || it.idItem || it.id || `idx-${i}`;
  const getRtmKey = (r: any, i: number) => r.idContratoRtmValor || r.idRtmValor || r.id || `idx-${i}`;

  useEffect(() => {
    let url = contract.idCotizacion
      ? `/api/seace-contract?id_contrato=${contract.id}&id_cotizacion=${contract.idCotizacion}`
      : `/api/seace-contract?id_contrato=${contract.id}`;

    if (userId) url += `&localUserId=${userId}`;

    fetch(url)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
          console.log("SEACE FULL DATA:", json);
          const its = extractItems(json.items);
          const rtms = extractRtm(json);

          // 1. PRIORIDAD: Recuperar desde nuestra base de datos local (Postgres)
          if (json.draft) {
            const d = json.draft;
            setVigencia(d.vigenciaCotizacion || "");
            setCorreo(d.correoContacto || "");
            setCelular(d.celularContacto || "");

            if (d.itemsCotizacion && Array.isArray(d.itemsCotizacion)) {
              const prices: Record<string | number, number> = {};
              const checks: Record<string | number, boolean> = {};
              d.itemsCotizacion.forEach((it: any, i: number) => {
                const k = getItKey(it, i);
                prices[k] = it.precioUnitarioOfertado ?? it.precioUnitario ?? 0;
                checks[k] = it.seleccionado ?? true;
              });
              setItemPrices(prices);
              setItemChecks(checks);
            } else {
              const ch: Record<string | number, boolean> = {};
              its.forEach((it: any, i: number) => { ch[getItKey(it, i)] = true; });
              setItemChecks(ch);
            }

            if (d.rtmList && Array.isArray(d.rtmList)) {
              const rtmV: Record<string | number, string> = {};
              d.rtmList.forEach((r: any, i: number) => {
                const k = getRtmKey(r, i);
                rtmV[k] = r.valorCotRtm || r.rtmOfertado || "";
              });
              setRtmValues(rtmV);
            }
          }
          // 2. FALLBACK: Si no hay local, buscar si SEACE ya tiene info (del listar-completo)
          else {
            const prices: Record<string | number, number> = {};
            const checks: Record<string | number, boolean> = {};
            const rtmV: Record<string | number, string> = {};

            // Intentar recuperar precios y checks de la respuesta de SEACE
            its.forEach((it: any, i: number) => {
              const k = getItKey(it, i);
              checks[k] = true;
              if (it.precioUnitario) prices[k] = it.precioUnitario;
            });
            if (Object.keys(prices).length > 0) setItemPrices(prices);
            setItemChecks(checks);

            // Intentar recuperar respuestas RTM de SEACE
            rtms.forEach((r: any, i: number) => {
              const k = getRtmKey(r, i);
              if (r.valorCotRtm) rtmV[k] = r.valorCotRtm;
            });
            if (Object.keys(rtmV).length > 0) setRtmValues(rtmV);

            // Intentar recuperar datos de contacto de SEACE (si vienen en el objeto de cotización)
            const cInfo = json.items || {};
            if (cInfo.nomCorreo) setCorreo(cInfo.nomCorreo);
            if (cInfo.numCelular) setCelular(cInfo.numCelular);
            if (cInfo.fecVigencia) {
              const d = new Date(cInfo.fecVigencia);
              if (!isNaN(d.getTime())) setVigencia(d.toISOString().split("T")[0]);
            }
          }
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contract.id, contract.idCotizacion, userId]);

  const items = data ? extractItems(data.items) : [];
  const rtmList = data ? extractRtm(data) : [];
  const docs = data ? extractDocs(data) : [];
  const needsSeaceLogin = isSeaceAuthError(error);
  const loginHref = `/login?redirect=${encodeURIComponent("/chat")}`;

  const calcTotal = () =>
    items.reduce((s: number, it: any, i: number) => {
      const k = getItKey(it, i);
      if (!itemChecks[k]) return s;
      const p = itemPrices[k] ?? it.precioUnitario ?? 0;
      return s + p * (it.cantidad || 1);
    }, 0);

  const handleSave = async (mode: "borrador" | "enviar") => {
    // ── Validaciones Obligatorias ──
    if (!vigencia) return alert("⚠️ Faltan datos: Por favor, seleccione la fecha de vigencia de la cotización.");
    if (!correo) return alert("⚠️ Faltan datos: Por favor, ingrese su correo de contacto.");
    if (!celular) return alert("⚠️ Faltan datos: Por favor, ingrese su celular de contacto.");

    // Validar que los ítems seleccionados tengan precio
    const tieneInvalidos = items.some((it: any, i: number) => {
      const k = getItKey(it, i);
      if (itemChecks[k] === false) return false;
      const p = itemPrices[k] ?? it.precioUnitario ?? 0;
      return p <= 0;
    });

    if (tieneInvalidos) {
      return alert("⚠️ Faltan precios: Asegúrese de ingresar un precio mayor a 0 en los ítems que ha marcado para cotizar.");
    }

    mode === "borrador" ? setSaving(true) : setSending(true);

    const payload = {
      idContrato: contract.id,
      localUserId: userId,
      numeroContrato: contract.numero,
      entidadContrato: contract.entidad,
      modo: mode,
      precioTotal: calcTotal(),
      vigenciaCotizacion: vigencia,
      correoContacto: correo,
      celularContacto: celular,
      itemsCotizacion: items.map((it: any, i: number) => {
        const k = getItKey(it, i);
        return {
          ...it,
          seleccionado: itemChecks[k] ?? true,
          precioUnitarioOfertado: itemPrices[k] ?? it.precioUnitario ?? 0,
          precioTotal: (itemPrices[k] ?? it.precioUnitario ?? 0) * (it.cantidad || 1),
        };
      }),
      rtmList: rtmList.map((rtm: any, i: number) => {
        const k = getRtmKey(rtm, i);
        const val = rtmValues[k] ?? "";
        return {
          ...rtm,
          idCotizacionRtm: rtm.idCotizacionRtm || null,
          valorCotRtm: val,
          rtmOfertado: val, // Mantenemos compatible con borrador anterior
        };
      }),
    };

    try {
      const res = await fetch("/api/seace-contract", {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
      });
      const rd = await res.json();
      if (!res.ok) {
        alert(rd.error || "Error guardando.");
      } else {
        alert(
          mode === "borrador"
            ? "Borrador guardado exitosamente."
            : "Cotización enviada a SEACE exitosamente."
        );
        setHasDraft(true);
        onClose();
      }
    } catch {
      alert("Error de conexión.");
    }
    setSaving(false);
    setSending(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-xl w-full max-w-5xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        {/* ── Header ── */}
        <div className="px-4 sm:px-5 py-2 sm:py-3 border-b flex justify-between items-center bg-amber-50">
          <div>
            <h2 className="text-base font-bold text-amber-900">
              Registro de la cotización
            </h2>
            <p className="text-xs text-amber-700 mt-0.5">
              {contract.entidad} — {contract.numero}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded bg-white border text-gray-500 size-7 flex items-center justify-center hover:bg-gray-100 text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* ── Body scrollable ── */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-amber-600 animate-pulse">
              <LayoutTemplate className="size-10" />
              <div className="text-sm font-medium">
                Cargando datos desde SEACE...
              </div>
            </div>
          )}

          {error && !needsSeaceLogin && (
            <div className="m-4 text-sm border-l-4 border-red-500 bg-red-50 text-red-700 p-4 font-medium flex flex-col gap-2">
              <span>{error}</span>
            </div>
          )}

          {needsSeaceLogin && (
            <div className="m-4 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                  <ShieldAlert className="size-5" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    Inicia sesión para continuar con esta cotización
                  </h3>
                  <p className="text-sm text-slate-600">
                    Para cargar tus datos de proveedor y seguir con el proceso, primero necesitamos validar tu acceso de SEACE.
                  </p>
                  <p className="text-xs text-slate-500">
                    Después del inicio de sesión volverás al chat y podrás retomar esta contratación.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-2 pt-2">
                    <Link
                      href={loginHref}
                      className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 transition-colors"
                    >
                      <LogIn className="size-4" />
                      Iniciar sesión y continuar
                    </Link>
                    <button
                      onClick={onClose}
                      className="inline-flex items-center justify-center rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                      Ahora no
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {data && !loading && (
            <div className="p-5 space-y-6 text-gray-800">

              {/* ─── CABECERA DE INSTRUCCIONES ─── */}
              <section className="border rounded-lg overflow-hidden">
                <div className="bg-white px-4 py-3 border-b">
                  <h3 className="text-sm font-bold">Registro de Cotización por Ítem</h3>
                </div>
                <div className="px-4 py-3 bg-gray-50 text-xs text-gray-600 space-y-1">
                  <p className="font-medium text-gray-700">Tenga en cuenta lo siguiente para el envío de cotización.</p>
                  <ol className="list-decimal list-inside space-y-0.5 pl-1">
                    <li>Para descargar el formato solicitado, pulse el ícono 📄.</li>
                    <li>Complete la información solicitada en los formatos descargados.</li>
                    <li>Para subir el archivo, pulse el ícono ⬆️ <span className="font-semibold text-amber-700">(máximo 50 MB por archivo)</span>.</li>
                    <li>Una vez subido el archivo, el sistema mostrará el archivo y el ícono 🗑️ para eliminar.</li>
                  </ol>
                </div>
              </section>

              {/* ─── DOCUMENTOS SOLICITADOS ─── */}
              <section>
                <h3 className="text-sm font-bold mb-3">
                  Documentos solicitados a presentar por el proveedor
                </h3>
                <div className="space-y-3">
                  {/* Documentos dinámicos de SEACE */}
                  {docs.map((doc: any, i: number) => (
                    <DocCard key={i} doc={doc} index={i} contractId={contract.id} />
                  ))}
                </div>
              </section>

              {/* ─── 2. REGISTRO DE ÍTEMS ─── */}
              <section>
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-sm font-bold">Registro de ítems</h3>
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                    Seleccione los ítems a los cuales enviará su cotización
                  </span>
                </div>
                <div className="overflow-x-auto border rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100 border-b">
                      <tr>
                        <th className="p-2 w-10 text-center">
                          <input
                            type="checkbox"
                            checked={Object.values(itemChecks).every((v) => v)}
                            onChange={(e) => {
                              const all: Record<number, boolean> = {};
                              items.forEach((_: any, i: number) => {
                                all[i] = e.target.checked;
                              });
                              setItemChecks(all);
                            }}
                          />
                        </th>
                        <th className="p-2 text-left w-12">Ítem</th>
                        <th className="p-2 text-left">Descripción</th>
                        <th className="p-2 text-center">Unidad de medida</th>
                        <th className="p-2 text-center w-16">Cantidad</th>
                        <th className="p-2 text-center w-16">Moneda</th>
                        <th className="p-2 text-center w-28">Precio Unitario</th>
                        <th className="p-2 text-right w-24">Precio Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {items.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-6 text-center text-gray-400 italic"
                          >
                            No se detectaron ítems.
                          </td>
                        </tr>
                      ) : (
                        items.map((it: any, i: number) => {
                          const k = getItKey(it, i);
                          const up =
                            itemPrices[k] ?? it.precioUnitario ?? 0;
                          const qty = it.cantidad || 1;
                          const tot = up * qty;
                          return (
                            <tr
                              key={i}
                              className={`hover:bg-blue-50/50 ${!itemChecks[k] ? "opacity-40" : ""}`}
                            >
                              <td className="p-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={itemChecks[k] ?? true}
                                  onChange={(e) =>
                                    setItemChecks((p) => ({
                                      ...p,
                                      [k]: e.target.checked,
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2 text-blue-600 font-medium">
                                {i + 1}
                              </td>
                              <td className="p-2">
                                {it.descripcionItem ||
                                  it.descObjeto ||
                                  it.descripcion ||
                                  "Ítem"}
                              </td>
                              <td className="p-2 text-center uppercase">
                                {it.unidadMedida ||
                                  it.siglaUM ||
                                  "SERVICIO"}
                              </td>
                              <td className="p-2 text-center">{qty}</td>
                              <td className="p-2 text-center">
                                {it.moneda || it.siglaMoneda || "SOLES"}
                              </td>
                              <td className="p-2 text-center">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  placeholder="0.00"
                                  className="w-full border border-amber-400 rounded px-2 py-1 text-right text-sm bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 font-semibold"
                                  value={itemPrices[k] ?? ""}
                                  onChange={(e) =>
                                    setItemPrices((p) => ({
                                      ...p,
                                      [k]:
                                        parseFloat(e.target.value) || 0,
                                    }))
                                  }
                                />
                              </td>
                              <td className="p-2 text-right font-medium">
                                {tot.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── 3. RTM ─── */}
              <section>
                <h3 className="text-sm font-bold mb-3">
                  Registro de Requerimientos Técnicos Mínimos
                </h3>
                <div className="overflow-x-auto border rounded-xl shadow-sm bg-white">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b">
                      <tr className="divide-x divide-slate-200">
                        <th className="p-3 text-center w-14 font-bold text-slate-700 uppercase tracking-tight">Nro</th>
                        <th className="p-3 text-left font-bold text-slate-700 uppercase tracking-tight">Descripción</th>
                        <th className="p-3 text-center w-48 font-bold text-slate-700 uppercase tracking-tight">RTM solicitado</th>
                        <th className="p-3 text-center w-48 font-bold text-slate-700 uppercase tracking-tight">RTM ofertado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rtmList.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-10 text-center text-slate-400 italic bg-white">
                            No se detectaron Requerimientos Técnicos Mínimos (RTM).
                          </td>
                        </tr>
                      ) : (
                        rtmList.map((rtm: any, i: number) => {
                          const k = getRtmKey(rtm, i);
                          return (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors divide-x divide-slate-100">
                              <td className="p-3 text-center text-blue-600 font-bold whitespace-nowrap">
                                {i + 1}
                              </td>
                              <td className="p-3 text-slate-700 font-medium">
                                {rtm.nomRtm || rtm.desRtm || rtm.descripcion || "Requerimiento Técnico"}
                              </td>
                              <td className="p-3 text-center text-slate-600 font-bold bg-slate-50/30">
                                {rtm.valor || rtm.valorConRtm || rtm.valorSolicitado || rtm.desRtmValor || "-"}
                              </td>
                              <td className="p-3 text-center">
                                <input
                                  type="text"
                                  placeholder="Escriba su RTM"
                                  className="w-full border border-slate-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium transition-all"
                                  value={rtmValues[k] ?? ""}
                                  onChange={(e) =>
                                    setRtmValues((p) => ({
                                      ...p,
                                      [k]: e.target.value,
                                    }))
                                  }
                                />
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* ─── 4. INFORMACIÓN ADICIONAL ─── */}
              <section>
                <h3 className="text-sm font-bold mb-3">
                  Información adicional
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Vigencia de Cotización (*)
                    </label>
                    <input
                      type="date"
                      className="w-full border rounded px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={vigencia}
                      onChange={(e) => setVigencia(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Correo electrónico de contacto
                    </label>
                    <input
                      type="email"
                      className="w-full border rounded px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={correo}
                      onChange={(e) => setCorreo(e.target.value)}
                      placeholder={data?.contrato?.correoProveedor || ""}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">
                      Celular de contacto
                    </label>
                    <input
                      type="tel"
                      className="w-full border rounded px-3 py-2 mt-1 text-sm focus:outline-none focus:ring-1 focus:ring-amber-500"
                      value={celular}
                      onChange={(e) => setCelular(e.target.value)}
                      placeholder={data?.contrato?.celularProveedor || ""}
                    />
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* ── Footer: 3 botones oficiales ── */}
        {!loading && !error && data && (
          <div className="px-5 py-3 border-t flex flex-col-reverse sm:flex-row justify-end gap-2 bg-gray-50">
            <button
              onClick={() => handleSave("borrador")}
              disabled={saving}
              className="px-5 py-2 text-sm text-white bg-green-600 rounded hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar borrador"}
            </button>
            <button
              onClick={onClose}
              className="px-5 py-2 text-sm font-medium border border-gray-300 bg-white rounded hover:bg-gray-50 transition-colors"
            >
              ✕ Cancelar
            </button>
            <button
              onClick={() => handleSave("enviar")}
              disabled={sending}
              className="px-5 py-2 text-sm text-white bg-gray-500 rounded hover:bg-gray-600 transition-colors font-medium disabled:opacity-50 flex items-center gap-1 justify-center"
            >
              <svg
                className="size-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
              {sending ? "Enviando..." : "Enviar cotización"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
