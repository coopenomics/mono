/**
 * Вход до приёма в пайщики: подпись сверяется с ключом, присланным при
 * регистрации. Один и тот же ключ записывается двумя способами — `EOS…` и
 * `PUB_K1_…`; до 02.10.2026 сравнение шло по строке, и зарегистрировавшийся с
 * ключом в первом написании получал отказ во входе (C28-85, находка 55).
 */
import { Bytes, Checksum256, PrivateKey } from '@wharfkit/antelope';
import { AuthDomainService } from '~/domain/auth/services/auth-domain.service';

function make(storedKey: string | null) {
  const now = new Date().toISOString().slice(0, 19);
  const blockchainPort = {
    getInfo: jest.fn(async () => ({ head_block_time: now })),
    getAccount: jest.fn(),
    hasActiveKey: jest.fn(),
  } as any;
  const user = { username: 'candidate', email: 'c@example.com', is_registered: false, public_key: storedKey };
  const userDomainService = { getUserByEmail: jest.fn(async () => user) } as any;
  const service = new AuthDomainService(blockchainPort, {} as any, userDomainService);
  return { service, now, user, blockchainPort };
}

function sign(privateKey: PrivateKey, now: string): string {
  return privateKey.signDigest(Checksum256.hash(Bytes.fromString(now, 'utf8'))).toString();
}

describe('AuthDomainService — вход до приёма в пайщики', () => {
  const privateKey = PrivateKey.generate('K1');
  const modern = privateKey.toPublic().toString();
  const legacy = privateKey.toPublic().toLegacyString();

  it('ключ записан как PUB_K1_… — вход проходит', async () => {
    const { service, now, user } = make(modern);
    await expect(service.loginUserWithSignature(user.email, now, sign(privateKey, now))).resolves.toBe(user);
  });

  it('тот же ключ записан как EOS… — вход проходит', async () => {
    expect(legacy.startsWith('EOS')).toBe(true);
    const { service, now, user, blockchainPort } = make(legacy);
    await expect(service.loginUserWithSignature(user.email, now, sign(privateKey, now))).resolves.toBe(user);
    // Цепь не опрашивается: аккаунта пайщика в ней ещё нет.
    expect(blockchainPort.getAccount).not.toHaveBeenCalled();
  });

  it('подпись чужим ключом — отказ', async () => {
    const { service, now, user } = make(legacy);
    await expect(service.loginUserWithSignature(user.email, now, sign(PrivateKey.generate('K1'), now))).rejects.toMatchObject({
      code: 'AUTH_INVALID_PRIVATE_KEY',
    });
  });

  it('ключ не записан либо записан неразборчиво — отказ, а не сбой', async () => {
    for (const stored of [null, '', 'не-ключ']) {
      const { service, now, user } = make(stored);
      await expect(service.loginUserWithSignature(user.email, now, sign(privateKey, now))).rejects.toMatchObject({
        code: 'AUTH_INVALID_PRIVATE_KEY',
      });
    }
  });
});
