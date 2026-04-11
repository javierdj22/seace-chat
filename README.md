# SEACE Chat

Aplicación web para buscar contrataciones públicas en SEACE, revisar su detalle técnico y gestionar cotizaciones con apoyo de IA.

## Stack

- Monorepo con `pnpm` + `turbo`
- Frontend y API en `Next.js`
- IA con `AI SDK` + `Google Gemini`
- Autenticación con `better-auth`
- Base de datos PostgreSQL con `Drizzle ORM`

## Estructura

```text
seace-chat/
  apps/
    web/          # App principal Next.js
  packages/
    auth/         # Configuración de autenticación
    db/           # Conexión DB + esquemas Drizzle
```

## Requisitos

- Node.js 20 o superior recomendado
- `pnpm` 10
- PostgreSQL disponible localmente
- Una API key de Google Gemini

## Variables de entorno

Crea un archivo `.env` en la raíz del proyecto tomando como base `.env.example`.

```env
DATABASE_URL=postgresql://user:password@localhost:5432/seace_chat
GOOGLE_GENERATIVE_AI_API_KEY=tu-api-key-de-gemini
BETTER_AUTH_SECRET=una-clave-segura-de-al-menos-32-caracteres
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_BASE_URL=http://localhost:3000
NEXT_PUBLIC_BETTER_AUTH_URL=http://localhost:3000
```

Notas:

- `DATABASE_URL` debe apuntar a una base PostgreSQL existente.
- `GOOGLE_GENERATIVE_AI_API_KEY` es obligatoria para que funcione el chat.
- `BETTER_AUTH_SECRET` debe ser una cadena larga y segura.
- `BETTER_AUTH_URL`, `BETTER_AUTH_BASE_URL` y `NEXT_PUBLIC_BETTER_AUTH_URL` conviene dejarlas en `http://localhost:3000` para desarrollo local.

## Instalación

Instala dependencias desde la raíz:

```bash
pnpm install
```

## Base de datos

El proyecto usa Drizzle y expone scripts desde el workspace raíz.

1. Crea la base de datos en PostgreSQL.
2. Configura `DATABASE_URL` en `.env`.
3. Empuja el esquema:

```bash
pnpm db:push
```

Opcionalmente puedes usar:

```bash
pnpm db:generate
pnpm db:migrate
```

El flujo recomendado queda así:

- `pnpm db:generate` para generar una nueva migración a partir del schema
- `pnpm db:migrate` para aplicar migraciones versionadas

Ya existe una migración inicial en `packages/db/drizzle` y una migración defensiva para compatibilidad legacy de `payload -> payload_seace`.

Si tu base local ya existía antes de introducir Drizzle migrations y fue creada con `db:push` o scripts manuales, primero registra la baseline:

```bash
pnpm --filter @repo/db db:baseline
pnpm db:migrate
```

`db:baseline` no crea tablas nuevas; solo registra en `__drizzle_migrations` las migraciones ya equivalentes al schema actual.

## Ejecutar en local

Desde la raíz:

```bash
pnpm dev
```

Esto levanta el monorepo en modo desarrollo. La app web queda disponible en:

```text
http://localhost:3000
```

## Flujo local esperado

1. Abre `http://localhost:3000`.
2. Entra a `/login`.
3. Inicia sesión con tus credenciales de SEACE/RNP.
4. La app valida primero contra SEACE y luego crea o reutiliza el usuario local en PostgreSQL.
5. Una vez dentro, usa el chat para buscar contrataciones.

## Comandos útiles

```bash
pnpm dev
pnpm build
pnpm db:push
pnpm db:generate
pnpm db:migrate
pnpm --filter @repo/db db:baseline
```

## Archivos clave

- `apps/web/src/app/api/chat/route.ts`: endpoint principal del chat con IA
- `apps/web/src/lib/ai/tools.ts`: herramientas que la IA usa para buscar y consultar contratos
- `apps/web/src/lib/seace/client.ts`: cliente HTTP hacia SEACE público
- `apps/web/src/app/api/seace-verify/route.ts`: validación de credenciales contra SEACE
- `apps/web/src/app/api/seace-contract/route.ts`: detalle, borradores y envío de cotizaciones
- `packages/auth/src/server.ts`: configuración de autenticación
- `packages/db/src/schema/*`: esquemas de base de datos

## Consideraciones

- El chat depende de acceso a internet para consultar SEACE y Gemini.
- Sin PostgreSQL configurado correctamente, no funcionarán autenticación ni borradores.
- El login local está integrado con validación real contra SEACE.
- La app está preparada como monorepo, por eso los comandos deben correrse desde la raíz.

## Solución rápida de problemas

`pnpm db:push` falla:
- Verifica que PostgreSQL esté encendido.
- Revisa que `DATABASE_URL` sea válida.

El chat no responde:
- Verifica `GOOGLE_GENERATIVE_AI_API_KEY`.
- Revisa que haya conectividad hacia Google y SEACE.

No puedes iniciar sesión:
- Revisa tus credenciales de SEACE/RNP.
- Confirma que `BETTER_AUTH_*` y la base de datos estén configurados.
