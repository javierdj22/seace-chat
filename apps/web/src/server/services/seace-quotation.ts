import type { SeaceLoginResult } from "./seace-auth";

export function buildSeaceQuotationPayload(body: any, login: SeaceLoginResult) {
  const payload: any = {
    fecVigencia: body.vigenciaCotizacion
      ? body.vigenciaCotizacion.includes(" ")
        ? body.vigenciaCotizacion
        : `${body.vigenciaCotizacion} 00:00:00`
      : null,
    precioTotal: Number(body.precioTotal) || 0,
    nomCorreo: body.correoContacto || login.email || "",
    numCelular: body.celularContacto || "",
    idContratoInvita: body.idContratoInvita || null,
    uitCotizacionItemRequestList: (body.itemsCotizacion || [])
      .filter((item: any) => item.seleccionado !== false)
      .map((item: any) => ({
        idContratoItem: Number(item.idContratoItem || item.idContratoItemOriginal || item.id),
        precioTotal: Number(item.precioTotal || 0),
        precioUnitario: Number(item.precioUnitarioOfertado ?? 0),
        idCotizacionItem: item.idCotizacionItem || null,
      })),
    idContrato: typeof body.idContrato === "string" ? parseInt(body.idContrato, 10) : body.idContrato,
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

  if (body.comentario) {
    payload.desBienComentario = body.comentario;
  }

  return payload;
}
