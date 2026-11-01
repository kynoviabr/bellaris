// Formatação compartilhada da área do master. Sem "use client": pode ser chamada no servidor e no cliente.
// Converte 'aaaa-mm-dd' em 'dd/mm/aaaa' sem passar por fuso.
export function brDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
