import type { Metadata } from "next";
import { CONSENT_TEXTS } from "@/lib/privacy/consent";

export const metadata: Metadata = {
  title: "Política de privacidade — Bellaris",
  description: "Como o Bellaris e os salões tratam os dados pessoais, conforme a LGPD.",
};

export default function PrivacidadePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink">
      <h1 className="text-2xl font-bold">Política de privacidade</h1>
      <p className="mt-1 text-sm text-muted">Versão 1.0 · Última atualização: 2 de novembro de 2026</p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. Quem somos</h2>
          <p className="mt-2">O Bellaris é um sistema de gestão para salões de beleza, operado pela Braidotti Consultoria em TI Ltda, CNPJ 56.091.791/0001-67, Rua Domingos Alberto Lazzazera, 31, Condomínio Village Moutounnee, CEP 13324-511, Salto/SP.</p>
          <p className="mt-2">Para cada salão, o responsável pelos dados das suas clientes é o próprio salão, que é o controlador. O Bellaris atua como operador: guarda e processa esses dados em nome do salão, seguindo as instruções dele, conforme o contrato de tratamento de dados firmado entre as partes.</p>
          <p className="mt-2">Para os dados de cobrança do salão usados na assinatura do Bellaris, o Bellaris atua como controlador.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. Que dados coletamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Dono do salão (no cadastro):</strong> nome completo, CPF, WhatsApp, endereço completo, dados do plano e da cobrança.</li>
            <li><strong>Clientes do salão (cadastradas pelo salão):</strong> nome, telefone, e-mail, data de nascimento, endereço, observações e histórico de atendimentos e pagamentos.</li>
            <li><strong>Dados de saúde (anamnese), quando o salão preenche:</strong> informações sobre diabetes, gravidez, hábito de roer unhas e alergias. Esses dados só são coletados com o consentimento da cliente.</li>
            <li><strong>Fotos:</strong> imagens de unhas e mãos, enviadas pelo salão, somente com o consentimento da cliente.</li>
            <li><strong>Profissionais do salão:</strong> nome, e-mail, telefone e percentual de comissão.</li>
            <li><strong>Agendamento online:</strong> nome e telefone de quem agenda um horário.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Para que usamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Operar o sistema de agenda, atendimentos, pagamentos e estoque do salão.</li>
            <li>Confirmar agendamentos e permitir o envio de mensagens que o salão revisa e envia.</li>
            <li>Cobrar a assinatura do Bellaris (para o dono do salão).</li>
            <li>Cumprir obrigações legais e prevenir fraudes.</li>
          </ul>
          <p className="mt-2">Não vendemos dados pessoais. Não usamos os dados das clientes para publicidade do Bellaris.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Bases legais</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Contrato:</strong> dados necessários para o salão usar o sistema.</li>
            <li><strong>Consentimento:</strong> dados de saúde (anamnese) e fotos. Pode ser retirado a qualquer momento, sem custo.</li>
            <li><strong>Obrigação legal:</strong> registros fiscais e de cobrança.</li>
            <li><strong>Legítimo interesse:</strong> segurança e prevenção de fraudes, sem prejuízo dos direitos das titulares.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Com quem compartilhamos e onde os dados ficam</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Fornecedores de infraestrutura:</strong> Supabase (banco de dados e autenticação), com os dados armazenados na região us-east-2 (Ohio, Estados Unidos). Isso caracteriza transferência internacional de dados, feita com as garantias previstas na LGPD. Vercel (hospedagem do site).</li>
            <li><strong>O próprio salão:</strong> a proprietária e as profissionais que ela autoriza.</li>
            <li><strong>Mensagens de WhatsApp:</strong> o envio é feito pelo salão, no próprio WhatsApp. O Bellaris não envia mensagens às clientes sozinho.</li>
          </ul>
          <p className="mt-2">Não compartilhamos dados com terceiros para fins comerciais.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Por quanto tempo guardamos</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Cadastro de clientes e do salão:</strong> enquanto o salão estiver ativo. Após o cancelamento, os dados ficam disponíveis por 90 dias para reativação ou exportação e são depois apagados ou anonimizados.</li>
            <li><strong>Anamnese e fotos:</strong> apagadas quando a cliente retira o consentimento, no cancelamento do salão ou ao fim do prazo de 90 dias, o que vier primeiro.</li>
            <li><strong>Dados de cobrança e fiscais:</strong> 5 anos, prazo usual para documentos fiscais.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Seus direitos</h2>
          <p className="mt-2">Você pode pedir: confirmação de tratamento, acesso, correção, anonimização, exclusão, portabilidade e informação sobre compartilhamentos.</p>
          <p className="mt-2">Você pode retirar o consentimento para anamnese e fotos a qualquer momento. A retirada não afeta o tratamento feito antes dela, e depois dela o salão deixa de usar esses dados e os apaga.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><strong>Se você é cliente de um salão:</strong> faça o pedido diretamente ao salão, que é o responsável pelos seus dados. O Bellaris ajudará o salão a atender o pedido.</li>
            <li><strong>Se você é dono de salão, ou quer falar sobre os dados do cadastro do Bellaris:</strong> entre em contato pelo canal abaixo.</li>
          </ul>
          <p className="mt-2"><strong>Encarregado de dados (DPO):</strong> Fernando Luiz Braidotti — <a className="underline" href="mailto:privacidade.bellaris@kynovia.com.br">privacidade.bellaris@kynovia.com.br</a></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Segurança</h2>
          <p className="mt-2">Usamos controle de acesso por salão, criptografia em trânsito, senhas protegidas e regras de acesso no banco de dados, de modo que cada salão enxerga apenas os próprios dados.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Alterações</h2>
          <p className="mt-2">Podemos atualizar esta política. Avisaremos no sistema quando houver mudança importante.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Textos de consentimento</h2>
          <p className="mt-2"><strong>Anamnese:</strong> {CONSENT_TEXTS.anamnesis}</p>
          <p className="mt-2"><strong>Fotos:</strong> {CONSENT_TEXTS.photos}</p>
        </section>
      </div>
    </main>
  );
}
