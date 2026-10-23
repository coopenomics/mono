import { ChatcoopLiveFeedService } from '~/extensions/chatcoop/infrastructure/realtime/chatcoop-live-feed.service';
import type { MatrixUsers } from '~/extensions/chatcoop/infrastructure/database/chatcoop.database.types';
import { recordingKysely } from '../helpers/kysely-recorder';

/**
 * Чат в ленте изменений. Сигнал о записи шлёт слой базы и владельца строки
 * берёт по имени КОЛОНКИ: после перевода на Kysely поле владельца учётной
 * записи Matrix — `coop_username`, а не имя поля сущности.
 */
describe('ChatcoopLiveFeedService', () => {
  it('учётная запись Matrix объявлена личной по колонке базы', () => {
    const chainChanges = { declareLocalTables: jest.fn(), publishLocal: jest.fn() };
    const ownerColumn: keyof MatrixUsers = 'coop_username';

    new ChatcoopLiveFeedService(recordingKysely().db as never, chainChanges as never).onModuleInit();

    const declared = chainChanges.declareLocalTables.mock.calls[0][0] as Array<{ table: string; owner_field?: string }>;
    expect(declared.find((entry) => entry.table === 'matrix_users')?.owner_field).toBe(ownerColumn);
  });

  it('сигнал о транскрипции уходит участникам звонка по именам пайщиков', async () => {
    const { db, queries } = recordingKysely([
      { rows: [{ participants: ['@ant:coop:device1', '@olga:coop'] }] },
      { rows: [{ coop_username: 'ant' }, { coop_username: 'olga' }] },
    ]);
    const chainChanges = { declareLocalTables: jest.fn(), publishLocal: jest.fn() };

    await new ChatcoopLiveFeedService(db as never, chainChanges as never).publishTranscription('t1');

    expect(queries[1].sql).toContain('"matrix_user_id" in ($1, $2)');
    expect(chainChanges.publishLocal).toHaveBeenCalledWith('chatcoop_call_transcriptions', 't1', {
      participant_usernames: ['ant', 'olga'],
    });
  });

  it('сбой чтения сигнал глотает: расшифровка от ленты не зависит', async () => {
    const chainChanges = { declareLocalTables: jest.fn(), publishLocal: jest.fn().mockRejectedValue(new Error('шина недоступна')) };
    const { db } = recordingKysely([{ rows: [{ participants: [] }] }]);

    await expect(new ChatcoopLiveFeedService(db as never, chainChanges as never).publishTranscription('t1')).resolves.toBeUndefined();
  });
});
