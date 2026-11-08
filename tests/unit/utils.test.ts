import { describe, expect, it } from 'vitest';
import { parseCents, formatCents } from '../../src/utils/money.js';
import { isValidCpf, normalizeCpf } from '../../src/utils/cpf.js';
import { isCustomerPassword, isWeakCustomerPassword } from '../../src/utils/customerPassword.js';
import { isValidPixEmail, isValidPixPhone, normalizePixKey } from '../../src/utils/pixKey.js';
import {
  getBankDate,
  isBusinessDay,
  isNightTime,
  isWithinTimeRange,
} from '../../src/utils/bankTime.js';
import { maskAccountNumber, maskCpf, maskName } from '../../src/utils/mask.js';

describe('utils de dinheiro', () => {
  it('mantém centavos exatos como bigint', () => {
    expect(parseCents('30001')).toBe(30_001n);
    expect(formatCents(30_001n)).toBe('30001');
  });

  it.each(['0', '-1', '1.50', 'abc', ' 10'])('recusa centavos inválidos: %s', (value) => {
    expect(() => parseCents(value)).toThrow();
  });
});

describe('validação de CPF', () => {
  it('normaliza máscara e valida os dígitos verificadores', () => {
    expect(normalizeCpf('529.982.247-25')).toBe('52998224725');
    expect(isValidCpf('529.982.247-25')).toBe(true);
    expect(isValidCpf('111.111.111-11')).toBe(false);
    expect(isValidCpf('52998224724')).toBe(false);
  });
});

describe('senha de atendimento', () => {
  it('aceita seis dígitos não sequenciais', () => {
    expect(isCustomerPassword('291847')).toBe(true);
    expect(isWeakCustomerPassword('291847')).toBe(false);
  });

  it.each(['111111', '123456', '654321', '12345', 'abcdef'])(
    'recusa senha fraca ou inválida: %s',
    (value) => {
      expect(isWeakCustomerPassword(value)).toBe(true);
    },
  );
});

describe('chaves Pix', () => {
  it('normaliza valores e valida e-mail e telefone', () => {
    expect(normalizePixKey('  Pessoa@Example.Test ')).toBe('pessoa@example.test');
    expect(isValidPixEmail('pessoa@example.test')).toBe(true);
    expect(isValidPixEmail('inválido')).toBe(false);
    expect(isValidPixPhone('(11) 99999-0000')).toBe(true);
    expect(isValidPixPhone('1234')).toBe(false);
  });
});

describe('horários bancários', () => {
  it('identifica dia útil e horário local do banco', () => {
    const monday = new Date('2026-11-09T13:00:00.000Z');
    const saturday = new Date('2026-11-07T13:00:00.000Z');
    expect(isBusinessDay(monday, 'America/Sao_Paulo')).toBe(true);
    expect(isBusinessDay(saturday, 'America/Sao_Paulo')).toBe(false);
    expect(getBankDate(monday, 'America/Sao_Paulo').time).toBe('10:00');
  });

  it('trata corretamente um intervalo que cruza a meia-noite', () => {
    expect(isWithinTimeRange('23:00', '20:00', '06:00')).toBe(true);
    expect(isWithinTimeRange('05:59', '20:00', '06:00')).toBe(true);
    expect(isWithinTimeRange('12:00', '20:00', '06:00')).toBe(false);
    expect(
      isNightTime(new Date('2026-11-10T02:30:00.000Z'), 'America/Sao_Paulo', '20:00', '06:00'),
    ).toBe(true);
  });
});

describe('mascaramento', () => {
  it('preserva apenas os trechos necessários para identificação visual', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
    expect(maskAccountNumber('1234567')).toBe('12****67');
    expect(maskName('Ana Maria Souza')).toBe('Ana M***');
  });
});
