// Textos de consentimento. Devem ser idênticos aos da política de privacidade publicada.
export const CONSENT_KINDS = ["anamnesis", "photos"] as const;
export type ConsentKind = (typeof CONSENT_KINDS)[number];

export const CONSENT_VERSION = "v1";

export const CONSENT_TEXTS: Record<ConsentKind, string> = {
  anamnesis: "Autorizo o registro das informações de saúde informadas (diabetes, gravidez, hábito de roer unhas e alergias) neste salão, somente para a minha segurança nos atendimentos. Posso retirar esta autorização a qualquer momento.",
  photos: "Autorizo o registro de fotos das minhas unhas e mãos neste salão, somente para acompanhamento dos atendimentos. Posso retirar esta autorização a qualquer momento.",
};

export const CONSENT_LABELS: Record<ConsentKind, string> = {
  anamnesis: "Anamnese (dados de saúde)",
  photos: "Fotos de unhas e mãos",
};
