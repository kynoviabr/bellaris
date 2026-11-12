import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Termos de uso — Bellaris",
  description: "Condições para o uso do sistema Bellaris pelos salões.",
};

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-ink">
      <h1 className="text-2xl font-bold">Termos de uso</h1>
      <p className="mt-1 text-sm text-muted">Versão 1.0 · Última atualização: 12 de novembro de 2026</p>
      <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        Minuta sujeita a revisão jurídica antes da venda do primeiro plano.
      </p>

      <div className="mt-8 space-y-6 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">1. Quem presta o serviço</h2>
          <p className="mt-2">
            O Bellaris é um sistema de gestão para salões de beleza, fornecido pela Braidotti Consultoria em TI Ltda,
            CNPJ 56.091.791/0001-67, Rua Domingos Alberto Lazzazera, 31, Condomínio Village Moutounnee, CEP 13324-511,
            Salto/SP.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">2. O que o Bellaris oferece</h2>
          <p className="mt-2">
            Agenda, cadastro de clientes e profissionais, controle de atendimentos, pagamentos, estoque, pacotes,
            comissões, relatórios e agendamento online. O serviço é oferecido como assinatura mensal, conforme o plano
            escolhido pelo salão.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">3. Cadastro e acesso</h2>
          <p className="mt-2">
            O responsável pelo cadastro declara ser dono ou representante legal do salão e fornecer dados verdadeiros.
            Cada usuário deve manter sua senha em sigilo. O salão responde pelos acessos feitos com as contas que
            criou.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">4. Assinatura e pagamento</h2>
          <p className="mt-2">
            A cobrança segue o plano contratado e a data de vencimento combinada. O acesso pode ser limitado ao
            somente leitura em caso de atraso, conforme as regras exibidas no sistema. O cancelamento pode ser pedido
            a qualquer momento, e os dados seguem a regra de retenção da Política de privacidade.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">5. Dados dos clientes do salão</h2>
          <p className="mt-2">
            O salão é o responsável pelos dados das suas clientes e deve obter o consentimento necessário para cada
            finalidade, como fotos e anamnese. O Bellaris atua como operador desses dados, conforme a Política de
            privacidade.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">6. Uso adequado</h2>
          <p className="mt-2">
            É proibido usar o sistema para atividades ilegais, tentar acessar dados de outros salões, explorar falhas de
            segurança, sobrecarregar o serviço ou revender o acesso sem autorização.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">7. Disponibilidade</h2>
          <p className="mt-2">
            Empenhamo-nos para manter o sistema disponível e fazemos cópias de segurança dos dados. Pode haver paradas
            para manutenção, que buscaremos avisar com antecedência. Não garantimos funcionamento ininterrupto.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">8. Responsabilidade</h2>
          <p className="mt-2">
            O Bellaris não se responsabiliza por decisões tomadas pelo salão com base nos relatórios, nem por prejuízos
            causados por informações inseridas pelo próprio salão. A responsabilidade total fica limitada ao valor pago
            pelo salão nos últimos 12 meses, salvo quando a lei impedir essa limitação.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">9. Alterações e encerramento</h2>
          <p className="mt-2">
            Podemos atualizar estes termos e avisaremos no sistema quando houver mudança importante. O salão pode
            encerrar o uso a qualquer momento, pelo próprio sistema ou pelo canal de contato.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold">10. Foro e contato</h2>
          <p className="mt-2">
            Fica eleito o foro da comarca de Salto/SP para questões relacionadas a estes termos. Dúvidas podem ser
            enviadas para{" "}
            <a className="underline" href="mailto:privacidade.bellaris@kynovia.com.br">
              privacidade.bellaris@kynovia.com.br
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
