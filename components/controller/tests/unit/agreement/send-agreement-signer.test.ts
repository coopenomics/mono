/**
 * Соглашение подаёт сам пайщик (совет — за любого), и подпись пайщика на
 * документе сделана ключом его аккаунта. Иначе своим ключом можно было бы
 * «подписать» соглашение за другого: транзакцию подписывает кооператив.
 */
import { ForbiddenException } from '@nestjs/common';
import { AgreementInteractor } from '~/application/agreement/use-cases/agreement.interactor';

const OWN_KEY = 'PUB_K1_own';

function build(opts: { chainKeys?: string[]; registeredKey?: string } = {}) {
  const soviet = {
    getCoagreement: jest.fn().mockResolvedValue({ program_id: 0, draft_id: 0 }),
    sendAgreement: jest.fn().mockResolvedValue({ ok: true }),
  };
  const account = opts.chainKeys
    ? { permissions: [{ perm_name: 'active', required_auth: { keys: opts.chainKeys.map((key) => ({ key, weight: 1 })) } }] }
    : null;
  const blockchain = {
    getAccount: jest.fn().mockResolvedValue(account),
    hasActiveKey: jest.fn((acc: any, key: string) =>
      acc.permissions.some((p: any) => p.required_auth.keys.some((k: any) => k.key === key))
    ),
  };
  const users = { getUserByUsername: jest.fn().mockResolvedValue({ public_key: opts.registeredKey ?? '' }) };
  const utils = { convertSignedDocumentToBlockchainFormat: jest.fn((doc: any) => doc) };
  const interactor = new AgreementInteractor({} as any, soviet as any, {} as any, utils as any, blockchain as any, users as any);
  return { interactor, soviet };
}

function input(signer: string, public_key: string) {
  return {
    coopname: 'voskhod',
    administrator: 'voskhod',
    username: 'bob',
    agreement_type: 'signature',
    document: { signatures: [{ signer, public_key }] },
  } as any;
}

const participant = { username: 'bob', role: 'user' };

describe('sendAgreement: подпись пайщика его ключом', () => {
  it('своё соглашение, подписанное ключом аккаунта, уходит в цепь', async () => {
    const { interactor, soviet } = build({ chainKeys: [OWN_KEY] });
    await interactor.sendAgreement(input('bob', OWN_KEY), participant);
    expect(soviet.sendAgreement).toHaveBeenCalled();
  });

  it('у кандидата без аккаунта ключом служит зафиксированный при регистрации', async () => {
    const { interactor, soviet } = build({ registeredKey: OWN_KEY });
    await interactor.sendAgreement(input('bob', OWN_KEY), participant);
    expect(soviet.sendAgreement).toHaveBeenCalled();
  });

  it('чужим ключом от имени пайщика — отказ', async () => {
    const { interactor, soviet } = build({ chainKeys: [OWN_KEY] });
    await expect(interactor.sendAgreement(input('bob', 'PUB_K1_foreign'), participant)).rejects.toBeInstanceOf(ForbiddenException);
    expect(soviet.sendAgreement).not.toHaveBeenCalled();
  });

  it('без подписи пайщика — отказ', async () => {
    const { interactor } = build({ chainKeys: [OWN_KEY] });
    await expect(interactor.sendAgreement(input('mallory', OWN_KEY), participant)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('пайщик не подаёт соглашение за другого, совет — может', async () => {
    const { interactor, soviet } = build({ chainKeys: [OWN_KEY] });
    await expect(interactor.sendAgreement(input('bob', OWN_KEY), { username: 'mallory', role: 'user' })).rejects.toBeInstanceOf(
      ForbiddenException
    );
    await interactor.sendAgreement(input('bob', OWN_KEY), { username: 'ant', role: 'chairman' });
    expect(soviet.sendAgreement).toHaveBeenCalledTimes(1);
  });
});
