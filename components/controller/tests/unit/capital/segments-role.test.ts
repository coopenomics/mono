/**
 * Unit-тесты доступа к сводному списку долей.
 *
 * Что здесь защищается. Вкладка со сводным списком долей по всему кооперативу
 * закрыта на клиенте по роли, но сам запрос ролью не ограничивался: рядовой
 * пайщик получал чужие доли, обратившись к серверу напрямую. Закрытая карточка
 * в интерфейсе — не защита.
 *
 * Граница проведена ровно там же, где на клиенте: сводный список (без указания
 * проекта) читает только совет, а запрос ПО КОНКРЕТНОМУ ПРОЕКТУ остаётся
 * открытым — на нём стоят рабочие виджеты голосования, состава участников и
 * подачи результата, и они нужны любому участнику проекта.
 *
 * Реестр случаев: test-registry/capital.results-desk.yaml
 */

import { SegmentsResolver } from '~/extensions/capital/application/resolvers/segments.resolver';

function makeResolver() {
  const segmentsService = {
    getSegments: jest.fn(async () => ({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 })),
  };
  return { resolver: new SegmentsResolver(segmentsService as never), segmentsService };
}

const pajshchik = { username: 'alice', role: 'user' } as any;
const sovetnik = { username: 'sovetnik', role: 'member' } as any;
const predsedatel = { username: 'ant', role: 'chairman' } as any;

describe('SegmentsResolver.getSegments — доступ к сводному списку', () => {
  // cap.resdesk.break.03
  it('рядовому пайщику сводный список долей кооператива не отдаётся', async () => {
    const { resolver, segmentsService } = makeResolver();

    await expect(resolver.getSegments(pajshchik, undefined, undefined)).rejects.toThrow(
      /только совету/i
    );
    expect(segmentsService.getSegments).not.toHaveBeenCalled();
  });

  it('пустой фильтр без проекта — тот же отказ: обойти указанием других полей нельзя', async () => {
    const { resolver, segmentsService } = makeResolver();

    await expect(
      resolver.getSegments(pajshchik, { username: 'bob' } as never, undefined)
    ).rejects.toThrow(/только совету/i);
    expect(segmentsService.getSegments).not.toHaveBeenCalled();
  });

  it('совет и председатель сводный список читают', async () => {
    for (const actor of [sovetnik, predsedatel]) {
      const { resolver, segmentsService } = makeResolver();
      await expect(resolver.getSegments(actor, undefined, undefined)).resolves.toBeDefined();
      expect(segmentsService.getSegments).toHaveBeenCalled();
    }
  });

  it('запрос по конкретному проекту открыт рядовому участнику — на нём стоят рабочие виджеты', async () => {
    const { resolver, segmentsService } = makeResolver();

    await expect(
      resolver.getSegments(pajshchik, { project_hash: 'ph' } as never, undefined)
    ).resolves.toBeDefined();
    expect(segmentsService.getSegments).toHaveBeenCalled();
  });
});
