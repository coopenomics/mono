/**
 * Границы заявления на гарантийный возврат.
 *
 * Заявление — юридический документ: по нему кооператив возвращает пайщику
 * средства и принимает имущество обратно. Поэтому причина и фотографии
 * обязательны, а их объём ограничен: пустое заявление невозможно рассмотреть,
 * а безразмерное — вложить в документ.
 *
 * Все проверки идут ДО обращения к заказу и репозиториям: отказ не должен
 * оставлять следов в состоянии.
 */
import { BadRequestException } from '@nestjs/common';

import { MarketplaceReturnClaimService } from '~/extensions/marketplace/application/services/marketplace-return-claim.service';

const COOP = 'voskhod';

function makeService() {
  const claimRepo = {
    findActiveByOrderId: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
  };
  const orderRepo = { findById: jest.fn() };
  const service = new MarketplaceReturnClaimService(
    claimRepo as never,
    orderRepo as never,
    { findById: jest.fn() } as never,
    { listByOrder: jest.fn() } as never,
    { submitReturnClaim: jest.fn() } as never,
    { symbol: 'RUB', decimals: 4 } as never,
    { buildDocumentAggregate: jest.fn() } as never,
    { putImage: jest.fn() } as never,
    { emit: jest.fn() } as never,
    { setContext: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() } as never
  );
  return { service, claimRepo, orderRepo };
}

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    coopname: COOP,
    order_id: 'order-1',
    orderer_account: 'ekaterina',
    reason_text: 'Товар испорчен при транспортировке',
    photos: [{ filename: 'photo.jpg', mime_type: 'image/jpeg', content_base64: 'AAAA' }],
    signed_statement: undefined,
    ...overrides,
  } as never;
}

describe('MarketplaceReturnClaimService.submitReturnClaim: границы заявления', () => {
  it('пустая причина → 400, заказ даже не читается', async () => {
    const { service, orderRepo } = makeService();

    // Проверяем сообщение, а не только тип: дальше по коду есть свои отказы, и
    // тест на «любой BadRequest» остался бы зелёным даже без этой проверки.
    await expect(service.submitReturnClaim(baseInput({ reason_text: '   ' }))).rejects.toThrow(
      'Опишите причину возврата.'
    );
    expect(orderRepo.findById).not.toHaveBeenCalled();
  });

  it('причина длиннее двух тысяч символов → 400', async () => {
    const { service, orderRepo } = makeService();

    await expect(
      service.submitReturnClaim(baseInput({ reason_text: 'а'.repeat(2001) }))
    ).rejects.toThrow('не должна превышать 2000 символов');
    expect(orderRepo.findById).not.toHaveBeenCalled();
  });

  it('заявление без фотографий → 400', async () => {
    const { service, orderRepo } = makeService();

    await expect(service.submitReturnClaim(baseInput({ photos: [] }))).rejects.toThrow(
      'Приложите хотя бы одну фотографию товара.'
    );
    expect(orderRepo.findById).not.toHaveBeenCalled();
  });

  it('больше десяти фотографий → 400', async () => {
    const { service, orderRepo } = makeService();
    const photos = Array.from({ length: 11 }, (_, i) => ({
      filename: `photo-${i}.jpg`,
      mime_type: 'image/jpeg',
      content_base64: 'AAAA',
    }));

    await expect(service.submitReturnClaim(baseInput({ photos }))).rejects.toThrow(
      'не более 10 фотографий'
    );
    expect(orderRepo.findById).not.toHaveBeenCalled();
  });

  it('ровно десять фотографий проходят проверку объёма', async () => {
    const { service, orderRepo } = makeService();
    const photos = Array.from({ length: 10 }, (_, i) => ({
      filename: `photo-${i}.jpg`,
      mime_type: 'image/jpeg',
      content_base64: 'AAAA',
    }));

    // Дальше сценарий уйдёт в разбор самих файлов и упрётся в заглушки — нам
    // важно ровно одно: проверка ОБЪЁМА не отбила допустимое количество.
    const error = await service
      .submitReturnClaim(baseInput({ photos }))
      .then(() => null)
      .catch((e: Error) => e);
    expect(error?.message ?? '').not.toContain('не более 10 фотографий');
    void orderRepo;
  });
});

/**
 * Право на возврат по конкретному заказу.
 *
 * Границы выше отбивают само заявление; здесь проверяется, можно ли вообще
 * возвращать по ЭТОМУ заказу: не чужой ли он, выдан ли, не истекла ли гарантия
 * и не просят ли больше, чем получили. Все отказы происходят до записи чего бы
 * то ни было — заказ читается, но состояние не меняется.
 */
const DAY_MS = 86_400_000;

/** Фото в том виде, в каком их принимает сервис: содержимое в base64. */
const VALID_PHOTOS = [{ base64: 'AAAA', mime_type: 'image/jpeg' }];

function receivedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    coopname: COOP,
    orderer_account: 'ekaterina',
    status: 'RECEIVED',
    warranty_until: new Date(Date.now() + 30 * DAY_MS),
    quantity: 10,
    issuance_fact: { actual_quantity: 10, fact_cost: '1000.0000' },
    unit_of_measure: 'kg',
    total_cost: '1000.0000',
    price_per_unit: '100.0000',
    order_hash: 'a'.repeat(64),
    offer_id: 'offer-1',
    delivery_braname: 'krg',
    supplier_account: 'ivanpetrov',
    membership_fee: '0.0000',
    ...overrides,
  };
}

function claimInput(overrides: Record<string, unknown> = {}) {
  return baseInput({ photos: VALID_PHOTOS, ...overrides });
}

describe('MarketplaceReturnClaimService.submitReturnClaim: право на возврат по заказу', () => {
  it('гарантийный срок по предложению не задан → возврат невозможен', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder({ warranty_until: null }));

    await expect(service.submitReturnClaim(claimInput())).rejects.toThrow(
      'гарантия не предусмотрена'
    );
    // Заявление не заведено: отказ не оставляет следов.
    expect(claimRepo.create).not.toHaveBeenCalled();
  });

  it('гарантийный срок истёк → отказ с датой окончания', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    const expiredAt = new Date(Date.now() - DAY_MS);
    orderRepo.findById.mockResolvedValue(receivedOrder({ warranty_until: expiredAt }));

    // Дата в сообщении обязательна: без неё пайщик не поймёт, когда именно
    // право на возврат закончилось, и отказ выглядит произволом.
    await expect(service.submitReturnClaim(claimInput())).rejects.toThrow(
      `Гарантийный срок истёк ${expiredAt.toISOString().slice(0, 10)}`
    );
    expect(claimRepo.create).not.toHaveBeenCalled();
  });

  it('заказ чужой → отказ доступа, а не «не найдено»', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder({ orderer_account: 'ivanpetrov' }));

    await expect(service.submitReturnClaim(claimInput())).rejects.toThrow(
      'только заказчик-владелец заказа'
    );
    expect(claimRepo.create).not.toHaveBeenCalled();
  });

  it('заказ ещё не выдан → возврат недоступен до факта выдачи', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder({ status: 'ACTIVE' }));

    await expect(service.submitReturnClaim(claimInput())).rejects.toThrow(
      'только по выданному заказу'
    );
    expect(claimRepo.create).not.toHaveBeenCalled();
  });

  it('возвращают больше, чем выдали → отказ; ровно выданное проходит границу', async () => {
    const { service, orderRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder());

    // Сверка идёт с ФАКТИЧЕСКИ выданным, а не с заказанным: если выдали
    // меньше заказа, вернуть можно только полученное.
    await expect(
      service.submitReturnClaim(claimInput({ actual_quantity: 10.001 }))
    ).rejects.toThrow('Нельзя вернуть больше единиц, чем было выдано');

    // Ровно выданное — допустимая граница, отказа по количеству быть не должно.
    const atBoundary = await service
      .submitReturnClaim(claimInput({ actual_quantity: 10 }))
      .then(() => null)
      .catch((e: Error) => e);
    expect(atBoundary?.message ?? '').not.toContain('Нельзя вернуть больше единиц');
  });

  it('ноль и отрицательное количество к возврату → отказ', async () => {
    const { service, orderRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder());

    await expect(service.submitReturnClaim(claimInput({ actual_quantity: 0 }))).rejects.toThrow(
      'должно быть больше нуля'
    );
    await expect(service.submitReturnClaim(claimInput({ actual_quantity: -1 }))).rejects.toThrow(
      'должно быть больше нуля'
    );
  });

  it('по заказу уже открыто заявление → второе не принимается', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder());
    claimRepo.findActiveByOrderId.mockResolvedValue({ id: 'claim-открытая' });

    await expect(service.submitReturnClaim(claimInput())).rejects.toThrow(
      'уже открыто заявление на возврат'
    );
    expect(claimRepo.create).not.toHaveBeenCalled();
  });

  it('прежнее заявление закрыто → новое по тому же заказу не блокируется', async () => {
    const { service, orderRepo, claimRepo } = makeService();
    orderRepo.findById.mockResolvedValue(receivedOrder());
    // Закрытых заявлений этот запрос не возвращает — он ищет только активные.
    claimRepo.findActiveByOrderId.mockResolvedValue(null);

    // Дальше сценарий упрётся в подпись документа (её тут нет) — важно ровно
    // одно: на «уже открыто заявление» он не наткнулся.
    //
    // Остаток к возврату при этом НЕ уменьшается на уже возвращённое — это
    // известный дефект (mkt.ret.side.19), он разбирается отдельно.
    const error = await service
      .submitReturnClaim(claimInput())
      .then(() => null)
      .catch((e: Error) => e);
    expect(error?.message ?? '').not.toContain('уже открыто заявление');
    expect(claimRepo.findActiveByOrderId).toHaveBeenCalled();
  });
});
