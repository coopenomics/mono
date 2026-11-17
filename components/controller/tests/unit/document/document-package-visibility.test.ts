/**
 * Выдача пакета документов по правам (решение владельца 17.11.2026).
 *
 * Пакет заказа Стола заказов один: заявление заказчика о возврате паевого
 * взноса имуществом, протокол совета, акт приёмки (поставщик и оператор) и акт
 * выдачи (заказчик и оператор). Совет видит пакет целиком, пайщик — только
 * полагающиеся ему документы: чужой документ не выдаётся ни при каком запросе.
 */
import { DocumentService } from '~/application/document/services/document.service';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import {
  packageParticipants,
  packageVisibleTo,
} from '~/domain/document/services/document-package-visibility';

/** Агрегат документа: номер шаблона, субъект и подписанты. */
const doc = (registry_id: number, subject: string, signers: string[]) => ({
  hash: `H${registry_id}`,
  document: { hash: `H${registry_id}`, meta: { registry_id, username: subject }, signatures: signers.map((signer) => ({ signer })) },
});

const ORDER_PACKAGE = {
  statement: { action: {}, documentAggregate: doc(1113, 'ekaterina', ['ekaterina']) },
  decision: { action: {}, documentAggregate: doc(1114, 'ekaterina', ['chairman']), votes_for: [], votes_against: [] },
  acts: [
    { action: {}, documentAggregate: doc(1104, 'sidorov', ['sidorov', 'chairkrg']) },
    { action: {}, documentAggregate: doc(1115, 'ekaterina', ['ekaterina', 'chairkrg']) },
  ],
  links: [],
} as any;

const registries = (pack: any): number[] => [
  pack.statement?.documentAggregate?.document?.meta?.registry_id,
  pack.decision?.documentAggregate?.document?.meta?.registry_id,
  ...pack.acts.map((a: any) => a.documentAggregate.document.meta.registry_id),
  ...pack.links.map((l: any) => l.document.meta.registry_id),
].filter(Boolean);

describe('documents.package-visibility — пакет один, документы выдаются по правам', () => {
  it('участники пакета — владелец заявления, субъекты и подписанты всех документов', () => {
    expect(packageParticipants(ORDER_PACKAGE, 'ekaterina').sort()).toEqual(['chairkrg', 'chairman', 'ekaterina', 'sidorov']);
  });

  it('заказчик: своё заявление, протокол по нему и акт выдачи; акта приёмки поставщика нет', () => {
    expect(registries(packageVisibleTo(ORDER_PACKAGE, 'ekaterina', 'ekaterina'))).toEqual([1113, 1114, 1115]);
  });

  it('поставщик: только подписанный им акт приёмки — без заявления и протокола заказчика', () => {
    const pack = packageVisibleTo(ORDER_PACKAGE, 'ekaterina', 'sidorov');
    expect(pack.statement).toBeNull();
    expect(pack.decision).toBeNull();
    expect(registries(pack)).toEqual([1104]);
  });

  it('оператор участка: оба подписанных им акта, заявление и протокол заказчика — нет', () => {
    expect(registries(packageVisibleTo(ORDER_PACKAGE, 'ekaterina', 'chairkrg'))).toEqual([1104, 1115]);
  });

  it('посторонний пайщик: пустой пакет', () => {
    expect(registries(packageVisibleTo(ORDER_PACKAGE, 'ekaterina', 'ivanpetrov'))).toEqual([]);
  });
});

describe('documents.package-visibility — выдача реестра', () => {
  function world() {
    const repository = { findAggregates: jest.fn(async () => ({ items: [ORDER_PACKAGE], owners: ['ekaterina'], total: 1 })) };
    const interactor = new DocumentInteractor({} as any, {} as any, {} as any, repository as any);
    return { service: new DocumentService(interactor), repository };
  }

  it('пайщику реестр отдаёт пакет в полагающемся ему составе', async () => {
    const { service } = world();
    const page = await service.getDocumentsAggregate({ username: 'sidorov', filter: {}, type: 'newsubmitted', page: 1, limit: 10 } as any);
    expect(registries(page.items[0])).toEqual([1104]);
  });

  it('совету (охват кооператива) пакет отдаётся целиком', async () => {
    const { service, repository } = world();
    const coopname = (require('~/config/config').default as { coopname: string }).coopname;
    const page = await service.getDocumentsAggregate({ username: coopname, filter: {}, type: 'newsubmitted', page: 1, limit: 10 } as any);
    expect(repository.findAggregates).toHaveBeenCalledWith(expect.objectContaining({ username: undefined }));
    expect(registries(page.items[0])).toEqual([1113, 1114, 1104, 1115]);
  });
});
