"use client";

import { useEffect, useState } from "react";

type QuotaState = {
  remaining: number;
  limit: number;
  tokensPerCredit?: number;
};

export function AiCreditBadge() {
  const [quota, setQuota] = useState<QuotaState | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/ai-usage")
      .then(async (response) => {
        if (!response.ok) return null;
        const data = await response.json();
        return data?.quota ?? null;
      })
      .then((data) => {
        if (!cancelled) {
          setQuota(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQuota(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!quota) return null;

  return (
    <div
      className="hidden rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 sm:inline-flex"
      title={
        quota.tokensPerCredit
          ? `1 credito ~= ${quota.tokensPerCredit.toLocaleString("es-PE")} tokens`
          : "Cuota mensual de IA"
      }
    >
      IA {quota.remaining}/{quota.limit}
    </div>
  );
}
