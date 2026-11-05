import { test } from 'node:test';
import assert from 'node:assert';
import { isKnownCaktoEvent, retryDelaySeconds, activationEnabled } from '../src/lib/cakto/webhook-queue.ts';

test('reconhece eventos documentados pela Cakto e rejeita desconhecidos', () => {
  assert.equal(isKnownCaktoEvent('subscription_canceled'), true);
  assert.equal(isKnownCaktoEvent('purchase_approved'), true);
  assert.equal(isKnownCaktoEvent('evento_inventado'), false);
});

test('intervalos de retentativa seguem a sequência documentada e não passam do teto', () => {
  assert.deepEqual([0, 1, 2, 3, 4].map(retryDelaySeconds), [5, 60, 150, 360, 1800]);
  assert.equal(retryDelaySeconds(99), 1800);
});

test('ativação fica desligada por padrão', () => {
  assert.equal(activationEnabled({}), false);
  assert.equal(activationEnabled({ CAKTO_ACTIVATION_ENABLED: 'yes' }), false);
  assert.equal(activationEnabled({ CAKTO_ACTIVATION_ENABLED: 'true' }), true);
});
