export type Clock = { now: () => Date };

// Ler o horário atual do sistema
export const systemClock: Clock = { now: () => new Date() };

// Criar um relógio controlável para testes de regras temporais
export function createClock(initialTime: Date): Clock & { set: (value: Date) => void } {
  let currentTime = new Date(initialTime);
  return {
    now: () => new Date(currentTime),
    set: (value) => { currentTime = new Date(value); },
  };
}
