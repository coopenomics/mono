import { CardcoopJoinEventsService } from '~/extensions/cardcoop/membership/join-events.service';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

/**
 * Приём в пайщики выпускает свидетельство по связке, ждавшей решения совета (story 7.5).
 *
 * Кандидат связывает карту на этапе вступления — иначе ему пришлось бы заводить вторую и
 * потерять накопленное. Свидетельствовать в тот момент нечего: совет ещё не решил. Значит
 * связка ждёт, а выпуск происходит по записи цепи о приёме.
 */
const logger = { setContext: () => undefined, info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: () => undefined };

const build = (issuePendingLink = jest.fn(async () => undefined)) => {
  const service = new CardcoopJoinEventsService(
    { issuePendingLink } as any,
    { config: { api_url: 'https://card.coop' } } as any,
    logger as any
  );
  return { service, issuePendingLink };
};

const action = (data: Record<string, unknown>) => ({ data }) as any;

describe('Приём пайщика в кооператив', () => {
  beforeEach(() => jest.clearAllMocks());

  it('по приёму выпускается свидетельство с датой из действия цепи', async () => {
    const { service, issuePendingLink } = build();

    await service.handleMemberAdded(
      action({ coopname: 'voskhod', username: 'ant', created_at: '2026-08-30T10:00:00.000Z' })
    );

    expect(issuePendingLink).toHaveBeenCalledWith('https://card.coop', 'ant', '2026-08-30');
  });

  it('приём в чужой кооператив нас не касается', async () => {
    const { service, issuePendingLink } = build();

    await service.handleMemberAdded(action({ coopname: 'zarya', username: 'ant' }));

    expect(issuePendingLink).not.toHaveBeenCalled();
  });

  it('действие без пайщика игнорируется', async () => {
    const { service, issuePendingLink } = build();

    await service.handleMemberAdded(action({ coopname: 'voskhod' }));

    expect(issuePendingLink).not.toHaveBeenCalled();
  });

  it('время цепи без зоны читается как UTC, а не как местное время сервера', async () => {
    // `time_point_sec` приезжает без зоны; поздним вечером ошибка зоны сдвинула бы дату
    // приёма в свидетельстве на сутки.
    const { service, issuePendingLink } = build();

    await service.handleMemberAdded(
      action({ coopname: 'voskhod', username: 'ant', created_at: '2026-08-30T23:30:00' })
    );

    expect(issuePendingLink).toHaveBeenCalledWith('https://card.coop', 'ant', '2026-08-30');
  });

  it('без даты в действии берётся день приёма — он произошёл прямо сейчас', async () => {
    const { service, issuePendingLink } = build();

    await service.handleMemberAdded(action({ coopname: 'voskhod', username: 'ant' }));

    const today = new Date().toISOString().slice(0, 10);
    expect(issuePendingLink).toHaveBeenCalledWith('https://card.coop', 'ant', today);
  });

  it('сбой выпуска не роняет обработку события: связка не потеряна, она ждёт', async () => {
    const { service } = build(
      jest.fn(async () => {
        throw new Error('сеть недоступна');
      })
    );

    await expect(service.handleMemberAdded(action({ coopname: 'voskhod', username: 'ant' }))).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
