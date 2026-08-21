/**
 * Unit-тесты доступа к переписке проектов «Благороста».
 *
 * Что здесь защищается. Идентификатор комнаты Matrix — не секрет: он приходит
 * клиенту в списках и легко подставляется в чужой запрос. Поэтому право
 * читать решается по САМОЙ комнате и её проекту, а не по тому, что комната
 * названа в запросе. И отказ здесь — именно отказ, а не пустая история:
 * пустой ответ выглядел бы как «переписки нет» и скрывал бы ошибку доступа.
 *
 * Отдельная ветка — комнаты, которые к проектам не привязаны вовсе (пайщиков,
 * совета, секретаря). Их читает только совет, и в список постороннего они не
 * попадают.
 *
 * Реестр случаев: test-registry/capital.artifact-access.yaml
 */

import { ChatcoopCommunicationAccessService } from '~/extensions/chatcoop/application/services/chatcoop-communication-access.service';

const OWN_PROJECT = 'project-own';
const FOREIGN_PROJECT = 'project-foreign';

const rooms = [
  { matrixRoomId: '!own:matrix', kind: 'capital_project', projectHash: OWN_PROJECT },
  { matrixRoomId: '!foreign:matrix', kind: 'capital_project', projectHash: FOREIGN_PROJECT },
  // Комнаты вне проектов: к ним привязки по проекту нет вовсе.
  { matrixRoomId: '!members:matrix', kind: 'members' },
  { matrixRoomId: '!board:matrix', kind: 'board' },
  { matrixRoomId: '!secretary:matrix', kind: 'secretary' },
] as any[];

function buildService() {
  const managedRooms = {
    findByMatrixRoomId: jest.fn(async (id: string) => rooms.find((r) => r.matrixRoomId === id) ?? null),
    findAll: jest.fn(async () => rooms),
  };

  // Допуск есть только у ведущего и только к его проекту — ровно то, что
  // вернул бы capital. Постороннему отвечаем отказом по любому проекту.
  const capitalClearance = {
    canReadProjectCommunication: jest.fn(
      async ({ username, projectHash }: any) => username === 'vedushchiy' && projectHash === OWN_PROJECT
    ),
  };

  const service = new ChatcoopCommunicationAccessService(managedRooms as never, capitalClearance as never);
  return { service, managedRooms, capitalClearance };
}

const vedushchiy = { username: 'vedushchiy', role: 'user' } as any;
const postoronniy = { username: 'postoronniy', role: 'user' } as any;
const sovetnik = { username: 'sovetnik', role: 'member' } as any;

describe('ChatcoopCommunicationAccessService', () => {
  // cap.access.break.05
  it('отказывает на подставленный идентификатор комнаты чужого проекта', async () => {
    const { service, capitalClearance } = buildService();

    await expect(service.assertCanReadRoom(vedushchiy, '!foreign:matrix')).rejects.toThrow();

    // Право решалось по проекту САМОЙ комнаты, а не по тому, что её назвали.
    expect(capitalClearance.canReadProjectCommunication).toHaveBeenCalledWith(
      expect.objectContaining({ projectHash: FOREIGN_PROJECT })
    );
  });

  it('свою комнату тот же пользователь читает', async () => {
    const { service } = buildService();

    await expect(service.assertCanReadRoom(vedushchiy, '!own:matrix')).resolves.toBeUndefined();
  });

  it('отказывает на неизвестную комнату, не спрашивая права по проекту', async () => {
    const { service, capitalClearance } = buildService();

    await expect(service.assertCanReadRoom(vedushchiy, '!нет-такой:matrix')).rejects.toThrow();
    expect(capitalClearance.canReadProjectCommunication).not.toHaveBeenCalled();
  });

  // cap.access.break.06
  it('комнаты пайщиков, совета и секретаря постороннему не отдаются', async () => {
    const { service } = buildService();

    for (const roomId of ['!members:matrix', '!board:matrix', '!secretary:matrix']) {
      await expect(service.canReadRoom(postoronniy, roomId)).resolves.toBe(false);
    }

    const readable = await service.listReadableRoomIds(postoronniy);
    expect(readable).toEqual([]);
  });

  it('те же комнаты совет читает, и они попадают в его список', async () => {
    const { service } = buildService();

    for (const roomId of ['!members:matrix', '!board:matrix', '!secretary:matrix']) {
      await expect(service.canReadRoom(sovetnik, roomId)).resolves.toBe(true);
    }

    const readable = await service.listReadableRoomIds(sovetnik);
    expect(readable).toEqual(rooms.map((r) => r.matrixRoomId));
  });

  it('ведущему в список попадает только комната его проекта', async () => {
    const { service } = buildService();

    await expect(service.listReadableRoomIds(vedushchiy)).resolves.toEqual(['!own:matrix']);
  });

  it('без подключённого capital переписка проекта не читается никем, кроме совета', async () => {
    const managedRooms = {
      findByMatrixRoomId: jest.fn(async (id: string) => rooms.find((r) => r.matrixRoomId === id) ?? null),
      findAll: jest.fn(async () => rooms),
    };
    // capital не подключён — ответить о правах на проект нечем.
    const service = new ChatcoopCommunicationAccessService(managedRooms as never, undefined as never);

    await expect(service.canReadRoom(vedushchiy, '!own:matrix')).resolves.toBe(false);
    await expect(service.canReadRoom(sovetnik, '!own:matrix')).resolves.toBe(true);
  });
});
