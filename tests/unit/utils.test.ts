import { describe, expect, it } from 'vitest';
import { parseCents, formatCents } from '../../src/utils/money.js';
import { isValidCpf, normalizeCpf } from '../../src/utils/cpf.js';
import { isCustomerPassword, isWeakCustomerPassword } from '../../src/utils/customerPassword.js';
import { isValidPixEmail, normalizePixKey, toPixPhone } from '../../src/utils/pixKey.js';
import {
  getBankDate,
  getBankDayStart,
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

  it('aceita o valor igual ao teto e recusa o valor acima dele', () => {
    expect(parseCents('1000', 1_000n)).toBe(1_000n);
    expect(() => parseCents('1001', 1_000n)).toThrow('Valor acima do limite por operação.');
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
  });

  it('preserva o "+" de telefones e reduz CPF a dígitos', () => {
    expect(normalizePixKey('+55 (11) 98765-4321')).toBe('+5511987654321');
    expect(normalizePixKey('529.982.247-25')).toBe('52998224725');
    expect(normalizePixKey('11987654321')).toBe('11987654321');
  });

  it('converte telefone brasileiro para o formato +55 e recusa números inválidos', () => {
    expect(toPixPhone('(11) 99999-0000')).toBe('+5511999990000');
    expect(toPixPhone('+55 11 99999-0000')).toBe('+5511999990000');
    expect(toPixPhone('5511999990000')).toBe('+5511999990000');
    expect(toPixPhone('1133334444')).toBe('+551133334444');
    expect(toPixPhone('1234')).toBeNull();
    expect(toPixPhone('')).toBeNull();
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

describe('início do dia bancário', () => {
  it('calcula o começo do dia em São Paulo a partir de um instante UTC', () => {
    const start = getBankDayStart(new Date('2026-11-14T15:00:00.000Z'), 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });

  it('mantém o dia anterior quando o instante UTC já é o dia seguinte, mas ainda é madrugada local', () => {
    const start = getBankDayStart(new Date('2026-11-15T02:30:00.000Z'), 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });

  it('devolve o próprio início do dia quando o instante já é a meia-noite local', () => {
    const start = getBankDayStart(new Date('2026-11-14T03:00:00.000Z'), 'America/Sao_Paulo');
    expect(start.toISOString()).toBe('2026-11-14T03:00:00.000Z');
  });
});

describe('mascaramento', () => {
  it('preserva apenas os trechos necessários para identificação visual', () => {
    expect(maskCpf('52998224725')).toBe('***.982.247-**');
    expect(maskAccountNumber('1234567')).toBe('12****67');
    expect(maskName('Ana Maria Souza')).toBe('Ana M***');
  });
});
