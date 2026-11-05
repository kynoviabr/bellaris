"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Offer = { id: string; name: string; price: number; product: string; status: string; type: string };
export default function CaktoOffersAdminPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [message, setMessage] = useState("Verificando sua sessão...");
  const [loading, setLoading] = useState(false);
  async function loadOffers() {
    setLoading(true);
    setMessage("Consultando ofertas na Cakto...");
    try {
      const supabase = createClient();
      if (!supabase) throw new Error("Supabase não configurado");
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) throw new Error("Faça login como Master no Klycx antes de acessar esta página.");
      const response = await fetch("/api/admin/cakto/offers", {
        headers: { Authorization: "Bearer " + data.session.access_token },
        cache: "no-store"
      });
      if (!response.ok) {
        if (response.status === 403) throw new Error("Acesso permitido somente ao perfil Master.");
        if (response.status === 401) throw new Error("Sessão expirada. Faça login novamente.");
        throw new Error("Consulta falhou (HTTP " + response.status + "). Verifique os logs do servidor.");
      }
      const result = await response.json();
      if (!Array.isArray(result.offers)) throw new Error("Resposta inesperada da API");
      setOffers(result.offers);
      setMessage(result.offers.length ? "Ofertas retornadas pela Cakto" : "Nenhuma oferta retornada pela API");
    } catch (error) {
      setOffers([]);
      setMessage(error instanceof Error ? error.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { void loadOffers(); }, []);
  return (
    <main style={{ maxWidth: 980, margin: "48px auto", padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Diagnóstico Cakto — Homologação</h1>
      <p>Consulta somente leitura. Nenhuma assinatura será alterada.</p>
      <button onClick={loadOffers} disabled={loading} style={{ padding: "10px 18px", cursor: "pointer" }}>
        {loading ? "Consultando..." : "Atualizar ofertas"}
      </button>
      <p role="status">{message}</p>
      {offers.length > 0 && <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
          <thead><tr>{["ID", "Oferta", "Preço", "Produto", "Status", "Tipo"].map(h => <th key={h} style={{ padding: 10, borderBottom: "1px solid #888" }}>{h}</th>)}</tr></thead>
          <tbody>{offers.map(o => <tr key={o.id}><td style={{ padding: 10 }}>{o.id}</td><td>{o.name}</td><td>{String(o.price)}</td><td>{o.product}</td><td>{o.status}</td><td>{o.type}</td></tr>)}</tbody>
        </table>
      </div>}
    </main>
  );
}
