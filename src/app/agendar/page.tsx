import { notFound } from "next/navigation";

// Cada salão tem seu próprio link: /agendar/<identificador-do-salão>.
export default function AgendarRoot() {
  notFound();
}
