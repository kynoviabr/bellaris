// Marca do Bellaris: espelho de mão, objeto comum a salões de cabelo, unha e estética.
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
      <ellipse cx="80" cy="60" rx="46" ry="54" fill="#E9CFDD" />
      <ellipse cx="80" cy="60" rx="34" ry="42" fill="#33252C" />
      <path
        d="M58 42 Q66 30 80 28"
        fill="none"
        stroke="#E9CFDD"
        strokeWidth={6}
        strokeLinecap="round"
      />
      <rect x="71" y="112" width="18" height="38" rx="9" fill="#E9CFDD" />
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
