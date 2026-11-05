import { test } from 'node:test';
import assert from 'node:assert';
import { decideSubscriptionAction } from '../src/lib/cakto/subscription-plan.ts';

const offers = { nybkw7z: 'completo', i8dsad4: 'essencial', '399rzv4': 'profissional' };

test('ativa plano só com oferta mapeada e correlação confirmada', () => {
  const a = decideSubscriptionAction({ event: 'purchase_approved', offerId: '399rzv4', intentStatus: 'matched' }, offers);
  assert.equal(a.kind, 'activate');
  if (a.kind === 'activate') assert.equal(a.planCode, 'profissional');
});

test('oferta desconhecida nunca ativa: revisão manual', () => {
  const a = decideSubscriptionAction({ event: 'purchase_approved', offerId: 'B8BcHrY', intentStatus: 'matched' }, offers);
  assert.equal(a.kind, 'manual_review');
});

test('pagamento sem correlação confirmada nunca ativa', () => {
  for (const intentStatus of ['pending', 'none'] as const) {
    const a = decideSubscriptionAction({ event: 'subscription_created', offerId: 'i8dsad4', intentStatus }, offers);
    assert.equal(a.kind, 'manual_review');
  }
});

test('sem oferta informada nunca ativa', () => {
  const a = decideSubscriptionAction({ event: 'purchase_approved', offerId: null, intentStatus: 'matched' }, offers);
  assert.equal(a.kind, 'manual_review');
});

test('cancelamento, reembolso e chargeback bloqueiam independentemente de correlação', () => {
  for (const event of ['subscription_canceled', 'refund', 'chargeback']) {
    const a = decideSubscriptionAction({ event, offerId: null, intentStatus: 'none' }, offers);
    assert.equal(a.kind, 'block');
  }
});

test('atraso gera aviso e renovação estende', () => {
  assert.equal(decideSubscriptionAction({ event: 'subscription_late', offerId: null, intentStatus: 'none' }, offers).kind, 'warn_late');
  assert.equal(decideSubscriptionAction({ event: 'subscription_renewed', offerId: null, intentStatus: 'none' }, offers).kind, 'extend');
});

test('evento desconhecido é ignorado, não ativa', () => {
  assert.equal(decideSubscriptionAction({ event: 'evento_novo', offerId: 'nybkw7z', intentStatus: 'matched' }, offers).kind, 'ignore');
});
