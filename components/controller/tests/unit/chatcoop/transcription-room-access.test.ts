import { ForbiddenException } from '@nestjs/common';
import { TranscriptionResolver } from '../../../src/extensions/chatcoop/application/resolvers/transcription.resolver';
import { ChatcoopCommunicationAccessService } from '../../../src/extensions/chatcoop/application/services/chatcoop-communication-access.service';
import { TranscriptionStatus } from '../../../src/extensions/chatcoop/domain/entities/call-transcription.entity';
import { matrixRoomIdToLivekitRoomName } from '../../../src/extensions/chatcoop/application/utils/livekit-room-mapping.util';

/**
 * Записи звонков читают совет и ведущий проекта — по комнате Matrix, к которой привязана запись.
 *
 * У записи два разных идентификатора: комната Matrix и имя комнаты LiveKit (хэш от неё). Реестр
 * комнат знает только первый, поэтому проверка доступа обязана идти по нему: иначе комната
 * «не находится» и отказ получает даже председатель.
 */
describe('Доступ к записям звонков — по комнате Matrix, не по комнате LiveKit', () => {
  const PROJECT_HASH = 'fa0428ab935772b7a022789e1416ae0c47277b7dfb707de5237e19d1f712c16b';
  const PROJECT_ROOM = '!proekt:coopenomics.world';
  const COUNCIL_ROOM = '!sovet:coopenomics.world';

  const projectRoom = {
    id: '1',
    matrixRoomId: PROJECT_ROOM,
    encrypted: false,
    kind: 'capital_project' as const,
    displayLabel: 'Проект',
    projectHash: PROJECT_HASH,
    secretaryInRoom: true,
    messageHistoryPaginationToken: null,
    messageHistoryBackfillComplete: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  };
  const councilRoom = { ...projectRoom, id: '2', matrixRoomId: COUNCIL_ROOM, kind: 'council' as const, projectHash: null };

  /** Запись звонка проекта: roomId — имя комнаты LiveKit, оно же хэш от matrixRoomId. */
  const transcription = {
    id: 'aaaa-bbbb',
    roomId: matrixRoomIdToLivekitRoomName(PROJECT_ROOM),
    matrixRoomId: PROJECT_ROOM,
    roomName: 'Созвон проекта',
    startedAt: new Date('2026-08-01T10:00:00Z'),
    endedAt: new Date('2026-08-01T11:00:00Z'),
    participants: ['@ant:coopenomics.world'],
    status: TranscriptionStatus.COMPLETED,
    memo: '',
    createdAt: new Date('2026-08-01T11:00:00Z'),
    updatedAt: new Date('2026-08-01T11:00:00Z'),
  };

  /** Ведущим проекта считаем `vedushchiy`: матрицу доступа capital проверяет соседний тест. */
  function buildResolver(): {
    resolver: TranscriptionResolver;
    updateMemo: jest.Mock;
  } {
    const managedRooms = {
      findByMatrixRoomId: jest.fn(async (matrixRoomId: string) =>
        [projectRoom, councilRoom].find((r) => r.matrixRoomId === matrixRoomId) ?? null
      ),
      findAll: jest.fn(async () => [projectRoom, councilRoom]),
    };
    const capitalClearance = {
      canReadProjectCommunication: jest.fn(
        async (input: { username: string; projectHash: string }) =>
          input.username === 'vedushchiy' && input.projectHash === PROJECT_HASH
      ),
    };
    const access = new ChatcoopCommunicationAccessService(managedRooms as never, capitalClearance as never);

    const updateMemo = jest.fn(async (id: string, memo: string) => ({ ...transcription, id, memo }));
    const transcriptionService = {
      getTranscriptionWithSegments: jest.fn(async (id: string) =>
        id === transcription.id ? { transcription, segments: [] } : null
      ),
      getAllTranscriptions: jest.fn(async () => [transcription]),
      getTranscriptionsByRoom: jest.fn(async () => [transcription]),
      updateTranscriptionMemo: updateMemo,
    };
    const matrixApiService = {
      resolveMatrixUserDisplayName: jest.fn(async (id: string) => id),
    };

    return {
      resolver: new TranscriptionResolver(transcriptionService as never, matrixApiService as never, access),
      updateMemo,
    };
  }

  const chairman = { username: 'predsedatel', role: 'chairman' } as never;
  const master = { username: 'vedushchiy', role: 'user' } as never;
  const outsider = { username: 'postoronniy', role: 'user' } as never;

  it('председатель открывает запись звонка проекта', async () => {
    const { resolver } = buildResolver();
    const pack = await resolver.getTranscription(chairman, { id: transcription.id });
    expect(pack?.transcription.id).toBe(transcription.id);
  });

  it('ведущий проекта открывает запись звонка своего проекта', async () => {
    const { resolver } = buildResolver();
    const pack = await resolver.getTranscription(master, { id: transcription.id });
    expect(pack?.transcription.id).toBe(transcription.id);
  });

  it('посторонний пайщик получает отказ на запись звонка проекта', async () => {
    const { resolver } = buildResolver();
    await expect(resolver.getTranscription(outsider, { id: transcription.id })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('список записей без указания комнаты отдаёт запись доступной комнаты', async () => {
    const { resolver } = buildResolver();
    const rows = await resolver.getTranscriptions(chairman, { limit: 20, offset: 0 });
    expect(rows.map((r) => r.id)).toEqual([transcription.id]);
  });

  it('в списке без указания комнаты постороннему не видно ничего', async () => {
    const { resolver } = buildResolver();
    const rows = await resolver.getTranscriptions(outsider, { limit: 20, offset: 0 });
    expect(rows).toEqual([]);
  });

  it('ведущий проекта правит заметку к записи своего проекта', async () => {
    const { resolver, updateMemo } = buildResolver();
    const updated = await resolver.updateTranscriptionMemo(master, { id: transcription.id, memo: 'итоги' });
    expect(updated.memo).toBe('итоги');
    expect(updateMemo).toHaveBeenCalledWith(transcription.id, 'итоги');
  });

  it('посторонний не правит заметку и не доходит до записи в БД', async () => {
    const { resolver, updateMemo } = buildResolver();
    await expect(
      resolver.updateTranscriptionMemo(outsider, { id: transcription.id, memo: 'чужое' })
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(updateMemo).not.toHaveBeenCalled();
  });

  it('запись комнаты, которой нет в реестре, не открывается никому', async () => {
    const orphan = { ...transcription, id: 'orphan', matrixRoomId: '!chuzhaya:coopenomics.world' };
    const service = {
      getTranscriptionWithSegments: jest.fn(async () => ({ transcription: orphan, segments: [] })),
    };
    const managedRooms = { findByMatrixRoomId: jest.fn(async () => null), findAll: jest.fn(async () => []) };
    const access = new ChatcoopCommunicationAccessService(managedRooms as never, undefined);
    const isolated = new TranscriptionResolver(
      service as never,
      { resolveMatrixUserDisplayName: jest.fn(async (id: string) => id) } as never,
      access
    );
    await expect(isolated.getTranscription(chairman, { id: 'orphan' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });
});
