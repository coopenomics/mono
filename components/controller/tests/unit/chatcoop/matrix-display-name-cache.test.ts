/**
 * Отображаемые имена Matrix запоминаются на сутки, а не на один проход.
 *
 * До правки кэш создавался заново на каждый проход по каждой комнате, и узел
 * ВОСХОДа спрашивал у Synapse имена отправителей 750 тысяч раз в неделю — это
 * было две трети журнала сервера чата (73B-18, У1).
 */
import { MatrixRoomMessageHistoryIngestService } from '../../../src/extensions/chatcoop/application/services/matrix-room-message-history-ingest.service';

const SENDER = '@ivanov:chat.coopenomics.world';

function serviceWith(resolve: jest.Mock) {
  const matrixApi = { resolveMatrixUserDisplayName: resolve };
  const service = new MatrixRoomMessageHistoryIngestService(matrixApi as never, {} as never, {} as never, {} as never);
  // Проход по комнате приходит со своим пустым кэшем — как из ingestRoomMessages.
  const ask = (sender: string) => (service as any).resolveDisplayCached(sender, new Map<string, string>()) as Promise<string>;
  return { ask };
}

describe('кэш отображаемых имён Matrix', () => {
  afterEach(() => jest.restoreAllMocks());

  it('имя спрашивается у Synapse один раз на несколько проходов', async () => {
    const resolve = jest.fn().mockResolvedValue('Иван Иванов');
    const { ask } = serviceWith(resolve);

    expect(await ask(SENDER)).toBe('Иван Иванов');
    expect(await ask(SENDER)).toBe('Иван Иванов');
    expect(await ask(SENDER)).toBe('Иван Иванов');

    expect(resolve).toHaveBeenCalledTimes(1);
  });

  it('через сутки имя запрашивается заново', async () => {
    const resolve = jest.fn().mockResolvedValue('Иван Иванов');
    const { ask } = serviceWith(resolve);
    const now = jest.spyOn(Date, 'now');

    now.mockReturnValue(1_000);
    await ask(SENDER);
    now.mockReturnValue(1_000 + 24 * 60 * 60 * 1000 + 1);
    await ask(SENDER);

    expect(resolve).toHaveBeenCalledTimes(2);
  });

  it('запасной вариант (локальная часть адреса) на сутки не запоминается', async () => {
    // Так отвечает resolveMatrixUserDisplayName, когда Synapse не дал профиль.
    const resolve = jest.fn().mockResolvedValueOnce('ivanov').mockResolvedValueOnce('Иван Иванов');
    const { ask } = serviceWith(resolve);

    expect(await ask(SENDER)).toBe('ivanov');
    expect(await ask(SENDER)).toBe('Иван Иванов');

    expect(resolve).toHaveBeenCalledTimes(2);
  });
});
