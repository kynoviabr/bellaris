import { test } from 'node:test';
import assert from 'node:assert';
import { isValidCnpj, isValidCpf, formatCnpjDisplay } from '../src/lib/validation/br.ts';
import { validateOwnerPersonal } from '../src/lib/validation/owner-data.ts';

test('isValidCnpj aceita CNPJ com dígitos corretos e rejeita erros', () => {
  assert.strictEqual(isValidCnpj('11.222.333/0001-81'), true);
  assert.strictEqual(isValidCnpj('11222333000181'), true);
  assert.strictEqual(isValidCnpj('11.222.333/0001-82'), false);
  assert.strictEqual(isValidCnpj('11111111111111'), false);
  assert.strictEqual(isValidCnpj('1122233300018'), false);
});

test('formatCnpjDisplay monta 00.000.000/0000-00', () => {
  assert.strictEqual(formatCnpjDisplay('11222333000181'), '11.222.333/0001-81');
});

test('validateOwnerPersonal aceita CNPJ e zera o CPF', () => {
  const base = {
    fullName: 'Ana Souza', whatsapp: '11987654321', cep: '01310100',
    logradouro: 'Av. Paulista', numero: '1000', cidade: 'São Paulo', uf: 'SP',
  };
  const res = validateOwnerPersonal({ ...base, documentType: 'cnpj', cnpj: '11.222.333/0001-81' });
  assert.ok('value' in res);
  assert.strictEqual(res.value.documentType, 'cnpj');
  assert.strictEqual(res.value.cnpj, '11222333000181');
  assert.strictEqual(res.value.cpf, null);
});

test('validateOwnerPersonal segue aceitando CPF válido', () => {
  assert.strictEqual(isValidCpf('52998224725'), true);
  const base = {
    fullName: 'Ana Souza', whatsapp: '11987654321', cep: '01310100',
    logradouro: 'Av. Paulista', numero: '1000', cidade: 'São Paulo', uf: 'SP',
  };
  const res = validateOwnerPersonal({ ...base, documentType: 'cpf', cpf: '529.982.247-25' });
  assert.ok('value' in res);
  assert.strictEqual(res.value.documentType, 'cpf');
  assert.strictEqual(res.value.cnpj, null);
});
