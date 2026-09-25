/**
 * Фильтр списка соглашений действует и на программные соглашения.
 *
 * Программные соглашения (подписанные программы, например «Кошелёк») берутся
 * из цепи и подмешиваются к остальным. До 25.09.2026 фильтр по статусам и
 * типу к ним не применялся: запрос «отклонённые» или «тип privacy» получал в
 * ответ ещё и подтверждённое соглашение программы (нашёл внешний слой).
 */
jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod' } }));

import { AgreementService } from '~/application/agreement/services/agreement.service';
import { AgreementStatus } from '~/domain/agreement/enums/agreement-status.enum';

function makeService() {
  const owner = {
    _id: 'ua1',
    present: true,
    block_num: 1,
    coopname: 'voskhod',
    username: 'ivanov',
    programs: [{ program_id: 1, draft_id: 1, version: 1, signed_at: '2026-09-01T00:00:00' }],
  };
  const agreementRepository = {
    findAllPaginated: jest.fn(async () => ({ items: [], totalCount: 0, totalPages: 0, currentPage: 1 })),
  } as any;
  const userAgreementRepository = {
    findByUsername: jest.fn(async () => owner),
    findByProgramId: jest.fn(async () => [owner]),
    findByCoopname: jest.fn(async () => [owner]),
  } as any;
  const soviet = { getCoagreements: jest.fn(async () => [{ program_id: 1, type: 'wallet' }]) } as any;
  const stub = {} as any;
  const service = new AgreementService(stub, agreementRepository, userAgreementRepository, soviet, stub, stub, stub);
  jest.spyOn(service as any, 'toDTOs').mockResolvedValue([]);
  return service;
}

describe('программные соглашения подчиняются фильтру', () => {
  it('фильтр по статусу DECLINED не отдаёт подтверждённое соглашение программы', async () => {
    const r = await makeService().getAgreements({ username: 'ivanov', statuses: [AgreementStatus.DECLINED] });
    expect(r.items).toEqual([]);
  });

  it('фильтр по чужому типу не отдаёт соглашение программы', async () => {
    const r = await makeService().getAgreements({ username: 'ivanov', type: 'privacy' });
    expect(r.items).toEqual([]);
  });

  it('без условий и с подходящими условиями соглашение программы на месте', async () => {
    const all = await makeService().getAgreements({ username: 'ivanov' });
    expect(all.items.map(i => [i.type, i.status])).toEqual([['wallet', AgreementStatus.CONFIRMED]]);
    const matched = await makeService().getAgreements({ username: 'ivanov', type: 'wallet', statuses: [AgreementStatus.CONFIRMED] });
    expect(matched.items).toHaveLength(1);
  });
});
