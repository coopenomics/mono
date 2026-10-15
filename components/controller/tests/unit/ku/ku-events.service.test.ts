/**
 * Unit-тесты KuEventsService (расширение «Кооперативный участок»): карточка
 * участка по решению совета об учреждении.
 *
 * Карточка наследует реквизиты кооператива, но имя, адрес и контакты берёт из
 * решения собрания: почту и телефон участка задал учредитель при открытии
 * голосования. До 15.10.2026 контакты копировались у кооператива, и страница
 * нового участка показывала почту и телефон кооператива.
 */

import { KuEventsService } from '~/extensions/ku/application/services/ku-events.service';

jest.mock('@coopenomics/extension-kit', () => ({
  platformSettings: () => ({ coopname: 'voskhod' }),
}));

const COOP = 'voskhod';
const HASH = 'f00d';

function makeService(decision: Record<string, unknown>) {
  const organizationRepository = {
    findByUsername: jest.fn(async (username: string): Promise<Record<string, unknown> | null> => {
      if (username === COOP) return { username: COOP, email: 'coop@example.com', phone: '+70000000000', short_name: 'ПК «Восход»', inn: '7700000000' };
      return null;
    }),
    create: jest.fn(async (_card: Record<string, unknown>): Promise<void> => undefined),
  };
  const paymentMethodPort = {
    get: jest.fn(async () => ({ data: { bank_name: 'Банк' } })),
    save: jest.fn(async () => undefined),
  };
  const service = new KuEventsService(
    { trigger: jest.fn() } as any,
    { getAccount: jest.fn() } as any,
    { findByHash: jest.fn(async () => decision), saveAuthorization: jest.fn(async () => undefined) } as any,
    {} as any,
    {} as any,
    organizationRepository as any,
    { findByUsername: jest.fn(async () => ({ first_name: 'Николай', last_name: 'Соколов', middle_name: 'Андреевич' })) } as any,
    paymentMethodPort as any,
    { setContext: jest.fn(), log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
  );
  return { service, organizationRepository, paymentMethodPort };
}

const DECISION = {
  braname: 'zvenigorod',
  chairman: 'sokolov',
  branch_name: 'Звенигородский',
  address: 'Московская область, г. Звенигород, ул. Московская, д. 12',
  branch_email: 'zvenigorod@voskhod.coop',
  branch_phone: '+7 916 000-12-12',
};

describe('KuEventsService: карточка участка по решению совета', () => {
  it('почта и телефон участка берутся из решения собрания, остальные реквизиты — у кооператива', async () => {
    const { service, organizationRepository } = makeService(DECISION);
    await service.handleBranchEstablished({ data: { coopname: COOP, hash: HASH } } as any);

    expect(organizationRepository.create).toHaveBeenCalledTimes(1);
    const card = organizationRepository.create.mock.calls[0][0];
    expect(card).toMatchObject({
      username: 'zvenigorod',
      email: 'zvenigorod@voskhod.coop',
      phone: '+7 916 000-12-12',
      fact_address: DECISION.address,
      inn: '7700000000',
    });
  });

  it('без контактов в решении карточка наследует контакты кооператива', async () => {
    const { service, organizationRepository } = makeService({ ...DECISION, branch_email: '', branch_phone: undefined });
    await service.handleBranchEstablished({ data: { coopname: COOP, hash: HASH } } as any);

    const card = organizationRepository.create.mock.calls[0][0];
    expect(card).toMatchObject({ email: 'coop@example.com', phone: '+70000000000' });
  });

  it('карточка уже есть — повторное событие ничего не создаёт', async () => {
    const { service, organizationRepository } = makeService(DECISION);
    organizationRepository.findByUsername.mockImplementation(async () => ({ username: 'zvenigorod' }));
    await service.handleBranchEstablished({ data: { coopname: COOP, hash: HASH } } as any);
    expect(organizationRepository.create).not.toHaveBeenCalled();
  });
});
