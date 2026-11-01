// Marca do Bellaris: pétala abstrata com a letra B no vazado. Serve a qualquer tipo de salão de beleza.
// Cores fixas para ficar legível sobre a barra lateral escura.
export function BellarisMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      role="img"
      aria-label="Bellaris"
      className={className}
    >
      <path
        d="M80 14 C118 52 128 100 80 146 C32 100 42 52 80 14 Z"
        fill="#E9CFDD"
      />
      <path
        d="M68 62 V108 M68 62 H84 C92 62 93 76 84 80 H68 M68 80 H86 C96 80 97 98 86 102 H68"
        fill="none"
        stroke="#33252C"
        strokeWidth={6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BellarisWordmark({ className }: { className?: string }) {
  return (
    <span
      className={className}
      style={{ fontFamily: 'Georgia, "Times New Roman", serif', letterSpacing: "-0.01em" }}
    >
      Bellaris
    </span>
  );
}
