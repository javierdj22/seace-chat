import { NextResponse } from "next/server";

const isDevelopment = process.env.NODE_ENV === "development";

export function apiError(message: string, status = 500, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      ...(isDevelopment && details ? { details: String(details) } : {}),
    },
    { status },
  );
}

export function apiOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}
