import { tool } from "ai";
import { z } from "zod";
import { db, or, ilike, eq, and } from "@repo/db";
import { seaceDrafts } from "@repo/db/schema";
import {
  searchContracts,
  getContractDetail,
  listDepartments,
  listContractTypes,
  listContractStates,
} from "@/lib/seace/client";

function extractYearFromSeaceDate(value?: string | null): number | null {
  if (!value) return null;

  const match = value.match(/(\d{4})/);
  if (!match) return null;

  const year = Number.parseInt(match[1], 10);
  return Number.isNaN(year) ? null : year;
}

const DEPARTMENT_NAMES: Record<number, string> = {
  1: "amazonas",
  2: "ancash",
  3: "apurimac",
  4: "arequipa",
  5: "ayacucho",
  6: "cajamarca",
  7: "callao",
  8: "cusco",
  9: "huancavelica",
  10: "huanuco",
  11: "ica",
  12: "junin",
  13: "la libertad",
  14: "lambayeque",
  15: "lima",
  16: "loreto",
  17: "madre de dios",
  18: "moquegua",
  19: "pasco",
  20: "piura",
  21: "puno",
  22: "san martin",
  23: "tacna",
  24: "tumbes",
  25: "ucayali",
};

const MAX_DEPARTMENT_VALIDATIONS = 8;
const DEPARTMENT_VALIDATION_CONCURRENCY = 3;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function objectContainsText(value: unknown, target: string): boolean {
  if (value == null) return false;

  if (typeof value === "string") {
    return normalizeText(value).includes(target);
  }

  if (Array.isArray(value)) {
    return value.some((item) => objectContainsText(item, target));
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>).some((item) =>
      objectContainsText(item, target),
    );
  }

  return false;
}

async function filterContractsByDepartment(
  contracts: any[],
  requestedDepartment: string,
): Promise<any[]> {
  const candidates = contracts.slice(0, MAX_DEPARTMENT_VALIDATIONS);
  const validated: any[] = [];

  for (let index = 0; index < candidates.length; index += DEPARTMENT_VALIDATION_CONCURRENCY) {
    const batch = candidates.slice(index, index + DEPARTMENT_VALIDATION_CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (contract) => {
        try {
          const detail = await getContractDetail(contract.id);
          return objectContainsText(detail, requestedDepartment) ? contract : null;
        } catch (error) {
          console.warn(
            "=== [AI TOOL EXECUTING] DEPARTMENT VALIDATION ERROR ===",
            {
              contractId: contract.id,
              requestedDepartment,
              error,
            },
          );
          return null;
        }
      }),
    );

    validated.push(...batchResults.filter(Boolean));
  }

  return validated;
}

