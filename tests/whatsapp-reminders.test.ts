import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeBrazilPhone, reminderWindow, reminderParams } from '../src/lib/whatsapp/reminders.ts';

test('telefone brasileiro vira formato internacional', () => {
  assert.strictEqual(normalizeBrazilPhone('(11) 99999-1234'), '5511999991234');
  assert.strictEqual(normalizeBrazilPhone('+55 11 99999-1234'), '5511999991234');
  assert.strictEqual(normalizeBrazilPhone('5511999991234'), '5511999991234');
  assert.strictEqual(normalizeBrazilPhone('1199991234'), '551199991234');
  assert.strictEqual(normalizeBrazilPhone('123'), null);
  assert.strictEqual(normalizeBrazilPhone(null), null);
});

test('janela vai de hoje até o fim do terceiro dia, em horário de Brasília', () => {
  // 09/11/2026 às 12:00 em São Paulo
  const now = new Date('2026-11-09T15:00:00Z');
  assert.deepStrictEqual(reminderWindow(now, 3), {
    start: '2026-11-09T00:00:00-03:00',
    end: '2026-11-13T00:00:00-03:00',
  });
});

test('janela respeita a virada do dia em São Paulo', () => {
  // 23:30 de 09/11 em São Paulo ainda é 09/11, mesmo já sendo 10/11 em UTC
  const now = new Date('2026-11-10T02:30:00Z');
  assert.strictEqual(reminderWindow(now, 3).start, '2026-11-09T00:00:00-03:00');
});

test('parâmetros do modelo: primeiro nome, data, horário e serviços', () => {
  const params = reminderParams({
    clientName: 'Laura Festuccia',
    startsAt: '2026-11-12T11:00:00.000Z',
    services: 'Manutenção em Gel (ate 25 dias)',
  });
  assert.deepStrictEqual(params, ['Laura', '12/11/2026', '08:00', 'Manutenção em Gel (ate 25 dias)']);
});
