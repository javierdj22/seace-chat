import { NextResponse } from "next/server";
import { apiError, apiOk } from "@/server/http/api-response";
import { checkRateLimit, getRequestClientIp } from "@/server/security/rate-limit";
import {
  findLatestDraftForUserContract,
  getDraftById,
  hasDraftForContract,
  listDraftsByUser,
  updateDraftSyncState,
  upsertDraftForContract,
} from "@/server/services/seace-drafts";
import {
  downloadContractFileFromSeace,
  fetchContractFlowData,
  getAuthenticatedContractDetail,
  getPublicContractDetail,
  submitQuotationToSeace,
} from "@/server/services/seace-contracts";
import {
  forceFreshSeaceLogin,
  getPublicSeaceErrorMessage,
  isMissingSeaceCredentials,
} from "@/server/services/seace-auth";
import { buildSeaceQuotationPayload } from "@/server/services/seace-quotation";

export const dynamic = "force-dynamic";

const isDevelopment = process.env.NODE_ENV === "development";

function parseContractId(value: string | null) {
  if (!value) return null;

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function GET(req: Request) {
  const clientIp = getRequestClientIp(req);
  const rateLimit = checkRateLimit(`seace-contract:get:${clientIp}`, {
    maxRequests: 45,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return apiError(
      `Demasiadas consultas a contrataciones. Intenta nuevamente en ${rateLimit.retryAfterSeconds}s.`,
      429,
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "list-drafts") {
    const userId = searchParams.get("userId");
    if (!userId) return apiError("userId requerido", 400);

    try {
      const drafts = await listDraftsByUser(userId);
      return apiOk({ drafts });
    } catch (error) {
      console.error("[SEACE drafts] list failed", error);
      return apiOk({ drafts: [] });
    }
  }

  if (action === "get-draft") {
    const draftId = searchParams.get("draftId");
    if (!draftId) return apiError("draftId requerido", 400);

    try {
      const draft = await getDraftById(draftId);
      return apiOk({ draft });
    } catch (error) {
      console.error("[SEACE drafts] get failed", error);
      return apiOk({ draft: null });
    }
  }

  if (action === "get-draft-for-contract") {
    const userId = searchParams.get("userId");
    const contractId = parseContractId(searchParams.get("contractId"));
    if (!userId || contractId == null) return apiOk({ exists: false });

    try {
      const exists = await hasDraftForContract(userId, contractId);
      return apiOk({ exists });
    } catch (error) {
      console.error("[SEACE drafts] exists check failed", error);
      return apiOk({ exists: false });
    }
  }

  if (action === "download-file") {
    const contractId = searchParams.get("id_contrato") || "0";
    const fileId = searchParams.get("id_archivo");

    if (!fileId) return apiError("id_archivo requerido", 400);

    const login = await forceFreshSeaceLogin();
    if (!login.token) {
      return apiError(getPublicSeaceErrorMessage(login.error), 401, login.error);
    }

    try {
      const response = await downloadContractFileFromSeace(fileId, contractId, login.token);
      if (!response.ok) {
        return apiError("Error al descargar el archivo desde SEACE", response.status);
      }

      const blob = await response.blob();
      const headers = new Headers();
      headers.set("Content-Type", response.headers.get("Content-Type") || "application/octet-stream");
      headers.set("Content-Disposition", response.headers.get("Content-Disposition") || "attachment");
      headers.set("Content-Length", blob.size.toString());

      return new NextResponse(blob, { headers });
    } catch (error) {
      console.error("[SEACE file] download failed", error);
      return apiError("Error en el proxy de descarga", 500, error);
    }
  }

  if (action === "get-detail") {
    const contractId = searchParams.get("id_contrato");
    if (!contractId) return apiError("id_contrato requerido", 400);

    const login = await forceFreshSeaceLogin();
    if (!login.token) {
      if (!isDevelopment || !isMissingSeaceCredentials(login.error)) {
        return apiError(getPublicSeaceErrorMessage(login.error), 401, login.error);
      }

      try {
        return apiOk(await getPublicContractDetail(contractId));
      } catch (error) {
        console.error("[SEACE public detail] failed", error);
        return apiError("Error al consultar el detalle publico de SEACE", 500, error);
      }
    }

    try {
      return apiOk(await getAuthenticatedContractDetail(contractId, login));
    } catch (error) {
      console.error("[SEACE detail] failed", error);
      return apiError("Error al comunicar con SEACE", 500, error);
    }
  }

  const contractId = searchParams.get("id_contrato");
  if (!contractId) {
    return apiError("ID de contrato requerido", 400);
  }

  const contractIdNumber = parseContractId(contractId);
  const localUserId = searchParams.get("localUserId");
  let draft: any = null;

  if (localUserId && contractIdNumber != null) {
    try {
      draft = await findLatestDraftForUserContract(localUserId, contractIdNumber);
    } catch (error) {
      console.error("[SEACE drafts] latest lookup failed", error);
    }
  }

  const login = await forceFreshSeaceLogin();
  if (!login.token) {
    return apiError(getPublicSeaceErrorMessage(login.error), 401, login.error);
  }

  try {
    const flow = await fetchContractFlowData({
      contractId,
      login,
      contractNumber: draft?.numero || searchParams.get("numero"),
    });

    return apiOk({
      contrato: flow.contrato,
      items: flow.items,
      draft,
      idCotizacion: flow.idCotizacion || draft?.idCotizacion || null,
      proveedor: {
        codRuc: login.ruc,
        nomRazonSocial: login.razonSocial,
        nomCorreo: login.email,
      },
    });
  } catch (error) {
    console.error("[SEACE flow] failed", error);
    return apiError("Error al comunicar con SEACE", 500, error);
  }
}

export async function POST(req: Request) {
  const clientIp = getRequestClientIp(req);
  const rateLimit = checkRateLimit(`seace-contract:post:${clientIp}`, {
    maxRequests: 20,
    windowMs: 60_000,
  });

  if (!rateLimit.allowed) {
    return apiError(
      `Demasiadas operaciones de cotizacion. Intenta nuevamente en ${rateLimit.retryAfterSeconds}s.`,
      429,
    );
  }

  const login = await forceFreshSeaceLogin();
  if (!login.token) {
    return apiError(getPublicSeaceErrorMessage(login.error), 401, login.error);
  }

  try {
    const body = await req.json();

    if (!body || typeof body !== "object") {
      return apiError("El cuerpo de la solicitud no es valido.", 400);
    }

    const rawContractId =
      typeof body.idContrato === "string" ? body.idContrato : String(body.idContrato ?? "");
    const contractIdNumber = parseContractId(rawContractId);

    if (contractIdNumber == null) {
      return apiError("idContrato requerido", 400);
    }

    const seacePayload = buildSeaceQuotationPayload(body, login);

    console.log("[SEACE quotation] payload prepared", {
      contractId: contractIdNumber,
      items: seacePayload.uitCotizacionItemRequestList?.length || 0,
      rtm: seacePayload.uitCotizacionRtmRequestList?.length || 0,
      mode: body.modo || "borrador",
    });

    let localSaved = false;
    if (body.localUserId) {
      try {
        await upsertDraftForContract({
          userId: body.localUserId,
          contractId: contractIdNumber,
          body,
          payloadSeace: seacePayload,
        });
        localSaved = true;
      } catch (error) {
        console.error("[SEACE drafts] local upsert failed", error);
        return apiError("No se pudo guardar el borrador local", 500, error);
      }
    }

    let seaceResponse: any = null;
    let seaceOk = false;
    let seaceStatus = 0;

    try {
      const sync = await submitQuotationToSeace(contractIdNumber, seacePayload, login.token);
      seaceResponse = sync.response;
      seaceOk = sync.ok;
      seaceStatus = sync.status;

      if (body.localUserId) {
        await updateDraftSyncState({
          userId: body.localUserId,
          contractId: contractIdNumber,
          mode: body.modo,
          seaceOk,
          idCotizacion: sync.idCotizacion,
        });
      }
    } catch (error) {
      console.error("[SEACE quotation] sync failed", error);
      seaceResponse = { error: "CAC_UNAVAILABLE", details: String(error) };
    }

    const ok = body.localUserId ? localSaved : seaceOk;

    return apiOk({
      ok,
      localSaved,
      seaceSynced: seaceOk,
      seaceStatus,
      seaceResponse,
      message: ok
        ? "Operacion procesada correctamente."
        : "No se pudo completar la operacion.",
    });
  } catch (error) {
    console.error("[SEACE quotation] request failed", error);
    return apiError("Error al procesar la cotizacion", 500, error);
  }
}
