"use client";

import { useState, useEffect } from "react";
import {
  X,
  FileText,
  Calendar,
  Building2,
  Clock,
  Package,
  FileDown,
  ArrowLeft,
  Printer,
  ChevronRight,
  Info,
  CheckCircle2,
  History,
  TrendingUp,
  AlertCircle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ContractDetailModalProps {
  contractId: number;
  contractNumero: string;
  onClose: () => void;
}

function MobileDataRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </p>
      <div className="mt-1 text-sm font-medium leading-5 text-slate-700">{value}</div>
    </div>
  );
}

export function ContractDetailModal({
  contractId,
  contractNumero,
  onClose
}: ContractDetailModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch(`/api/seace-contract?action=get-detail&id_contrato=${contractId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) {
          setError(json.error);
        } else {
          setData(json);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [contractId]);

  const contrato = data?.completo?.uitContratoCompletoProjection || data?.completo?.contrato || {};
  const etapas = data?.completo?.uitContratoEtapaProjectionList || data?.completo?.lsEtapaCronograma || [];
  const cuis = data?.completo?.uitContratoInvierteProjectionList || data?.completo?.lsInvierte || [];
  const items = data?.completo?.uitContratoItemProjectionList || data?.completo?.lsContratoItem || [];
  const archivos = data?.archivos || [];

  const getEtapa = (nom: string) =>
    etapas.find((e: any) => 
      (e.desEtapa || e.nomEtapaContrato || "").toLowerCase().includes(nom.toLowerCase())
    );

  // Helper para mapear fechas de etapas que cambian entre servicios
  const getEtapaDates = (stage: any) => {
    if (!stage) return { inicio: "-", fin: "-" };
    return {
      inicio: stage.fecEtapaInicio || stage.fecIni || "-",
      fin: stage.fecEtapaFin || stage.fecFin || "-"
    };
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="flex h-[100dvh] w-full flex-col overflow-hidden border border-gray-200 bg-white shadow-2xl sm:max-h-[92vh] sm:max-w-4xl sm:rounded-[28px]">

        {/* â”€â”€ Header â”€â”€ */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              Detalle de la contratacion
            </h2>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-tight mt-1">
              {contrato.nomEntidad || "CARGANDO ENTIDAD..."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full bg-slate-100 text-slate-500 size-8 flex items-center justify-center hover:bg-slate-200 transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* â”€â”€ Body â”€â”€ */}
        <div className="flex-1 overflow-y-auto bg-slate-50/30 px-4 py-4 space-y-4 sm:p-6 sm:space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-3 text-blue-600 animate-pulse">
              <Info className="size-12" />
              <div className="text-sm font-semibold">Consultando el repositorio tecnico de SEACE...</div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm font-medium">
              {error}
            </div>
          ) : (
            <>
              {/* Informacion general */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b bg-slate-50/50 flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Info className="size-4 text-blue-600" /> Informacion general
                </div>
                <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 md:gap-x-8 md:gap-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Nro. contratacion</label>
                    <p className="text-sm font-bold text-slate-700">{contrato.desNroContratacion || contrato.nroDescripcion || contractNumero}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Objeto / descripcion</label>
                    <p className="text-sm font-semibold text-slate-700 leading-tight">
                        {contrato.desContratacion || contrato.desObjetoContrato || contrato.descBien || "-"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Area usuaria / sigla</label>
                    <p className="text-sm text-slate-600 leading-tight">{contrato.nomAreaUsuaria || contrato.nomSigla || contrato.nomUnidadEjecutora || "-"}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Fecha de publicacion</label>
                    <p className="text-sm text-slate-600">{contrato.fecPublicacion || contrato.fecPublica || "-"}</p>
                  </div>
                  <div className="button-group mt-2 flex flex-col gap-2 sm:flex-row md:col-span-2">
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Sistema de contratacion</label>
                      <p className="text-[11px] text-slate-500">{contrato.nomSistemaContratacion || "-"}</p>
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Modalidad</label>
                      <p className="text-[11px] text-slate-500">{contrato.nomModalidad || "-"}</p>
                    </div>
                    <div className="space-y-1 flex-1">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">Tipo de seleccion</label>
                      <p className="text-[11px] text-slate-500">{contrato.nomTipoSeleccion || "-"}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Cronograma */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b bg-slate-50/50 flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Calendar className="size-4 text-blue-600" /> Cronograma
                </div>
                <div className="p-4">
                  <div className="border rounded-lg overflow-hidden bg-slate-50/50">
                    <div className="grid grid-cols-3 text-[10px] font-bold text-slate-500 bg-white border-b px-4 py-2 uppercase tracking-wide">
                      <div className="col-span-1">Etapa</div>
                      <div>Fecha y hora Inicio</div>
                      <div>Fecha y hora Fin</div>
                    </div>
                    <div className="flex flex-col divide-y divide-slate-100">
                      {[
                        { label: "Consulta de Requerimiento", stage: getEtapa("Consulta"), icon: History },
                        { label: "Etapa de cotizacion", stage: getEtapa("Cotiza"), icon: TrendingUp },
                        { label: "Seleccion de proveedor", stage: getEtapa("SelecciÃ³n"), icon: CheckCircle2 }
                      ].map((item, idx) => {
                        const isCurrent = item.stage?.nomEstadoEtapa === 'VIGENTE';
                        const dates = getEtapaDates(item.stage);
                        return (
                          <div key={idx} className={`grid grid-cols-1 sm:grid-cols-3 px-4 py-3 text-sm items-center transition-colors ${isCurrent ? 'bg-blue-50/50' : 'hover:bg-white'}`}>
                            <div className="flex items-center gap-2">
                               <item.icon className={`size-4 ${isCurrent ? 'text-blue-600' : 'text-slate-400'}`} />
                               <span className={`font-bold ${isCurrent ? 'text-blue-700' : 'text-slate-700'}`}>{item.label}</span>
                            </div>
                            <div className="text-slate-600 flex items-center gap-1">
                               <span className="sm:hidden text-[10px] font-bold text-slate-400">INICIO:</span>
                               {dates.inicio}
                            </div>
                            <div className="text-slate-600 flex items-center gap-1">
                               <span className="sm:hidden text-[10px] font-bold text-slate-400">FIN:</span>
                               {dates.fin}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </section>

              {/* CUI */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b bg-slate-50/50 flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Building2 className="size-4 text-blue-600" /> Listado de codigo unico de inversion
                </div>
                <div className="min-h-[100px]">
                  <div className="space-y-3 p-4 sm:hidden">
                    {cuis.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
                        <AlertCircle className="size-5 opacity-40" />
                        No se encontraron datos
                      </div>
                    ) : (
                      cuis.map((c: any, i: number) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">Registro {i + 1}</span>
                            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                              CUI
                            </span>
                          </div>
                          <div className="space-y-2">
                            <MobileDataRow label="Codigo" value={c.codUnicoInversion || "-"} />
                            <MobileDataRow label="Descripcion" value={c.desInversion || "-"} />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="hidden w-full overflow-x-auto text-[10px] sm:block sm:text-xs">
                    <table className="w-full">
                      <thead className="bg-[#005CAD] text-white">
                        <tr>
                          <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">NÂ°</th>
                          <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">CUI</th>
                          <th className="px-4 py-2 text-left font-semibold">DescripciÃ³n</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {cuis.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="px-4 py-8 text-center text-slate-400 italic bg-white">
                              <div className="flex flex-col items-center gap-2">
                                <div className="size-8 rounded-full bg-slate-50 flex items-center justify-center"></div>
                                No se encontraron datos
                              </div>
                            </td>
                          </tr>
                        ) : (
                          cuis.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-600 border-r">{i + 1}</td>
                              <td className="px-4 py-2 font-mono text-blue-700 border-r">{c.codUnicoInversion}</td>
                              <td className="px-4 py-2 text-slate-700">{c.desInversion || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>

              {/* Requerimientos (Archivos) */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b bg-slate-50/50 flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <FileText className="size-4 text-blue-600" /> Requerimientos
                </div>
                 <div className="p-4 space-y-2">
                   {archivos.length === 0 ? (
                     <div className="flex flex-col items-center py-6 text-slate-400">
                        <AlertCircle className="size-8 opacity-20 mb-2" />
                        <p className="text-sm italic">No hay archivos vinculados en esta etapa.</p>
                     </div>
                   ) : (
                     archivos.map((file: any, i: number) => {
                       const fileName = file.nombre || file.nomArchivo || "Archivo";
                       const idArchivo = file.idContratoArchivo || file.idArchivo;
                       const sizeStr = file.tamanio ? `(${(parseInt(file.tamanio) / (1024 * 1024)).toFixed(2)} MB)` : "";
                       
                       return (
                         <a 
                           key={i}
                           href={`/api/seace-contract?action=download-file&id_archivo=${idArchivo}&id_contrato=${contractId}`}
                           target="_blank" 
                           rel="noopener noreferrer"
                           className="group flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all bg-white"
                         >
                           <div className="flex items-center gap-3">
                             <div className="size-8 rounded bg-red-50 flex items-center justify-center text-red-500 border border-red-100 group-hover:scale-110 transition-transform">
                               <FileText className="size-4" />
                             </div>
                             <div>
                               <p className="text-xs font-bold text-slate-700">
                                 {sizeStr} {fileName}
                               </p>
                               <p className="text-[10px] text-slate-400">
                                 {file.nombreTipoArchivo || file.desDescripcion || "TDR / Especificaciones tecnicas"}
                               </p>
                             </div>
                           </div>
                           <FileDown className="size-4 text-slate-300 group-hover:text-blue-500" />
                         </a>
                       );
                     })
                   )}
                 </div>
               </section>

               {/* Requerimientos TÃ©cnicos MÃ­nimos (RTM) */}
               <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                 <div className="px-4 py-2 border-b bg-amber-50/50 flex items-center gap-2 text-amber-800 font-bold text-sm">
                   <Package className="size-4 text-amber-600" /> Requerimientos tecnicos (RTM)
                 </div>
                <div className="p-4 space-y-3 sm:hidden">
                   {(data?.completo?.lsContratoRtm?.length || 0) === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm italic text-slate-400">No se detallan RTMs especificos en formato de tabla. Verifique los documentos adjuntos.</div>
                   ) : (
                      data.completo.lsContratoRtm.map((rtm: any, i: number) => (
                        <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                          <div className="mb-3 flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-400">RTM {i + 1}</span>
                            <Package className="size-4 text-amber-600" />
                          </div>
                          <div className="space-y-2">
                            <MobileDataRow label="Descripcion" value={rtm.desRtm || rtm.nomRtm || "-"} />
                            <MobileDataRow label="Valor referencial" value={rtm.valor || "-"} />
                          </div>
                        </div>
                      ))
                   )}
                </div>
                <div className="hidden w-full overflow-x-auto text-[10px] sm:block sm:text-xs">
                    {(data?.completo?.lsContratoRtm?.length || 0) === 0 ? (
                       <div className="p-8 text-center text-slate-400 italic">No se detallan RTM especificos en formato de tabla. Verifica los documentos adjuntos.</div>
                    ) : (
                      <table className="w-full">
                        <thead className="bg-[#005CAD] text-white">
                          <tr>
                            <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">NÂ°</th>
                            <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">DescripciÃ³n del Requerimiento</th>
                            <th className="px-4 py-2 text-center font-semibold">Valor Referencial</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {data.completo.lsContratoRtm.map((rtm: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-4 py-2 text-slate-600 border-r">{i + 1}</td>
                              <td className="px-4 py-2 border-r text-slate-700">{rtm.desRtm || rtm.nomRtm || "-"}</td>
                              <td className="px-4 py-2 text-center text-slate-500">{rtm.valor || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                 </div>
               </section>

              {/* Items registrados */}
              <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                <div className="px-4 py-2 border-b bg-slate-50/50 flex items-center gap-2 text-slate-700 font-bold text-sm">
                  <Package className="size-4 text-blue-600" /> Items registrados
                </div>
                <div className="space-y-3 p-4 sm:hidden">
                  {items.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm italic text-slate-400">
                      No se encontraron items registrados.
                    </div>
                  ) : (
                    items.map((it: any, i: number) => (
                      <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                        <div className="mb-3 flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-400">Item {i + 1}</span>
                          <Badge variant="outline" className={`text-[10px] uppercase ${it.nomEstadoItem === 'DESIERTO' ? 'text-red-500 border-red-200' : 'text-slate-500'}`}>
                            {it.nomEstadoItem || it.nomEstadoContrato || "VIGENTE"}
                          </Badge>
                        </div>
                        <div className="space-y-2">
                          <MobileDataRow label="Cubso" value={it.codCubso || "-"} />
                          <MobileDataRow label="Descripcion" value={it.descripcionItem || it.nomCubso || it.descBien || "-"} />
                          <div className="grid grid-cols-2 gap-2">
                            <MobileDataRow label="Cantidad" value={it.cantidad || "-"} />
                            <MobileDataRow label="Unidad" value={it.nomUnidadMedida || it.siglaUM || it.unidadMedida || "-"} />
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <MobileDataRow label="Moneda" value={it.siglaMoneda || it.moneda || "SOLES"} />
                            <MobileDataRow label="Lugar" value={it.nomDistritoExt || (it.nomDepartamento ? `${it.nomDepartamento}/${it.nomProvincia}/${it.nomDistrito}` : "-")} />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="hidden w-full overflow-x-auto text-xs sm:block">
                  <table className="w-full">
                    <thead className="bg-[#005CAD] text-white">
                      <tr>
                        <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">NÂ°</th>
                        <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">CUBSO</th>
                        <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">DescripciÃ³n</th>
                        <th className="px-4 py-2 text-center font-semibold border-r border-blue-400/30">Cant.</th>
                        <th className="px-4 py-2 text-center font-semibold border-r border-blue-400/30">Unidad</th>
                        <th className="px-4 py-2 text-center font-semibold border-r border-blue-400/30">Moneda</th>
                        <th className="px-4 py-2 text-center font-semibold border-r border-blue-400/30">Lugar</th>
                        <th className="px-4 py-2 text-center font-semibold">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {items.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-4 py-8 text-center text-slate-400 bg-white italic">
                            No se encontraron items registrados.
                          </td>
                        </tr>
                      ) : (
                        items.map((it: any, i: number) => (
                          <tr key={i} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-2 text-slate-600 border-r text-center">{i + 1}</td>
                            <td className="px-4 py-2 border-r font-mono text-slate-700">{it.codCubso || "-"}</td>
                            <td className="px-4 py-2 border-r text-slate-700 leading-tight">{it.descripcionItem || it.nomCubso || it.descBien || "-"}</td>
                            <td className="px-4 py-2 border-r text-center text-slate-700 font-bold bg-slate-50/30">{it.cantidad || "-"}</td>
                            <td className="px-4 py-2 border-r text-center text-slate-500 uppercase">{it.nomUnidadMedida || it.siglaUM || it.unidadMedida || "-"}</td>
                            <td className="px-4 py-2 border-r text-center text-slate-500">{it.siglaMoneda || it.moneda || "SOLES"}</td>
                            <td className="px-4 py-2 border-r text-[10px] text-slate-500 max-w-[120px] leading-none uppercase">
                              {it.nomDistritoExt || (it.nomDepartamento ? `${it.nomDepartamento}/${it.nomProvincia}/${it.nomDistrito}` : "-")}
                            </td>
                            <td className="px-4 py-2 text-center">
                               <Badge variant="outline" className={`text-[9px] uppercase ${it.nomEstadoItem === 'DESIERTO' ? 'text-red-500 border-red-200' : 'text-slate-500'}`}>
                                  {it.nomEstadoItem || it.nomEstadoContrato || "VIGENTE"}
                               </Badge>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Resultado de la contratacion (Si existe) */}
              {(contrato.nomEstadoContrato === 'ADJUDICADO' || items.some((it: any) => it.nomEstadoItem === 'DESIERTO' || it.nomEstadoItem === 'ADJUDICADO')) && (
                 <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4 animate-in fade-in slide-in-from-bottom-4">
                   <div className="px-4 py-2 border-b bg-green-50/50 flex items-center gap-2 text-green-800 font-bold text-sm">
                     <CheckCircle2 className="size-4 text-green-600" /> Resultado de la contratacion
                   </div>
                   <div className="space-y-3 p-4 sm:hidden">
                     {items.map((it: any, i: number) => (
                       <div key={i} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
                         <div className="mb-3 flex items-center justify-between">
                           <span className="text-xs font-semibold text-slate-400">Resultado {i + 1}</span>
                           <Badge className={it.nomEstadoItem === 'DESIERTO' ? 'bg-red-500' : 'bg-green-600'}>
                             {it.nomEstadoItem || "-"}
                           </Badge>
                         </div>
                         <div className="space-y-2">
                           <MobileDataRow label="Cubso" value={it.codCubso || "-"} />
                           <MobileDataRow label="Ruc" value={it.rucAdjudicado || it.numRuc || "-"} />
                           <MobileDataRow label="Proveedor" value={it.proveedorAdjudicado || it.nomRazonSocial || (it.nomEstadoItem === 'DESIERTO' ? 'SIN ADJUDICAR' : '-')} />
                           <MobileDataRow label="Oferta total" value={it.montoAdjudicado ? `${it.siglaMoneda || 'S/'} ${it.montoAdjudicado.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"} />
                         </div>
                       </div>
                     ))}
                   </div>
                   <div className="hidden w-full overflow-x-auto text-[10px] sm:block sm:text-xs">
                     <table className="w-full">
                       <thead className="bg-[#005CAD] text-white">
                         <tr>
                           <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">NÂ°</th>
                           <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">CUBSO</th>
                           <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">RUC</th>
                           <th className="px-4 py-2 text-left font-semibold border-r border-blue-400/30">Proveedor</th>
                           <th className="px-4 py-2 text-right font-semibold border-r border-blue-400/30">Oferta Total</th>
                           <th className="px-4 py-2 text-center font-semibold">Estado</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-200">
                         {items.map((it: any, i: number) => (
                           <tr key={i} className="hover:bg-slate-50">
                             <td className="px-4 py-2 text-slate-600 border-r">{i + 1}</td>
                             <td className="px-4 py-2 border-r font-mono text-slate-700">{it.codCubso || "-"}</td>
                             <td className="px-4 py-2 border-r text-slate-700 font-mono tracking-tighter">
                                {it.rucAdjudicado || it.numRuc || "-"}
                             </td>
                             <td className="px-4 py-2 border-r text-slate-700 uppercase leading-none">
                                {it.proveedorAdjudicado || it.nomRazonSocial || (it.nomEstadoItem === 'DESIERTO' ? 'SIN ADJUDICAR' : '-')}
                             </td>
                             <td className="px-4 py-2 border-r text-right font-bold text-slate-700">
                                {it.montoAdjudicado ? `${it.siglaMoneda || 'S/'} ${it.montoAdjudicado.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "-"}
                             </td>
                             <td className="px-4 py-2 text-center">
                                <Badge className={it.nomEstadoItem === 'DESIERTO' ? 'bg-red-500' : 'bg-green-600'}>
                                   {it.nomEstadoItem || "-"}
                                </Badge>
                             </td>
                           </tr>
                         ))}
                       </tbody>
                     </table>
                   </div>
                 </section>
              )}

              {/* Consultas y Observaciones (lsPreguntaConsulta) */}
              {(data.completo?.lsPreguntaConsulta?.length || 0) > 0 && (
                 <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-4">
                   <div className="px-4 py-2 border-b bg-slate-50 flex items-center gap-2 text-slate-800 font-bold text-sm">
                     <Clock className="size-4 text-slate-600" /> Consultas y observaciones recibidas
                   </div>
                   <div className="p-4 space-y-4">
                      {data.completo.lsPreguntaConsulta.map((p: any, i: number) => (
                        <div key={i} className="border-l-4 border-blue-500 pl-4 py-2 bg-slate-50/50 rounded-r-lg">
                           <div className="flex justify-between items-start">
                              <span className="text-[10px] font-bold text-blue-600 uppercase">Respuesta {p.numPregunta}</span>
                              <Badge variant="outline" className="text-[9px]">{p.nomEstadoPregunta}</Badge>
                           </div>
                           <p className="text-xs text-slate-700 mt-1 font-medium">{p.desContraste || p.desRespuesta || "Sin respuesta detallada publica."}</p>
                        </div>
                      ))}
                   </div>
                 </section>
              )}
            </>
          )}
        </div>

        {/* â”€â”€ Footer â”€â”€ */}
        <div className="sticky bottom-0 border-t bg-white px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
          <button
            onClick={onClose}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 sm:w-auto sm:px-5"
          >
            <ArrowLeft className="size-4" /> Atras
          </button>
          <button
            onClick={() => window.print()}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#005CAD] text-sm font-bold text-white shadow-lg shadow-blue-200 transition-all hover:bg-[#004a8d] sm:w-auto sm:px-5"
          >
            <Printer className="size-4" /> Imprimir
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

