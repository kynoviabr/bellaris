// Envio de modelo pela API oficial do WhatsApp Business (Meta Cloud API).

const GRAPH_VERSION = "v21.0";

export type MetaSendResult = { ok: true; messageId: string } | { ok: false; error: string };

export async function sendReminderTemplate(input: {
  to: string;
  templateName: string;
  languageCode: string;
  params: string[];
  accessToken: string;
  phoneNumberId: string;
}): Promise<MetaSendResult> {
  const response = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${input.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${input.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: input.to,
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode },
        components: [{ type: "body", parameters: input.params.map(text => ({ type: "text", text })) }],
      },
    }),
  });
  const body = (await response.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!response.ok || !body.messages?.[0]?.id) {
    return { ok: false, error: body.error?.message ?? `HTTP ${response.status}` };
  }
  return { ok: true, messageId: body.messages[0].id };
}
