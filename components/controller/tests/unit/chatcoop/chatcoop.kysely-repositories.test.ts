import { CalendarEventKyselyRepository } from '~/extensions/chatcoop/infrastructure/repositories/calendar-event.kysely-repository';
import { CalendarIcsSubscriptionKyselyRepository } from '~/extensions/chatcoop/infrastructure/repositories/calendar-ics-subscription.kysely-repository';
import { ManagedMatrixRoomKyselyRepository } from '~/extensions/chatcoop/infrastructure/repositories/managed-matrix-room.kysely-repository';
import { RoomMessageHistoryKyselyRepository } from '~/extensions/chatcoop/infrastructure/repositories/room-message-history.kysely-repository';
import { CallTranscriptionKyselyRepository } from '~/extensions/chatcoop/infrastructure/repositories/call-transcription.kysely-repository';
import { recordingKysely } from '../helpers/kysely-recorder';

const make = (results: Parameters<typeof recordingKysely>[0] = []) => {
  const { db, queries } = recordingKysely(results);
  return { db: db as never, queries };
};

/** Хранилища чата кооператива: что уходит в базу и как читается ответ. */
describe('хранилища чата на Kysely', () => {
  it('правка события поднимает номер редакции в самой базе, несуществующее событие — отказ', async () => {
    const { db, queries } = make([{ rows: [] }]);
    const input = { id: 'e1', matrixRoomId: '!r:coop', title: 'Совет', description: null, startsAt: new Date(), endsAt: null };

    await expect(new CalendarEventKyselyRepository(db).update(input as never)).rejects.toThrow();
    expect(queries[0].sql).toContain('"ics_sequence" = ics_sequence + 1');
    expect(queries[0].sql).toContain('where "id" = $');
  });

  it('удаление несуществующего события — отказ, а не молчаливый успех', async () => {
    const { db } = make([{ rows: [] }]);
    await expect(new CalendarEventKyselyRepository(db).deleteById('e1')).rejects.toThrow();
  });

  it('события проектов: только незашифрованные комнаты, окно задевает событие, порядок по началу', async () => {
    const { db, queries } = make([{ rows: [{ id: 'e1', matrix_room_id: '!r:coop', starts_at: new Date(), ics_sequence: 2 }] }]);
    const window = { from: new Date('2026-10-01T00:00:00Z'), to: new Date('2026-11-01T00:00:00Z') };
    const repository = new CalendarEventKyselyRepository(db);

    const [event] = await repository.listByManagedRoomProjectHashes(['h1', 'h2'], window);
    expect(await repository.listByManagedRoomProjectHashes([])).toEqual([]);

    expect(queries).toHaveLength(1);
    expect(queries[0].sql).toContain('inner join "chatcoop_managed_matrix_rooms" as "r" on "r"."matrix_room_id" = "e"."matrix_room_id"');
    expect(queries[0].sql).toContain('"r"."encrypted" = $1 and "r"."project_hash" in ($2, $3)');
    expect(queries[0].sql).toContain('("e"."ends_at" is null or "e"."ends_at" > $4) and "e"."starts_at" < $5');
    expect(queries[0].sql).toContain('order by "e"."starts_at" asc');
    // Колонки базы приходят в полях домена.
    expect(event).toMatchObject({ id: 'e1', matrixRoomId: '!r:coop', icsSequence: 2 });
  });

  it('подписка на календарь: имя пайщика сравнивается строчными буквами, нет подписки — заводится', async () => {
    const { db, queries } = make([{ rows: [] }, { rows: [{ id: 's1', coop_username: 'ant', secret_sha256_hex: 'ff' }] }]);

    const saved = await new CalendarIcsSubscriptionKyselyRepository(db).rotateSecretForUser('ANT', 'ff');

    expect(queries[0].sql).toContain('update "chatcoop_calendar_ics_subscriptions"');
    expect(queries[0].parameters).toEqual(['ff', 'ant']);
    expect(queries[1].sql).toContain('insert into "chatcoop_calendar_ics_subscriptions"');
    expect(saved).toMatchObject({ coopUsername: 'ant', secretSha256Hex: 'ff' });
  });

  it('комната: признак «секретарь в комнате» при правке не трогается, если не передан', async () => {
    const row = { id: 'r1', matrix_room_id: '!r:coop', encrypted: false, room_kind: 'unknown', display_label: 'Проект', project_hash: 'h1', secretary_in_room: true };
    const { db, queries } = make([{ rows: [row] }, { rows: [row] }]);
    const repository = new ManagedMatrixRoomKyselyRepository(db);
    const input = { matrixRoomId: '!r:coop', encrypted: false, kind: 'capital_project', displayLabel: 'Проект', projectHash: 'h1' };

    const room = await repository.upsertRoom(input as never);
    await repository.upsertRoom({ ...input, secretaryInRoom: false } as never);

    expect(queries[0].sql).not.toContain('secretary_in_room');
    expect(queries[1].sql).toContain('"secretary_in_room" = $');
    // Неизвестный вид комнаты читается как комната проекта.
    expect(room).toMatchObject({ kind: 'capital_project', secretaryInRoom: true });
  });

  it('сообщение комнаты вставляется один раз: повтор пропускается', async () => {
    const { db, queries } = make([{ rows: [{ id: 'm1' }] }, { rows: [] }]);
    const repository = new RoomMessageHistoryKyselyRepository(db);
    const message = { matrixRoomId: '!r:coop', matrixEventId: '$ev', senderMatrixUserId: '@ant:coop', messageKind: 'text', bodyText: 'привет', originServerTs: 1759500000000 };

    expect(await repository.insertIgnoreDuplicate(message as never)).toBe(true);
    expect(await repository.insertIgnoreDuplicate(message as never)).toBe(false);
    expect(queries[0].sql).toContain('on conflict ("matrix_room_id", "matrix_event_id") do nothing returning "id"');
  });

  it('последнее время сообщения комнаты: пусто — нет сообщений, иначе число', async () => {
    const empty = make([{ rows: [{ m: null }] }]);
    const filled = make([{ rows: [{ m: '1759500000000' }] }]);

    expect(await new RoomMessageHistoryKyselyRepository(empty.db).getMaxOriginServerTsForRoom('!r:coop')).toBeNull();
    expect(await new RoomMessageHistoryKyselyRepository(filled.db).getMaxOriginServerTsForRoom('!r:coop')).toBe(1759500000000);
  });

  it('транскрипции участника: свой идентификатор чата либо он же с суффиксом сессии', async () => {
    const { db, queries } = make();

    await new CallTranscriptionKyselyRepository(db, null).findByParticipant('@ant:coop');

    expect(queries[0].sql).toContain('jsonb_array_elements_text(participants)');
    expect(queries[0].parameters).toEqual(['@ant:coop', '@ant:coop:%']);
  });

  it('правка транскрипции меняет только переданные поля и шлёт сигнал участникам', async () => {
    const { db, queries } = make([{ rows: [{ id: 't1', participants: [], memo: null }] }]);
    const live = { publishTranscription: jest.fn() };

    const saved = await new CallTranscriptionKyselyRepository(db, live as never).update('t1', { memo: 'Итоги' });

    expect(queries[0].sql).toContain('set "memo" = $1, "updated_at" = now() where "id" = $2');
    expect(live.publishTranscription).toHaveBeenCalledWith('t1');
    expect(saved.memo).toBe('');
  });
});
