/**
 * Реестр документов отдаёт пакет по хэшу процесса (`filter.package`).
 *
 * История операций учёта знает хэш процесса, а хэш самого документа-заявления
 * в пакете другой: панель записи истории ищет документы по пакету. Охват
 * пайщика (`receiver`) ставит сервис поверх фильтра — через фильтр чужой пакет
 * не открыть.
 */
import { DocumentService } from '~/application/document/services/document.service';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';

function world() {
  const repository = { findAggregates: jest.fn(async () => ({ items: [], total: 0 })) };
  const interactor = new DocumentInteractor({} as any, {} as any, {} as any, repository as any);
  const service = new DocumentService(interactor);
  return { service, repository };
}

describe('documents.package-filter — пакет документов по хэшу процесса', () => {
  it('documents.package-filter.01 — фильтр package доходит до реестра вместе с охватом пайщика', async () => {
    const { service, repository } = world();
    await service.getDocumentsAggregate({ username: 'anna', filter: { package: 'AB12' }, type: 'newsubmitted', page: 1, limit: 1 } as any);
    expect(repository.findAggregates).toHaveBeenCalledWith(expect.objectContaining({ package: 'AB12', username: 'anna', hash: undefined }));
  });

  it('documents.package-filter.02 — охват пайщика из фильтра не подменить: receiver берётся из запроса пайщика', async () => {
    const { service, repository } = world();
    await service.getDocumentsAggregate({ username: 'anna', filter: { package: 'AB12', receiver: 'boris' }, type: 'newsubmitted', page: 1, limit: 1 } as any);
    expect(repository.findAggregates).toHaveBeenCalledWith(expect.objectContaining({ package: 'AB12', username: 'anna' }));
  });

  it('documents.package-filter.03 — без фильтра пакета реестр не ограничивается пакетом', async () => {
    const { service, repository } = world();
    await service.getDocumentsAggregate({ username: 'anna', filter: {}, type: 'newsubmitted', page: 1, limit: 10 } as any);
    expect(repository.findAggregates).toHaveBeenCalledWith(expect.objectContaining({ package: undefined }));
  });
});
