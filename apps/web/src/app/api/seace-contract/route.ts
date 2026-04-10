import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, eq, and, desc } from "@repo/db";
import { seaceDrafts } from "@repo/db/schema";
import crypto from "crypto";
import { getContractDetail as getPublicContractDetail } from "@/lib/seace/client";
export const dynamic = "force-dynamic";

// ─────────────────────────────────────────────────────────────────────
// AUTENTICACIÓN FORZADA CON SEACE (token fresco cada llamada)
// El JWT de SEACE dura solo ~5 minutos, así que se renegocia siempre.
// ─────────────────────────────────────────────────────────────────────
interface LoginResult {
  token?: string;
  error?: string;
  ruc?: string;
  razonSocial?: string;
  email?: string;
}

async function forceFreshSeaceLogin(): Promise<LoginResult> {
  const cookieStore = await cookies();
  const creds = cookieStore.get("seace_creds")?.value;

  if (!creds) {
    return { error: "FALTA_COOKIE: No hay credenciales guardadas. Cierra sesión y vuelve a entrar con tu DNI/RUC." };
  }

  try {
    const dec = Buffer.from(creds, "base64").toString("utf-8");
    const parts = dec.split("|||");
    const username = parts[0];
    const password = parts.slice(1).join("|||");

    const loginRes = await fetch("https://prod6.seace.gob.pe/v1/s8uit-services/seguridadproveedor/seguridad/validausuariornp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Origin": "https://prod6.seace.gob.pe",
        "Referer": "https://prod6.seace.gob.pe/auth-proveedor/login",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({ username, password })
    });

    const loginData = await loginRes.json();

    if (loginRes.ok && loginData.respuesta === true && loginData.token) {
      // Extraer datos del JWT para armar el payload de proveedor
      let ruc = username, razonSocial = "", email = "";
      try {
        const payloadB64 = loginData.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
        const jwt = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
        ruc = jwt.nroDocumento || jwt.username || username;
        razonSocial = jwt.nombreCompleto || "";
        email = jwt.email || "";
      } catch { }

      return { token: loginData.token, ruc, razonSocial, email };
    } else {
      return { error: `OSCE_RECHAZO: ${loginData.mensaje || "Credenciales inválidas."}` };
    }
  } catch (e) {
    return { error: `ERROR_RED: No se pudo conectar con SEACE: ${e}` };
  }
}

function seaceHeaders(token: string, id_contrato: string) {
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
    "Origin": "https://prod6.seace.gob.pe",
    "Referer": `https://prod6.seace.gob.pe/cotizacion/cotizaciones/${id_contrato}/registrar-cotizacion`,
    "Accept": "application/json, text/plain, */*",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "client-s8uit": JSON.stringify({ terminal: "127.0.0.1" })
  };
}

