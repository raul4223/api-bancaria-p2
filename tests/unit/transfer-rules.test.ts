import { describe, expect, it } from 'vitest';
import { InternalTransferRule } from '../../src/services/transfer-rules/InternalTransferRule.js';
import { PixTransferRule } from '../../src/services/transfer-rules/PixTransferRule.js';
import { TedTransferRule } from '../../src/services/transfer-rules/TedTransferRule.js';
import { createClock } from '../../src/utils/clock.js';
import type {
  TransferContext,
  TransferRuleConfig,
} from '../../src/services/transfer-rules/TransferRule.js';

const config: TransferRuleConfig = {
  bankTimezone: 'America/Sao_Paulo',
  tedFeeCents: 500n,
  tedBusinessHoursEnabled: true,
  tedStartTime: '06:30',
  tedEndTime: '17:00',
  pixNightStart: '20:00',
  pixNightEnd: '06:00',
  pixNightLimitCents: 100_000n,
};

// Criar contexto comum de transferência para os testes unitários
function createTransferContext(overrides: Partial<TransferContext> = {}): TransferContext {
  return {
    transferType: 'PIX',
    amountCents: 30_000n,
    sourceCustomerId: 'customer-a',
    destinationCustomerId: 'customer-b',
    sourceAccountId: 'account-a',
    destinationAccountId: 'account-b',
    ...overrides,
  };
}

describe('regra INTERNAL', () => {
  it('aceita apenas contas do mesmo cliente e não cobra tarifa', () => {
    const rule = new InternalTransferRule(config);
    const context = createTransferContext({
      transferType: 'INTERNAL',
      destinationCustomerId: 'customer-a',
    });
    expect(() => rule.validate(context)).not.toThrow();
    expect(rule.calculateFee(context.amountCents)).toBe(0n);
    expect(() => rule.validate(createTransferContext({ transferType: 'INTERNAL' }))).toThrow();
  });
});

describe('regra PIX', () => {
  it('aplica limite noturno e permite o mesmo valor fora desse período', () => {
    const clock = createClock(new Date('2026-11-10T00:30:00.000Z'));
    const rule = new PixTransferRule(config, clock);
    expect(() => rule.validate(createTransferContext({ amountCents: 100_001n }))).toThrow();
    expect(() => rule.validate(createTransferContext({ amountCents: 100_000n }))).not.toThrow();
    clock.set(new Date('2026-11-10T15:00:00.000Z'));
    expect(() => rule.validate(createTransferContext({ amountCents: 100_001n }))).not.toThrow();
    expect(rule.calculateFee(30_000n)).toBe(0n);
  });
});

describe('regra TED', () => {
  it('cobra tarifa em dia útil dentro do horário bancário', () => {
    const clock = createClock(new Date('2026-11-09T13:00:00.000Z'));
    const rule = new TedTransferRule(config, clock);
    expect(() => rule.validate(createTransferContext({ transferType: 'TED' }))).not.toThrow();
    expect(rule.calculateFee(2_000n)).toBe(500n);
  });

  it('recusa TED depois do horário e no fim de semana', () => {
    const clock = createClock(new Date('2026-11-09T20:01:00.000Z'));
    const rule = new TedTransferRule(config, clock);
    expect(() => rule.validate(createTransferContext({ transferType: 'TED' }))).toThrow();
    clock.set(new Date('2026-11-07T13:00:00.000Z'));
    expect(() => rule.validate(createTransferContext({ transferType: 'TED' }))).toThrow();
  });

  it('permite TED quando a regra de horário está desligada', () => {
    const clock = createClock(new Date('2026-11-07T20:30:00.000Z'));
    const rule = new TedTransferRule({ ...config, tedBusinessHoursEnabled: false }, clock);
    expect(() => rule.validate(createTransferContext({ transferType: 'TED' }))).not.toThrow();
  });
});
