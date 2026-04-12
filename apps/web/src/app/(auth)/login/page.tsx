"use client";

import { useState } from "react";
import { signIn, signUp } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [dni, setDni] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/chat";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    // 1. Validar primero con SEACE
    try {
      const seaceRes = await fetch("/api/seace-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: dni, password }),
      });

      const data = await seaceRes.json();

      if (!seaceRes.ok) {
        setError(data.error || "Credenciales inválidas en SEACE");
        setLoading(false);
        return;
      }

      // 2. Usar los datos de SEACE (nombre real e email del JWT)
      const virtualEmail = data.email || `${dni}@seace.gob.pe`;
      const userName = data.name || dni;
      
      // Intentamos iniciar sesión localmente en Postgres
      const signInResult = await signIn.email({ email: virtualEmail, password });

      // Si no existía localmente, falla el login y lo REGISTRAMOS automáticamente
      if (signInResult.error) {
         console.log(`Registrando en BD local a: ${userName}`);
         const signUpResult = await signUp.email({ name: userName, email: virtualEmail, password });
         
         if (signUpResult.error) {
           setError(signUpResult.error.message ?? "Error guardando el perfil en base de datos");
           setLoading(false);
           return;
         }
      }

      await fetch("/api/seace-session/link", { method: "POST" }).catch(() => null);

      // 3. Todo OK, volver a la ruta solicitada o al chat
      router.push(redirectTo);
    } catch (err) {
      setError("No se pudo contactar con el sistema para validar.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Acceso a SEACE</CardTitle>
          <CardDescription>Usa tu usuario y clave del RNP / SEACE</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="dni" className="text-sm font-medium">
                DNI / RUC
              </label>
              <Input
                id="dni"
                type="text"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                placeholder="Ingresa tu DNI o RUC"
                required
                maxLength={11}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="size-4 animate-spin" />}
              Iniciar sesión
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                O también
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => router.push("/chat?search=ultimas")}
          >
            Acceder como invitado
          </Button>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-xs text-muted-foreground text-center">
            Esta aplicación se integrará con el portal oficial del OSCE para la validación segura de proveedores.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
