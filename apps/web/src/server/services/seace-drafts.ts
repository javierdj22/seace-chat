import crypto from "crypto";
import { db, and, desc, eq } from "@repo/db";
import { seaceDrafts } from "@repo/db/schema";

export async function listDraftsByUser(userId: string) {
  return db.select().from(seaceDrafts).where(eq(seaceDrafts.userId, userId));
}

export async function getDraftById(draftId: string) {
  const [draft] = await db.select().from(seaceDrafts).where(eq(seaceDrafts.id, draftId));
  return draft || null;
}

export async function hasDraftForContract(userId: string, contractId: number) {
  const drafts = await db
    .select({ id: seaceDrafts.id })
    .from(seaceDrafts)
    .where(and(eq(seaceDrafts.userId, userId), eq(seaceDrafts.contractId, contractId)))
    .limit(1);

  return drafts.length > 0;
}

export async function findLatestDraftForUserContract(userId: string, contractId: number) {
  const [draft] = await db
    .select()
    .from(seaceDrafts)
    .where(and(eq(seaceDrafts.userId, userId), eq(seaceDrafts.contractId, contractId)))
    .orderBy(desc(seaceDrafts.updatedAt))
    .limit(1);

  return draft || null;
}

interface UpsertDraftParams {
  userId: string;
  contractId: number;
  body: any;
  payloadSeace: any;
}

export async function upsertDraftForContract({
  userId,
  contractId,
  body,
  payloadSeace,
}: UpsertDraftParams) {
  const existing = await db
    .select()
    .from(seaceDrafts)
    .where(and(eq(seaceDrafts.userId, userId), eq(seaceDrafts.contractId, contractId)))
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
    payloadSeace,
    updatedAt: new Date(),
  };

  const previousCotizacionId =
    body.id_cotizacion || body.idCotizacion || (existing[0] as any)?.idCotizacion;

  if (previousCotizacionId) {
    draftData.idCotizacion = previousCotizacionId;
  }

  if (existing.length > 0) {
    await db.update(seaceDrafts).set(draftData).where(eq(seaceDrafts.id, existing[0].id));
    return { saved: true, draftId: existing[0].id };
  }

  const draftId = `drf_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(seaceDrafts).values({
    ...draftData,
    id: draftId,
    userId,
    contractId,
    documentosAdjuntos: [],
  });

  return { saved: true, draftId };
}

interface UpdateDraftSyncStateParams {
  userId: string;
  contractId: number;
  mode?: string;
  seaceOk: boolean;
  idCotizacion?: string | number | null;
}

export async function updateDraftSyncState({
  userId,
  contractId,
  mode,
  seaceOk,
  idCotizacion,
}: UpdateDraftSyncStateParams) {
  const updateData: any = { updatedAt: new Date() };

  if (seaceOk && mode === "enviar") {
    updateData.estado = "ENVIADO";
  }

  if (idCotizacion) {
    updateData.idCotizacion = String(idCotizacion);
  }

  await db
    .update(seaceDrafts)
    .set(updateData)
    .where(and(eq(seaceDrafts.userId, userId), eq(seaceDrafts.contractId, contractId)));
}
