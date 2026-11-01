import { Ban } from "lucide-react";

/** Tela de acesso suspenso (assinatura cancelada ou sem plano). Sem dados do salão. */
export function AccessSuspendedScreen({ email, logout }: { email: string; logout: () => Promise<void> }) {
  return (
    <div className="min-h-screen bg-bg p-4 sm:p-8">
      <header className="mx-auto flex max-w-2xl items-center justify-between pb-4">
        <span className="text-sm text-muted">{email}</span>
        <form action={logout}>
          <button type="submit" className="inline-flex h-10 items-center rounded-lg border border-[#E8D9C7] bg-[#FFFCF8] px-5 text-sm font-semibold">Sair</button>
        </form>
      </header>
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-[#DBE3EC] bg-white p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-rose-100">
          <Ban size={24} className="text-rose-700" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-ink">Acesso suspenso</h1>
        <p className="mt-2 text-sm text-muted">
          A assinatura deste salão está cancelada ou sem plano ativo, por isso o sistema não está disponível.
          Para reativar, fale com a Bellaris.
        </p>
      </div>
    </div>
  );
}
