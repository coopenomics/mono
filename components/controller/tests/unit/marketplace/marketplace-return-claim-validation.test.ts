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
