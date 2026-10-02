/**
 * Дата протокола в реквизитах кооператива. Решение совета записывает номер и
 * дату протокола в переменные кооператива, и шапки документов печатают дату как
 * есть. Мета решения хранит момент в ISO — в переменные он обязан попасть в виде
 * для человека, иначе в документах стоит «Протокол № 4 от 2026-10-02T14:10:39.662Z».
 */
import { protocolDateForVars } from '~/infrastructure/decision-tracking/adapters/decision-tracking.adapter';

describe('дата протокола в переменных кооператива', () => {
  it('момент в ISO печатается датой и временем в поясе документа', () => {
    expect(protocolDateForVars('2026-10-02T14:10:39.662Z', 'Europe/Moscow')).toBe('02.10.2026 17:10');
    expect(protocolDateForVars('2026-10-02T14:10:39.662Z', 'Asia/Novosibirsk')).toBe('02.10.2026 21:10');
  });

  it('без пояса в мете берётся московское время', () => {
    expect(protocolDateForVars('2026-10-02T14:10:39.662Z')).toBe('02.10.2026 17:10');
    expect(protocolDateForVars('2026-10-02T14:10:39.662Z', null)).toBe('02.10.2026 17:10');
  });

  it('дата старого вида остаётся как есть', () => {
    expect(protocolDateForVars('24.09.2026 11:05', 'Europe/Moscow')).toBe('24.09.2026 11:05');
  });

  it('сырого ISO в реквизите не остаётся', () => {
    expect(protocolDateForVars('2026-01-01T00:00:00.000Z', 'Europe/Moscow')).not.toMatch(/T\d{2}:\d{2}:\d{2}/);
  });
});
