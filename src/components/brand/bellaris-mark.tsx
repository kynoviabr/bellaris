// Marca do Bellaris: unha em amêndoa com a letra B. Cores fixas para ficar legível sobre a barra lateral escura.
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
        d="M80 150 C36 150 30 88 44 50 C54 24 68 12 80 12 C92 12 106 24 116 50 C130 88 124 150 80 150 Z"
        fill="#E9CFDD"
      />
      <path
        d="M68 58 H88 C98 58 100 72 88 78 H68 M68 78 H92 C104 78 106 96 92 102 H68 M68 58 V102"
        fill="none"
        stroke="#33252C"
        strokeWidth={8}
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
