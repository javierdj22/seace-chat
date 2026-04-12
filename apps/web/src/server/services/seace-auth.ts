import { cookies } from "next/headers";
import { decryptSeaceCredentials } from "@/server/security/seace-credentials";
import { getSeaceProviderSession } from "@/server/services/seace-provider-session";

const SEACE_BASE_URL = "https://prod6.seace.gob.pe/v1/s8uit-services";
const SEACE_LOGIN_URL = `${SEACE_BASE_URL}/seguridadproveedor/seguridad/validausuariornp`;
const SEACE_ORIGIN = "https://prod6.seace.gob.pe";
const SEACE_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export interface SeaceLoginResult {
  token?: string;
  error?: string;
  ruc?: string;
  razonSocial?: string;
  email?: string;
  message?: string;
}

function decodeJwtProfile(token: string, fallbackUsername: string) {
  let ruc = fallbackUsername;
  let razonSocial = "";
  let email = "";

  try {
    const payloadB64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
    if (!payloadB64) {
      return { ruc, razonSocial, email };
    }

    const payload = JSON.parse(Buffer.from(payloadB64, "base64").toString("utf-8"));
    ruc = payload.nroDocumento || payload.username || fallbackUsername;
    razonSocial = payload.nombreCompleto || "";
    email = payload.email || "";
  } catch {
    // Keep fallbacks when token parsing fails.
  }

  return { ruc, razonSocial, email };
}

export async function authenticateSeaceCredentials(
  username: string,
  password: string,
): Promise<SeaceLoginResult> {
  try {
    const loginRes = await fetch(SEACE_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: SEACE_ORIGIN,
        Referer: `${SEACE_ORIGIN}/auth-proveedor/login`,
        "User-Agent": SEACE_USER_AGENT,
      },
      body: JSON.stringify({ username, password }),
    });

    const loginData = await loginRes.json();

    if (!loginRes.ok || loginData.respuesta !== true || !loginData.token) {
      return {
        error: `OSCE_RECHAZO: ${loginData.mensaje || "Credenciales invalidas."}`,
        message: loginData.mensaje,
      };
    }

    return {
      token: loginData.token,
      ...decodeJwtProfile(loginData.token, username),
      message: loginData.mensaje,
    };
  } catch (error) {
    return {
      error: `ERROR_RED: No se pudo conectar con SEACE: ${String(error)}`,
    };
  }
}

export async function forceFreshSeaceLogin(): Promise<SeaceLoginResult> {
  const cookieStore = await cookies();
  const seaceSessionId = cookieStore.get("seace_session")?.value;
  const creds = cookieStore.get("seace_creds")?.value;

  if (seaceSessionId) {
    const session = await getSeaceProviderSession(seaceSessionId);
    if (session?.username && session.password) {
      return authenticateSeaceCredentials(session.username, session.password);
    }
  }

  if (!creds) {
    return {
      error: "FALTA_COOKIE: No hay credenciales guardadas. Cierra sesion y vuelve a entrar con tu DNI/RUC.",
    };
  }

  try {
    const { username, password } = decryptSeaceCredentials(creds);

    if (!username || !password) {
      return {
        error: "FALTA_COOKIE: Las credenciales guardadas no son validas. Cierra sesion y vuelve a entrar.",
      };
    }

    return authenticateSeaceCredentials(username, password);
  } catch (error) {
    return {
      error: `ERROR_RED: No se pudieron leer las credenciales cifradas de SEACE: ${String(error)}`,
    };
  }
}

export function buildSeaceHeaders(token: string, contractId: string | number) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Origin: SEACE_ORIGIN,
    Referer: `${SEACE_ORIGIN}/cotizacion/cotizaciones/${contractId}/registrar-cotizacion`,
    Accept: "application/json, text/plain, */*",
    "User-Agent": SEACE_USER_AGENT,
    "client-s8uit": JSON.stringify({ terminal: "127.0.0.1" }),
  };
}

export function isMissingSeaceCredentials(error?: string) {
  return Boolean(error?.includes("FALTA_COOKIE"));
}

export function getPublicSeaceErrorMessage(error?: string) {
  if (!error) {
    return "No se pudo autenticar con SEACE.";
  }

  if (error.includes("FALTA_COOKIE")) {
    return "Tu sesion de SEACE no esta disponible. Vuelve a iniciar sesion para continuar.";
  }

  if (error.includes("OSCE_RECHAZO")) {
    return "SEACE rechazo las credenciales registradas. Vuelve a iniciar sesion.";
  }

  if (error.includes("ERROR_RED")) {
    return "No se pudo conectar con SEACE en este momento. Intenta nuevamente en unos minutos.";
  }

  return "No se pudo autenticar con SEACE.";
}

export { SEACE_BASE_URL };
