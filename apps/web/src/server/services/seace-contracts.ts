import { buildSeaceHeaders, forceFreshSeaceLogin, SEACE_BASE_URL, type SeaceLoginResult } from "./seace-auth";

async function fetchSeaceResponse(
  url: string,
  options: {
    token: string;
    contractId: string | number;
    method?: string;
    body?: string;
    retryOnUnauthorized?: boolean;
  },
): Promise<Response> {
  const { token, contractId, method = "GET", body, retryOnUnauthorized = true } = options;

  let activeToken = token;
  let response = await fetch(url, {
    method,
    headers: buildSeaceHeaders(activeToken, contractId),
    body,
  });

  if (response.status === 401 && retryOnUnauthorized) {
    const refreshed = await forceFreshSeaceLogin();
    if (refreshed.token) {
      activeToken = refreshed.token;
      response = await fetch(url, {
        method,
        headers: buildSeaceHeaders(activeToken, contractId),
        body,
      });
    }
  }

  return response;
}

export async function getPublicContractDetail(contractId: string) {
  const [dataCompleto, dataArchivos] = await Promise.all([
    fetch(
      `${SEACE_BASE_URL}/buscadorpublico/contrataciones/listar-completo?id_contrato=${contractId}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 },
      },
    ).then(async (res) => (res.ok ? res.json() : null)),
    fetch(`${SEACE_BASE_URL}/archivo/archivos/listar-archivos-contrato/${contractId}/1`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    }).then(async (res) => (res.ok ? res.json() : [])),
  ]);

  return {
    completo: dataCompleto,
    archivos: dataArchivos,
    mode: "public-dev",
  };
}

export async function getAuthenticatedContractDetail(contractId: string, login: SeaceLoginResult) {
  const [completoResponse, archivosResponse] = await Promise.all([
    fetchSeaceResponse(
      `${SEACE_BASE_URL}/contratacion/contrataciones/listar-completo?id_contrato=${contractId}`,
      {
        token: login.token!,
        contractId,
      },
    ),
    fetchSeaceResponse(
      `${SEACE_BASE_URL}/archivo/archivos/listar-archivos-contrato/${contractId}/1`,
      {
        token: login.token!,
        contractId,
      },
    ),
  ]);

  return {
    completo: completoResponse.ok ? await completoResponse.json() : null,
    archivos: archivosResponse.ok ? await archivosResponse.json() : [],
  };
}

export async function downloadContractFileFromSeace(
  fileId: string,
  contractId: string,
  token: string,
) {
  return fetchSeaceResponse(
    `${SEACE_BASE_URL}/archivo/archivos/descargar-archivo-contrato/${fileId}`,
    {
      token,
      contractId,
    },
  );
}

export async function fetchContractFlowData(params: {
  contractId: string;
  login: SeaceLoginResult;
  contractNumber?: string | null;
}) {
  const { contractId, login, contractNumber } = params;

  let seaceMeta: any = null;
  let currentCotizacionId: string | number | null = null;

  try {
    if (contractNumber || contractId) {
      const query = encodeURIComponent(contractNumber || contractId);
      const url = `${SEACE_BASE_URL}/contratacion/contrataciones/buscador?anio=${new Date().getFullYear()}&ruc=${login.ruc}&palabra_clave=${query}&page=1&page_size=5`;
      const response = await fetchSeaceResponse(url, {
        token: login.token!,
        contractId: "0",
      });

      if (response.ok) {
        const searchData = await response.json();
        const list = searchData.data || searchData.contracts || [];
        seaceMeta = list.find((item: any) => String(item.idContrato || item.id) === String(contractId));
        currentCotizacionId = seaceMeta?.idCotizacion || null;
      }
    }
  } catch (error) {
    console.error("[SEACE contracts] metadata sync failed", error);
  }

  const warmupUrl = currentCotizacionId
    ? `https://prod6.seace.gob.pe/cotizacion/cotizaciones/${contractId}/registrar-cotizacion?cotizacion=${currentCotizacionId}`
    : `https://prod6.seace.gob.pe/cotizacion/cotizaciones/${contractId}/registrar-cotizacion`;

  try {
    await fetchSeaceResponse(warmupUrl, {
      token: login.token!,
      contractId,
    });
  } catch {
    // Warmup is best-effort only.
  }

  const itemsUrl = currentCotizacionId
    ? `${SEACE_BASE_URL}/cotizacion/cotizaciones/listar-completo?id_contrato=${contractId}&id_cotizacion=${currentCotizacionId}`
    : `${SEACE_BASE_URL}/cotizacion/cotizaciones/listar-completo?id_contrato=${contractId}`;

  const itemsResponse = await fetchSeaceResponse(itemsUrl, {
    token: login.token!,
    contractId,
  });

  let items: any = null;
  if (itemsResponse.ok) {
    const body = await itemsResponse.text();
    items = body ? JSON.parse(body) : null;
    const detected = items?.uitCotizacionCompletaProjection?.idCotizacion;
    if (!currentCotizacionId && detected) {
      currentCotizacionId = detected;
    }
  }

  const contractUrl = currentCotizacionId
    ? `${SEACE_BASE_URL}/contratacion/contrataciones/listar-completo?id_contrato=${contractId}&id_cotizacion=${currentCotizacionId}`
    : `${SEACE_BASE_URL}/contratacion/contrataciones/listar-completo?id_contrato=${contractId}`;

  const contractResponse = await fetchSeaceResponse(contractUrl, {
    token: login.token!,
    contractId,
  });

  if (!contractResponse.ok) {
    throw new Error(`SEACE devolvio status ${contractResponse.status}`);
  }

  return {
    seaceMeta,
    items,
    contrato: await contractResponse.json(),
    idCotizacion: currentCotizacionId,
  };
}

export async function submitQuotationToSeace(
  contractId: string | number,
  payload: any,
  token: string,
) {
  const response = await fetchSeaceResponse(
    `${SEACE_BASE_URL}/cotizacion/cotizaciones/procesar-por-item`,
    {
      token,
      contractId,
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  const rawText = await response.text();
  let parsed: any;

  try {
    parsed = rawText ? JSON.parse(rawText) : {};
  } catch {
    parsed = { raw: rawText };
  }

  return {
    ok: response.ok,
    status: response.status,
    response: parsed,
    idCotizacion: parsed?.valorNumerico || null,
  };
}