// ─────────────────────────────────────────────────────────────────────
// GET: Trae data completa del contrato (ítems + RTM + docs)
// También soporta ?action=list-drafts&userId=xxx para listar borradores locales
// ─────────────────────────────────────────────────────────────────────
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ── Sub-acción: listar borradores locales desde Postgres ──
  const action = searchParams.get("action");
  if (action === "list-drafts") {
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId requerido" }, { status: 400 });
    try {
      const drafts = await db.select().from(seaceDrafts).where(eq(seaceDrafts.userId, userId));
      return NextResponse.json({ drafts });
    } catch (e) {
      console.error("[POSTGRES] Error listando borradores:", e);
      return NextResponse.json({ drafts: [] });
    }
  }

  // ── Sub-acción: obtener un borrador local específico ──
  if (action === "get-draft") {
    const draftId = searchParams.get("draftId");
    if (!draftId) return NextResponse.json({ error: "draftId requerido" }, { status: 400 });
    try {
      const [draft] = await db.select().from(seaceDrafts).where(eq(seaceDrafts.id, draftId));
      return NextResponse.json({ draft: draft || null });
    } catch (e) {
      return NextResponse.json({ draft: null });
    }
  }
  // ── Sub-acción: verificar si existe borrador para un contrato ──
  if (action === "get-draft-for-contract") {
    const userId = searchParams.get("userId");
    const contractId = searchParams.get("contractId");
    if (!userId || !contractId) return NextResponse.json({ exists: false });
    try {
      const drafts = await db
        .select({ id: seaceDrafts.id })
        .from(seaceDrafts)
        .where(
          and(
            eq(seaceDrafts.userId, userId),
            eq(seaceDrafts.contractId, parseInt(contractId))
          )
        )
        .limit(1);
      return NextResponse.json({ exists: drafts.length > 0 });
    } catch (e) {
      return NextResponse.json({ exists: false });
    }
  }
  // ── Sub-acción: descargar archivo de SEACE (proxy) ──
  if (action === "download-file") {
    const id_contrato = searchParams.get("id_contrato");
    const id_archivo = searchParams.get("id_archivo");
    if (!id_archivo) return NextResponse.json({ error: "id_archivo requerido" }, { status: 400 });

    const login = await forceFreshSeaceLogin();
    
    let resFile: Response;
    let hdrs: any = {};

    if (!login.token) {
        // Modo GUEST
        console.log(`[SEACE Proxy] Modo GUEST: Descargando archivo público ${id_archivo}`);
        hdrs = { "Accept": "application/json", "client-s8uit": JSON.stringify({ terminal: "127.0.0.1" }) };
        resFile = await fetch(
          `https://prod6.seace.gob.pe/v1/s8uit-services/buscadorpublico/archivo/archivos/descargar-archivo-contrato/${id_archivo}`,
          { method: "GET", headers: hdrs }
        );
    } else {
        // Modo LOGUEADO
        hdrs = seaceHeaders(login.token, id_contrato || "0");
        resFile = await fetch(
          `https://prod6.seace.gob.pe/v1/s8uit-services/archivo/archivos/descargar-archivo-contrato/${id_archivo}`,
          { method: "GET", headers: hdrs }
        );

        if (resFile.status === 401) {
          const retry = await forceFreshSeaceLogin();
          if (retry.token) {
            hdrs["Authorization"] = `Bearer ${retry.token}`;
            resFile = await fetch(
              `https://prod6.seace.gob.pe/v1/s8uit-services/archivo/archivos/descargar-archivo-contrato/${id_archivo}`,
              { method: "GET", headers: hdrs }
            );
          }
        }
    }

    try {
      if (!resFile.ok) return NextResponse.json({ error: "No se pudo descargar el archivo de SEACE (verifique si es público)" }, { status: resFile.status });

      const blob = await resFile.blob();
      const headers = new Headers();
      headers.set("Content-Type", resFile.headers.get("Content-Type") || "application/octet-stream");
      headers.set("Content-Disposition", resFile.headers.get("Content-Disposition") || "attachment");
      headers.set("Content-Length", blob.size.toString());

      return new NextResponse(blob, { headers });
    } catch (e) {
      return NextResponse.json({ error: "Error en proxy de descarga" }, { status: 500 });
    }
  }

  // ── Sub-acción: obtener detalle completo de la contratación ──
  if (action === "get-detail") {
    const id_contrato = searchParams.get("id_contrato");
    if (!id_contrato) return NextResponse.json({ error: "id_contrato requerido" }, { status: 400 });

    const login = await forceFreshSeaceLogin();
    
    // Si no hay login, intentamos vía repositorio PÚBLICO
    if (!login.token) {
      try {
        console.log(`[SEACE Proxy] Modo GUEST: Consultando repositorio público para contrato ${id_contrato}`);
        const publicDetail = await getPublicContractDetail(parseInt(id_contrato));
        
        // El repositorio público no suele dar listado de archivos directo via listar-completo
        // Pero podemos intentar un fetch público de archivos si es posible
        const publicFilesRes = await fetch(
            `https://prod6.seace.gob.pe/v1/s8uit-services/buscadorpublico/archivo/archivos/listar-archivos-contrato/${id_contrato}/1`,
            { method: "GET", headers: { "Accept": "application/json" } }
        );
        const publicFiles = publicFilesRes.ok ? await publicFilesRes.json() : [];

        return NextResponse.json({
          completo: publicDetail,
          archivos: publicFiles,
          isPublic: true
        });
      } catch (e) {
        return NextResponse.json({ error: "No se pudo obtener el detalle público." }, { status: 401 });
      }
    }

    try {
      const hdrs = seaceHeaders(login.token, id_contrato);

      // 1. Listar completo (Cronograma, CUIs, Ítems)
      const resCompleto = await fetch(
        `https://prod6.seace.gob.pe/v1/s8uit-services/contratacion/contrataciones/listar-completo?id_contrato=${id_contrato}`,
        { method: "GET", headers: hdrs }
      );
      let dataCompleto = resCompleto.ok ? await resCompleto.json() : null;

      // 2. Listar archivos (Documentos/TDR)
      const resArchivos = await fetch(
        `https://prod6.seace.gob.pe/v1/s8uit-services/archivo/archivos/listar-archivos-contrato/${id_contrato}/1`,
        { method: "GET", headers: hdrs }
      );
      let dataArchivos = resArchivos.ok ? await resArchivos.json() : null;

      return NextResponse.json({
        completo: dataCompleto,
        archivos: dataArchivos
      });
    } catch (e) {
      console.error("[SEACE Proxy GET Detail]:", e);
      return NextResponse.json({ error: "Error al comunicar con SEACE" }, { status: 500 });
    }
  }

  // ── Acción principal: consultar SEACE ──
  const id_contrato = searchParams.get("id_contrato");
  if (!id_contrato) {
    return NextResponse.json({ error: "ID de contrato requerido" }, { status: 400 });
  }

  // ── Buscar borrador local opcionalmente ──
  const localUserId = searchParams.get("localUserId");
  let draft: any = null;
  if (localUserId && id_contrato) {
    try {
      console.log(`[POSTGRES] Buscando borrador para User:${localUserId}, Contract:${id_contrato}`);
      const [d] = await db
        .select()
        .from(seaceDrafts)
        .where(
          and(
            eq(seaceDrafts.userId, localUserId),
            eq(seaceDrafts.contractId, parseInt(id_contrato))
          )
        )
        .orderBy(desc(seaceDrafts.updatedAt))
        .limit(1);

      if (d) {
        console.log("[POSTGRES] Borrador encontrado!");
        draft = d;
      } else {
        console.log("[POSTGRES] No hay borrador local.");
      }
    } catch (e) {
      console.error("[POSTGRES] Error crìtico buscando borrador:", e);
    }
  }

  const login = await forceFreshSeaceLogin();
  if (!login.token) {
    return NextResponse.json({ error: login.error }, { status: 401 });
  }

  try {
    // PASO 0: Sincronizar metadatos desde el 'buscador' de SEACE para obtener idCotizacion real
    let seaceMeta: any = null;
    try {
      const contractNum = draft?.numero || searchParams.get("numero");
      if (contractNum || id_contrato) {
        const busqUrl = `https://prod6.seace.gob.pe/v1/s8uit-services/contratacion/contrataciones/buscador?anio=${new Date().getFullYear()}&ruc=${login.ruc}&palabra_clave=${encodeURIComponent(contractNum || id_contrato)}&page=1&page_size=5`;
        const resBusq = await fetch(busqUrl, { method: "GET", headers: seaceHeaders(login.token, "") });
        if (resBusq.ok) {
          const busqData = await resBusq.json();
          const list = busqData.data || busqData.contracts || [];
          seaceMeta = list.find((c: any) => String(c.idContrato || c.id) === String(id_contrato));
          if (seaceMeta) console.log(`[SEACE] Metadatos sincronizados desde buscador: IdCotizacion=${seaceMeta.idCotizacion}`);
        }
      }
    } catch (e) {
      console.error("[SEACE] Error en sincronización inicial de buscador:", e);
    }

    const hdrs = seaceHeaders(login.token, id_contrato);

    // Identificar el ID de cotización (del buscador, del searchParam o del borrador local)
    const id_cotizacion = seaceMeta?.idCotizacion || searchParams.get("id_cotizacion") || (draft as any)?.id_cotizacion || (draft as any)?.idCotizacion;

    if (id_cotizacion) console.log(`[SEACE] Usando IdCotizacion:${id_cotizacion} para sincronizar flujo`);

    // PASO 1: Tocar la página HTML (inicializa WAF/caché de SEACE)
    try {
      const tapUrl = id_cotizacion
        ? `https://prod6.seace.gob.pe/cotizacion/cotizaciones/${id_contrato}/registrar-cotizacion?cotizacion=${id_cotizacion}`
        : `https://prod6.seace.gob.pe/cotizacion/cotizaciones/${id_contrato}/registrar-cotizacion`;
      await fetch(tapUrl, { method: "GET", headers: hdrs });
    } catch { }

    // PASO 2: listar-completo (ítems y cotización)
    let dataItems: any = null;
    let urlItems = id_cotizacion
      ? `https://prod6.seace.gob.pe/v1/s8uit-services/cotizacion/cotizaciones/listar-completo?id_contrato=${id_contrato}&id_cotizacion=${id_cotizacion}`
      : `https://prod6.seace.gob.pe/v1/s8uit-services/cotizacion/cotizaciones/listar-completo?id_contrato=${id_contrato}`;

    const resItems = await fetch(urlItems, { method: "GET", headers: hdrs });
    if (resItems.ok) {
      const body = await resItems.text();
      if (body) {
        dataItems = JSON.parse(body);
        // Si SEACE nos devuelve un ID de cotización que no conocíamos (en uitCotizacionCompletaProjection)
        const idCotDetectado = dataItems?.uitCotizacionCompletaProjection?.idCotizacion;
        if (idCotDetectado && !id_cotizacion) {
          console.log(`[SEACE] IdCotizacion extraído de proyección: ${idCotDetectado}`);
          // Actualizar para el resto de la ejecución
          (id_cotizacion as any) = idCotDetectado;
        }
      }
    }

    // PASO 3: listar-completo (contratación técnica: Cronograma, CUIs, etc.)
    let resContrato = await fetch(
      id_cotizacion
        ? `https://prod6.seace.gob.pe/v1/s8uit-services/contratacion/contrataciones/listar-completo?id_contrato=${id_contrato}&id_cotizacion=${id_cotizacion}`
        : `https://prod6.seace.gob.pe/v1/s8uit-services/contratacion/contrataciones/listar-completo?id_contrato=${id_contrato}`,
      { method: "GET", headers: hdrs }
    );

    if (resContrato.status === 401) {
      const retry = await forceFreshSeaceLogin();
      if (retry.token) {
        hdrs["Authorization"] = `Bearer ${retry.token}`;
        resContrato = await fetch(
          `https://prod6.seace.gob.pe/v1/s8uit-services/contratacion/contrataciones/listar-completo?id_contrato=${id_contrato}`,
          { method: "GET", headers: hdrs }
        );
      }
    }

    if (!resContrato.ok) {
      return NextResponse.json({ error: `SEACE devolvió status ${resContrato.status}` }, { status: resContrato.status });
    }

    const dataContrato = await resContrato.json();

    // Devolvemos todo junto + datos del proveedor autenticado + borrador si existe
    return NextResponse.json({
      contrato: dataContrato,
      items: dataItems,
      draft: draft,
      proveedor: {
        codRuc: login.ruc,
        nomRazonSocial: login.razonSocial,
        nomCorreo: login.email,
      }
    });
  } catch (error) {
    console.error("[SEACE Proxy GET]:", error);
    return NextResponse.json({ error: "Error al comunicar con SEACE" }, { status: 500 });
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST: Arma el payload exacto de SEACE y envía a procesar-por-item
// Luego guarda todo en Postgres local
// ─────────────────────────────────────────────────────────────────────
export async function POST(req: Request) {
  const login = await forceFreshSeaceLogin();
  if (!login.token) {
    return NextResponse.json({ error: login.error }, { status: 401 });
  }

  try {
    const body = await req.json();
    const idContrato = body.idContrato;

    // ── Construir el payload EXACTO que SEACE espera ──
    const seacePayload: any = {
      fecVigencia: body.vigenciaCotizacion
        ? (body.vigenciaCotizacion.includes(" ") ? body.vigenciaCotizacion : `${body.vigenciaCotizacion} 00:00:00`)
        : null,
      precioTotal: Number(body.precioTotal) || 0,
      nomCorreo: body.correoContacto || login.email || "",
      numCelular: body.celularContacto || "",
      idContratoInvita: body.idContratoInvita || null,
      uitCotizacionItemRequestList: (body.itemsCotizacion || [])
        .filter((it: any) => it.seleccionado !== false)
        .map((it: any) => ({
          idContratoItem: Number(it.idContratoItem || it.idContratoItemOriginal || it.id),
          precioTotal: Number(it.precioTotal || 0),
          precioUnitario: Number(it.precioUnitarioOfertado ?? 0),
          idCotizacionItem: it.idCotizacionItem || null,
        })),
      idContrato: typeof idContrato === "string" ? parseInt(idContrato) : idContrato,
      uitContratoInvitaRequest: {
        codRuc: login.ruc || "",
        nomRazonSocial: login.razonSocial || "",
        nomCorreo: body.correoContacto || login.email || "",
        dirDomicilio: "",
      },
      uitCotizacionRtmRequestList: (body.rtmList || []).map((rtm: any) => ({
        idContratoRtmValor: Number(rtm.idContratoRtmValor || rtm.idRtmValor || rtm.id),
        tipoProceso: rtm.tipoProceso || "C",
        valor: String(rtm.rtmOfertado || ""),
        idCotizacionRtm: rtm.idCotizacionRtm || null,
      })),
    };

    // Agregar desBienComentario si existe
    if (body.comentario) seacePayload.desBienComentario = body.comentario;

    console.log("[SEACE] Payload armado para procesar-por-item:", JSON.stringify(seacePayload, null, 2));

    // ── PASO 1: GUARDAR EN POSTGRES LOCAL (ARQUITECTURA PRIMERO) ──
    let localSaved = false;
    if (body.localUserId) {
      try {
        const cId = typeof idContrato === "string" ? parseInt(idContrato) : idContrato;
        const existing = await db
          .select()
          .from(seaceDrafts)
          .where(and(eq(seaceDrafts.userId, body.localUserId), eq(seaceDrafts.contractId, cId)))
          .limit(1);

        const draftData: any = {
          numero: body.numeroContrato || "",
          entidad: body.entidadContrato || "",
          descripcion: body.descripcion || "",
          estado: body.modo === "enviar" ? "POR_ENVIAR" : "BORRADOR2",
          itemsCotizacion: body.itemsCotizacion || [],
          rtmList: body.rtmList || [],
          vigenciaCotizacion: body.vigenciaCotizacion || null,
          correoContacto: body.correoContacto || null,
          celularContacto: body.celularContacto || null,
          precioTotal: body.precioTotal || 0,
          payloadSeace: seacePayload,
          updatedAt: new Date(),
        };

        // Si ya tenemos un IdCotizacion previo (de SEACE), lo mantenemos localmente
        const idCotPrevia = body.id_cotizacion || body.idCotizacion || (existing[0] as any)?.idCotizacion;
        if (idCotPrevia) draftData.idCotizacion = idCotPrevia;

        if (existing.length > 0) {
          await db.update(seaceDrafts).set(draftData).where(eq(seaceDrafts.id, existing[0].id));
        } else {
          await db.insert(seaceDrafts).values({
            ...draftData,
            id: `drf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            userId: body.localUserId,
            contractId: cId,
            documentosAdjuntos: [],
          });
        }
        localSaved = true;
      } catch (dbError: any) {
        console.error("[POSTGRES] Error fatal salvando localmente:", dbError.message);
        return NextResponse.json({ ok: false, error: "Error en arquitectura local", details: dbError.message }, { status: 500 });
      }
    }

    // ── PASO 2: SINCRONIZAR CON SEACE (CAC) ──
    const hdrs = seaceHeaders(login.token, String(idContrato));
    let seaceResponse: any = null;
    let seaceOk = false;
    let seaceStatus = 0;

    try {
      let res = await fetch(
        "https://prod6.seace.gob.pe/v1/s8uit-services/cotizacion/cotizaciones/procesar-por-item",
        { method: "POST", headers: hdrs, body: JSON.stringify(seacePayload) }
      );

      // Reintento con token fresco si 401
      if (res.status === 401) {
        const retry = await forceFreshSeaceLogin();
        if (retry.token) {
          hdrs["Authorization"] = `Bearer ${retry.token}`;
          res = await fetch("https://prod6.seace.gob.pe/v1/s8uit-services/cotizacion/cotizaciones/procesar-por-item", {
            method: "POST", headers: hdrs, body: JSON.stringify(seacePayload)
          });
        }
      }

      seaceOk = res.ok;
      seaceStatus = res.status;
      const resText = await res.text();
      try { seaceResponse = JSON.parse(resText); } catch { seaceResponse = { raw: resText }; }

      // Extraer el ID de cotización generado por SEACE (valorNumerico)
      const idCotGenerado = seaceResponse?.valorNumerico;
      if (idCotGenerado) {
        console.log(`[SEACE] Capturado nuevo IdCotizacion: ${idCotGenerado}`);
      }

      // Si SEACE aceptó, actualizamos el estado local y guardamos el ID generado
      if (body.localUserId) {
        const updateData: any = { updatedAt: new Date() };
        if (seaceOk && body.modo === "enviar") updateData.estado = "ENVIADO";
        if (idCotGenerado) {
          // Intentar guardar en la columna que exista (idCotizacion o id_cotizacion)
          updateData.idCotizacion = idCotGenerado;
          updateData.id_cotizacion = idCotGenerado;
        }

        await db.update(seaceDrafts)
          .set(updateData)
          .where(and(eq(seaceDrafts.userId, body.localUserId), eq(seaceDrafts.contractId, parseInt(String(idContrato)))));
      }
    } catch (seaceError) {
      console.error("[SEACE Sync Error]:", seaceError);
      seaceResponse = { error: "CAC_UNAVAILABLE", details: String(seaceError) };
    }

    // ── RESPUESTA: Éxito si se guardó localmente, informando estado de SEACE ──
    return NextResponse.json({
      ok: localSaved, // Priorizamos nuestra arquitectura
      localSaved,
      seaceSynced: seaceOk,
      seaceStatus,
      seaceResponse,
      message: localSaved ? "Borrador persistido en arquitectura local." : "Error en arquitectura local."
    });
  } catch (error) {
    console.error("[SEACE Proxy POST]:", error);
    return NextResponse.json({ error: "Error al procesar la cotización" }, { status: 500 });
  }
}