// SEACE a veces devuelve resultados de otros años aunque se envíe el filtro.
// Normalizamos la fecha publicada para reforzar el filtro localmente.
// Formatos esperados: "09/04/2026 09:59:45" o similares.
export const getSeaceTools = (userId?: string) => ({
  listSavedDrafts: tool({
    description: "Lista todos los borradores de cotizaciones (guardados pero no enviados) o enviados por el usuario en la base de datos local.",
    parameters: z.object({}),
    execute: async () => {
      if (!userId) return { contracts: [] };
      try {
        const drafts = await db.select().from(seaceDrafts).where(eq(seaceDrafts.userId, userId));
        return {
          contracts: drafts.map((d) => ({
            id: d.contractId,
            idCotizacion: d.idCotizacion,
            numero: d.numero,
            tipo: "Servicio",
            descripcion: d.descripcion,
            entidad: d.entidad,
            estado: d.estado == "BORRADOR",
            fechaPublicacion: "",
          })),
        };
      } catch (e) {
        return { contracts: [] };
      }
    },
  }),
  searchContracts: tool({
    description: `Buscar contrataciones públicas en SEACE (contrataciones menores o iguales a 8 UIT del estado peruano).
REQUERIMIENTOS:
- page_size: LIMITA SIEMPRE a un valor entre 3 y 5 (máximo 5) para mostrar solo lo más relevante.
- solo_cotizables: Por defecto DEBE ser TRUE para ver contrataciones vigentes para cotizar.
Filtros:
- palabra_clave: parámetro principal y universal. Sirve para buscar por código de contrato, nomenclatura (ej. CM-448), descripción, sigla, entidad o nombre del servicio/bien.
- objeto_contrato: 1=Bien, 2=Servicio, 3=Obra, 4=Consultoría de Obra
- estado_contrato: 2=Vigente (default), 3=En Evaluación, 4=Culminado
- solo_cotizables: boolean (default TRUE). Ponlo en false solo si el usuario pide ver procesos ya cerrados.
- departamento: ID del departamento (1-25)
- anio: año de la contratación (default: año actual)
- page: número de página (default: 1)
- page_size: (default 5, max 5)`,
    parameters: z.object({
      palabra_clave: z
        .string()
        .optional()
        .describe("Ej: 'CM-448', 'CM-236-2026-SERVIR'. Motor universal."),
      objeto_contrato: z
        .number()
        .optional()
        .describe("Tipo: 1=Bien, 2=Servicio, 3=Obra, 4=Consultoría de Obra"),
      estado_contrato: z
        .number()
        .optional()
        .describe("Estado: 2=Vigente, 3=En Evaluación, 4=Culminado"),
      solo_cotizables: z
        .boolean()
        .optional()
        .describe("Filtra y elimina registros que no permiten cotización. Úsalo si el usuario quiere 'solo órdenes activas para cotizar'"),
      departamento: z
        .number()
        .optional()
        .describe("ID del departamento (1-25)"),
      anio: z.number().optional().describe("Año de la contratación"),
      page: z.number().optional().describe("Número de página"),
      page_size: z
        .number()
        .optional()
        .describe("Resultados por página (max 50)"),
    }),
    execute: async (params) => {
      const hasLocalPostFiltering =
        Boolean(params.anio) ||
        Boolean(params.objeto_contrato) ||
        Boolean(params.departamento) ||
        Boolean(params.solo_cotizables);

      // Fuerza bruta: Si la palabra clave contiene el año (ej. CM-236-2026-SERVIR), obligamos a que busque en ese año.
      if (params.palabra_clave) {
        const matchInfo = params.palabra_clave.match(/-(\d{4})-/);
        if (matchInfo && matchInfo[1]) {
          params.anio = parseInt(matchInfo[1], 10);
        }
      }

      console.log("=== [AI TOOL EXECUTING] searchContracts PARAMS: ===", params);
      const result = await searchContracts(params);
      console.log("=== [AI TOOL EXECUTING] RAW RESULTS count: ===", result.data?.length);

      let localFound: any[] = [];

      // Rescate local: Si SEACE oculta el contrato porque ya tiene borrador, lo rescatamos de Postgres
      if (params.palabra_clave && userId) {
        try {
          const locals = await db.select().from(seaceDrafts).where(
            and(
              or(
                ilike(seaceDrafts.numero, `%${params.palabra_clave}%`),
                ilike(seaceDrafts.descripcion, `%${params.palabra_clave}%`)
              ),
              eq(seaceDrafts.userId, userId)
            )
          );
          localFound = locals.map(l => ({
            idContrato: l.contractId,
            idCotizacion: l.idCotizacion,
            desContratacion: l.numero,
            nomObjetoContrato: "Servicio",
            desObjetoContrato: l.descripcion,
            nomEntidad: l.entidad,
            nomEstadoContrato: l.estado || "Borrador Guardado",
            cotizar: true, // Forzar que aparezca como interactuable
          }));
        } catch (e) {
          console.warn("Error rescatando borradores locales:", e);
        }
      }

      // Fusionar evitando duplicados
      const mergedData = [...(result.data || [])];
      for (const lf of localFound) {
        if (!mergedData.find(m => m.idContrato === lf.idContrato)) {
          mergedData.unshift(lf); // Ponemos los locales arriba
        }
      }

      let processedData = mergedData.map((c: any) => ({
        id: c.idContrato,
        idCotizacion: c.idCotizacion,
        idObjetoContrato: c.idObjetoContrato,
        idEstadoCotiza: c.idEstadoCotiza,
        nomEstadoCotiza: c.nomEstadoCotiza,
        numero: c.desContratacion,
        tipo: c.nomObjetoContrato,
        descripcion: c.desObjetoContrato,
        entidad: c.nomEntidad,
        nomSigla: c.nomSigla,
        estado: c.nomEstadoContrato,
        fechaPublicacion: c.fecPublica,
        inicioCotizacion: c.fecIniCotizacion,
        finCotizacion: c.fecFinCotizacion,
        puedesCotizar: c.cotizar,
      }));

      if (params.anio) {
        const beforeYearFilter = processedData.length;
        processedData = processedData.filter((c: any) => {
          const detectedYear = extractYearFromSeaceDate(c.fechaPublicacion);
          return detectedYear === null || detectedYear === params.anio;
        });

        console.log("=== [AI TOOL EXECUTING] LOCAL YEAR FILTER ===", {
          requestedYear: params.anio,
          before: beforeYearFilter,
          after: processedData.length,
        });
      }

      if (params.objeto_contrato) {
        const beforeObjectFilter = processedData.length;
        processedData = processedData.filter(
          (c: any) =>
            c.idObjetoContrato == null ||
            c.idObjetoContrato === params.objeto_contrato,
        );

        console.log("=== [AI TOOL EXECUTING] LOCAL OBJECT FILTER ===", {
          requestedObject: params.objeto_contrato,
          before: beforeObjectFilter,
          after: processedData.length,
        });
      }

      if (params.departamento && DEPARTMENT_NAMES[params.departamento]) {
        const requestedDepartment = DEPARTMENT_NAMES[params.departamento];
        const beforeDepartmentFilter = processedData.length;
        const validatedResults = await filterContractsByDepartment(
          processedData,
          requestedDepartment,
        );
        processedData = validatedResults;

        console.log("=== [AI TOOL EXECUTING] LOCAL DEPARTMENT FILTER ===", {
          requestedDepartment,
          before: beforeDepartmentFilter,
          after: processedData.length,
          validatedCandidates: Math.min(
            beforeDepartmentFilter,
            MAX_DEPARTMENT_VALIDATIONS,
          ),
          concurrency: DEPARTMENT_VALIDATION_CONCURRENCY,
        });
      }

      // Si pide solo cotizables, descartamos los no vigentes/no cotizables
      if (params.solo_cotizables) {
        processedData = processedData.filter((c: any) => c.puedesCotizar === true);
      }

      const rawPagination = result.pageable
        ? {
            page: result.pageable.pageNumber,
            pageSize: result.pageable.pageSize,
            total: result.pageable.totalElements,
          }
        : { page: 1, pageSize: 10, total: 0 };

      const effectivePagination = hasLocalPostFiltering
        ? {
            ...rawPagination,
            total: processedData.length,
            pageSize: processedData.length || rawPagination.pageSize,
          }
        : rawPagination;

      const emptyResultHint =
        processedData.length === 0
          ? {
              emptyReason: hasLocalPostFiltering
                ? "filtered_out_after_local_validation"
                : "no_results_from_source",
              userMessageHint:
                "No se encontraron resultados utiles con los filtros solicitados. Sugiere ampliar palabra clave, cambiar ano, quitar departamento o ajustar tipo de objeto.",
            }
          : null;

      return {
        contracts: processedData,
        pagination: effectivePagination,
        sourcePagination: rawPagination,
        filtersApplied: {
          localPostFiltering: hasLocalPostFiltering,
          anio: params.anio ?? null,
          objeto_contrato: params.objeto_contrato ?? null,
          departamento: params.departamento ?? null,
          solo_cotizables: params.solo_cotizables ?? null,
        },
        ...emptyResultHint,
      };
    },
  }),

  getContractDetail: tool({
    description:
      "Obtener el detalle completo de una contratación específica por su ID. Incluye información de etapas, ítems, área usuaria y más.",
    parameters: z.object({
      idContrato: z
        .number()
        .describe("ID del contrato a consultar (obtenido de la búsqueda)"),
    }),
    execute: async ({ idContrato }) => {
      const detail = await getContractDetail(idContrato);
      const c = detail.uitContratoCompletoProjection as any;

      // Rescate local del detalle
      let localDraft: any = null;
      if (userId) {
        try {
          const drafts = await db.select().from(seaceDrafts).where(
            and(
              eq(seaceDrafts.contractId, idContrato),
              eq(seaceDrafts.userId, userId)
            )
          );
          if (drafts.length > 0) localDraft = drafts[0];
        } catch (e) { }
      }

      return {
        id: c.idContrato,
        idCotizacion: c.idCotizacion || localDraft?.idCotizacion || localDraft?.id,
        numero: c.nroDescripcion,
        anio: c.anio,
        tipo: c.nomObjetoContrato,
        tipoInvitacion: c.nomTipoInvitacion,
        descripcion: c.desObjetoContrato,
        entidad: c.nomEntidad,
        estado: localDraft?.estado || c.nomEstadoContrato || "Borrador Guardado",
        areaUsuaria: c.nomAreaUsuaria,
        sigla: c.nomSigla,
        fechaPublicacion: c.fecPublica,
        etapas: detail.uitContratoEtapaProjectionList.map((e: any) => ({
          nombre: e.nomEtapaContrato,
          inicio: e.fecIni,
          fin: e.fecFin,
        })),
        items: detail.uitContratoItemProjectionList.map((i: any) => ({
          codigo: i.codCubso,
          nombre: i.nomCubso,
          descripcion: i.descripcionItem,
          cantidad: i.cantidad,
          unidadMedida: i.nomUnidadMedida,
          ubicacion: i.nomDistritoExt,
          proveedor: i.nomRazonSocial,
          precioTotal: i.precioTotal,
          idCotizacionItem: i.idCotizacionItem,
          estadoCotizacion: i.nomEstadoCotiza,
        })),
      };
    },
  }),

  listDepartments: tool({
    description:
      "Listar todos los departamentos del Perú disponibles para filtrar contrataciones.",
    parameters: z.object({}),
    execute: async () => {
      const departments = await listDepartments();
      return departments.map((d) => ({ id: d.id, nombre: d.nom }));
    },
  }),

  listContractTypes: tool({
    description:
      "Listar los tipos de objeto de contratación disponibles (Bien, Servicio, Obra, Consultoría de Obra).",
    parameters: z.object({}),
    execute: async () => {
      const types = await listContractTypes();
      return types.map((t) => ({ id: t.id, nombre: t.nom }));
    },
  }),

  listContractStates: tool({
    description:
      "Listar los estados posibles de una contratación (Vigente, En Evaluación, Culminado).",
    parameters: z.object({}),
    execute: async () => {
      const states = await listContractStates();
      return states.map((s) => ({ id: s.id, nombre: s.nom }));
    },
  }),
});
