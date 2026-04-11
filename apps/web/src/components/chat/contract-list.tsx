"use client";

import { ContractCard } from "./contract-card";

interface Contract {
  id: number;
  numero: string;
  tipo: string;
  descripcion: string;
  entidad: string;
  estado: string;
  fechaPublicacion: string;
  inicioCotizacion: string;
  finCotizacion: string;
  puedesCotizar: boolean;
}

interface ContractListProps {
  contracts: Contract[];
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
  };
  onViewDetail?: (id: number) => void;
}

export function ContractList({
  contracts,
  pagination,
  onViewDetail,
}: ContractListProps) {
  const isEmpty = contracts.length === 0;
  const hasMorePages =
    !!pagination && !isEmpty && (pagination.page * pagination.pageSize) < pagination.total;

  return (
    <div className="space-y-3">
      {pagination && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs shadow-sm">
          <p className="font-medium text-slate-600">
            {isEmpty
              ? "No se encontraron contrataciones con los filtros aplicados."
              : `Mostrando ${contracts.length} de ${pagination.total.toLocaleString()} resultados en la pagina ${pagination.page}.`}
          </p>
          {hasMorePages && (
            <p className="mt-1 text-[11px] text-slate-500">
              Pide al chat "Siguiente pagina" para seguir navegando.
            </p>
          )}
        </div>
      )}
      <div className="grid gap-3">
        {contracts.map((contract) => (
          <ContractCard
            key={contract.id}
            contract={contract}
            onViewDetail={onViewDetail}
          />
        ))}
      </div>
    </div>
  );
}
