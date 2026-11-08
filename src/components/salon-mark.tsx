import React from "react";

// Marca do salão: mostra o logo enviado pelo salão; sem logo, mostra a marca reserva (fallback).
export function SalonMark({
  logoUrl,
  boxClassName,
  fallback,
  alt = "Logo do salão",
}: {
  logoUrl?: string | null;
  boxClassName: string;
  fallback: React.ReactNode;
  alt?: string;
}) {
  return (
    <div className={`flex items-center justify-center overflow-hidden ${boxClassName}`}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoUrl} alt={alt} className="h-full w-full object-contain" />
      ) : (
        fallback
      )}
    </div>
  );
}
