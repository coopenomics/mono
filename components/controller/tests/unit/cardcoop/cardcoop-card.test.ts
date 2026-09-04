import { CardcoopCardService } from '~/extensions/cardcoop/application/cardcoop-card.service';
import { CardcoopAttestationState } from '~/extensions/cardcoop/infrastructure/entities/cardcoop-attestation.typeorm-entity';

/**
 * Карта кооператора глазами кооператива (story 7.4).
 *
 * Стол показывает состояние по собственному журналу, а не по запросу в сеть: он обязан
 * работать, когда card.coop недоступен (NFR-3). Кооператив и так знает всё, что нужно
 * показать, — он сам выдавал свидетельство и сам принимал уведомление о связке.
 */
const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'rec-1',
  username: 'ant',
  cardId: 'card-1',
  cardNumber: '9689205327798678',
  attestationId: 'att-1',
  state: CardcoopAttestationState.Active,
  memberSince: '2026-01-15',
  updatedAt: new Date('2026-08-30T10:00:00.000Z'),
  ...overrides,
});

const build = (rows: unknown[], pending: unknown = null) => {
  const find = jest.fn(async () => rows.slice(0, 1));
  const findOne = jest.fn(async () => pending);
  return new CardcoopCardService({ find } as any, { findOne } as any);
};

describe('Карта кооператора в столе кооператива', () => {
  it('карты нет — стол зовёт её выпустить, адрес собран из настроек и имени кооператива', async () => {
    const card = await build([]).forMember('ant', 'https://card.coop', 'voskhod');

    expect(card.issued).toBe(false);
    expect(card.cardNumber).toBeNull();
    expect(card.state).toBeNull();
    expect(card.enterUrl).toBe('https://card.coop/enter/voskhod');
  });

  it('карта выпущена и членство подтверждено — виден номер и дата вступления', async () => {
    const card = await build([record()]).forMember('ant', 'https://card.coop', 'voskhod');

    expect(card.issued).toBe(true);
    expect(card.cardNumber).toBe('9689205327798678');
    expect(card.state).toBe(CardcoopAttestationState.Active);
    expect(card.memberSince).toBe('2026-01-15');
  });

  it('свидетельство ещё не доехало — карта всё равно показана как выпущенная', async () => {
    // Запись журнала появляется по уведомлению о связке: карта у человека уже есть, даже
    // если наш документ до сети пока не дошёл.
    const card = await build([record({ state: CardcoopAttestationState.Pending })]).forMember(
      'ant',
      'https://card.coop',
      'voskhod'
    );

    expect(card.issued).toBe(true);
    expect(card.state).toBe(CardcoopAttestationState.Pending);
  });

  it('после прекращения членства дата вступления не показывается', async () => {
    const card = await build([record({ state: CardcoopAttestationState.Revoked })]).forMember(
      'ant',
      'https://card.coop',
      'voskhod'
    );

    expect(card.state).toBe(CardcoopAttestationState.Revoked);
    expect(card.memberSince).toBeNull();
  });

  it('у записи без номера карты состояние членства не страдает', async () => {
    // Записи, заведённые до того, как сеть начала присылать номер: показывать нечего,
    // но членство от этого не перестаёт быть подтверждённым.
    const card = await build([record({ cardNumber: null })]).forMember('ant', 'https://card.coop', 'voskhod');

    expect(card.cardNumber).toBeNull();
    expect(card.issued).toBe(true);
  });

  it('карта связана при вступлении, свидетельства ещё нет — стол показывает её выпущенной', async () => {
    // Совет ещё не решил, и в цепи нет даты приёма. Сказать человеку «карта не выпущена»
    // было бы неправдой: он её выпустил и связал (story 7.5).
    const card = await build([], { username: 'ant', cardId: 'card-1', cardNumber: '9689205327798678' }).forMember(
      'ant',
      'https://card.coop',
      'voskhod'
    );

    expect(card.issued).toBe(true);
    expect(card.cardNumber).toBe('9689205327798678');
    expect(card.memberSince).toBeNull();
  });

  it('хвостовой слэш в адресе сети не удваивается', async () => {
    const card = await build([]).forMember('ant', 'https://card.coop/', 'voskhod');

    expect(card.enterUrl).toBe('https://card.coop/enter/voskhod');
  });
});
