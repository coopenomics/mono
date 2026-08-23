import { BlockchainService } from './blockchain.service';

/**
 * Отсутствие якоря доверия в цепи — это «заверения нет», а не сбой.
 *
 * Проверяется ровно та ветка, из-за которой удостоверения не выпускались в сети
 * без аккаунта `ano`: узел отвечал на запрос ABI ошибкой, она уезжала наверх как
 * недоступность цепи, и `CertificateService` отказывался выпускать удостоверение
 * вообще — хотя пустая цепочка заверений по замыслу не ошибка.
 *
 * Сервис не поднимается целиком: нужна одна его функция, а её поведение целиком
 * определяется тем, чем ответил узел. Подменяем чтение строки таблицы.
 */
describe('BlockchainService.getEndorsement — якоря нет в цепи', () => {
  function serviceWith(readerBehaviour: () => Promise<unknown>): BlockchainService {
    const service = Object.create(BlockchainService.prototype) as BlockchainService;
    (service as unknown as { getSingleRow: () => Promise<unknown> }).getSingleRow = readerBehaviour;
    return service;
  }

  it('ошибка «нет такого аккаунта» по коду → заверения нет, а не исключение', async () => {
    const service = serviceWith(() => Promise.reject({ error: { name: 'account_query_exception', code: 3060002 } }));
    await expect(service.getEndorsement('voskhod')).resolves.toBeNull();
  });

  it('ошибка «нет такого аккаунта» текстом → тоже заверения нет', async () => {
    const service = serviceWith(() => Promise.reject(new Error('Account Query Exception at /v1/chain/get_abi')));
    await expect(service.getEndorsement('voskhod')).resolves.toBeNull();
  });

  it('ABI контракта не найден → заверения нет', async () => {
    const service = serviceWith(() => Promise.reject(new Error('ABI контракта ano не найден')));
    await expect(service.getEndorsement('voskhod')).resolves.toBeNull();
  });

  it('узел не ответил → ошибка проходит наверх: заверение может существовать, мы его просто не прочитали', async () => {
    const service = serviceWith(() => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:8888')));
    await expect(service.getEndorsement('voskhod')).rejects.toThrow('ECONNREFUSED');
  });

  it('якорь есть, но субъект не заверён → заверения нет', async () => {
    const service = serviceWith(() => Promise.resolve(null));
    await expect(service.getEndorsement('voskhod')).resolves.toBeNull();
  });

  it('заверение найдено → поля приводятся к строкам', async () => {
    const service = serviceWith(() =>
      Promise.resolve({
        issuer: 'ano',
        subject: 'voskhod',
        chain_id: 'f0364a3f',
        cert_key: 'EOS8fyZbsd',
        expires_at: '2027-01-01T00:00:00',
        credential: 'eyJhbGciOiJFUzI1NksifQ',
      }),
    );
    await expect(service.getEndorsement('voskhod')).resolves.toEqual({
      issuer: 'ano',
      subject: 'voskhod',
      chain_id: 'f0364a3f',
      cert_key: 'EOS8fyZbsd',
      expires_at: '2027-01-01T00:00:00',
      credential: 'eyJhbGciOiJFUzI1NksifQ',
    });
  });
});
