// Obter o horário e o dia da semana no fuso do banco
export function getBankDate(date: Date, timeZone: string): { weekday: number; time: string } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return { weekday: weekdays.indexOf(values.weekday ?? ''), time: `${values.hour}:${values.minute}` };
}

// Conferir se o dia local é de segunda a sexta-feira
export function isBusinessDay(date: Date, timeZone: string): boolean {
  const weekday = getBankDate(date, timeZone).weekday;
  return weekday >= 1 && weekday <= 5;
}

// Conferir horário em intervalos comuns e intervalos noturnos
export function isWithinTimeRange(time: string, start: string, end: string): boolean {
  if (start <= end) return time >= start && time <= end;
  return time >= start || time <= end;
}

// Conferir se a data está dentro do horário útil do banco
export function isWithinBusinessHours(date: Date, timeZone: string, start: string, end: string): boolean {
  return isBusinessDay(date, timeZone) && isWithinTimeRange(getBankDate(date, timeZone).time, start, end);
}

// Conferir se a data pertence ao período noturno configurado
export function isNightTime(date: Date, timeZone: string, start: string, end: string): boolean {
  return isWithinTimeRange(getBankDate(date, timeZone).time, start, end);
}
