/**
 * Уведомления вокруг модерации предложений.
 *
 * До появления этих уведомлений модерация шла молча в обе стороны:
 * администратор не знал о поступившей карточке, поставщик — о её судьбе. Оба
 * узнавали результат, только если сами открывали стол.
 *
 * Покрывают:
 *   - предложение поступило на модерацию → письмо администратору с названием
 *     имущества и именем поставщика (mkt.offer.side.25);
 *   - одобрено → поставщику уходит «опубликовано в каталоге» (side.26);
 *   - отклонено → поставщику уходит причина отказа (side.27);
 *   - администратор в кооперативе не найден → уведомление пропускается, но
 *     публикация предложения не срывается (break.03).
 *
 * Адресат уведомления о модерации — аккаунт с core-ролью `chairman`: право
 * `Offer:moderate` живёт в extension-роли `admin`, а её получает председатель
 * (см. mapCoreRolesToMarketplaceRoles). Отдельной роли модератора пока нет.
 */
import { Workflows } from '@coopenomics/notifications';

import { MarketplaceNotificationService } from '~/extensions/marketplace/application/services/marketplace-notification.service';

const COOP = 'voskhod';
const ADMIN = 'chairman-acc';
const SUPPLIER = 'alice';

const DISPLAY_NAMES: Record<string, string> = {
  [ADMIN]: 'Иванов Иван Иванович',
  [SUPPLIER]: 'Петрова Мария Сергеевна',
};

function makeService(admins: Array<{ username: string }> = [{ username: ADMIN }]) {
  // Расширение шлёт уведомления через порт ядра: имя получателя, тип
  // уведомления из каталога и данные для шаблона.
  const notifyUser = jest.fn().mockResolvedValue(undefined);
  const sender = { notifyUser } as never;
  const accountPort = {
    getAccounts: jest.fn().mockResolvedValue({ items: admins }),
    getDisplayName: jest.fn(async (username: string) => DISPLAY_NAMES[username] ?? username),
  } as never;
  const kuChairmanService = {} as never;
  const logger = {
    setContext: jest.fn(),
    log: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  } as never;

  const service = new MarketplaceNotificationService(sender, accountPort, kuChairmanService, logger);
  return { service, notifyUser, logger: logger as unknown as { warn: jest.Mock } };
}

describe('Уведомления модерации предложений', () => {
  it('предложение поступило на модерацию → администратору, с названием имущества и поставщиком', async () => {
    const { service, notifyUser } = makeService();

    await service.handleOfferOnModeration({
      offer_id: 'offer-1',
      supplier_account: SUPPLIER,
      coopname: COOP,
      product_name: 'Картофель',
    });

    expect(notifyUser).toHaveBeenCalledTimes(1);
    const [recipient, workflowId, payload] = notifyUser.mock.calls[0];
    expect(recipient).toBe(ADMIN);
    expect(workflowId).toBe(Workflows.MarketplaceOfferOnModeration.id);
    expect(payload).toEqual(
      expect.objectContaining({
        recipientName: DISPLAY_NAMES[ADMIN],
        supplierName: DISPLAY_NAMES[SUPPLIER],
        productName: 'Картофель',
        coopname: COOP,
      })
    );
  });

  it('одобрено → поставщику уходит уведомление о публикации в каталоге', async () => {
    const { service, notifyUser } = makeService();

    await service.handleOfferApproved({
      offer_id: 'offer-1',
      supplier_account: SUPPLIER,
      approved_by: ADMIN,
      category_id: 1,
      coopname: COOP,
      product_name: 'Картофель',
    });

    const [recipient, workflowId, payload] = notifyUser.mock.calls[0];
    expect(recipient).toBe(SUPPLIER);
    expect(workflowId).toBe(Workflows.MarketplaceOfferApproved.id);
    expect(payload).toEqual(
      expect.objectContaining({ productName: 'Картофель', supplierName: DISPLAY_NAMES[SUPPLIER] })
    );
  });

  it('отклонено → поставщику уходит причина отказа, иначе исправлять нечего', async () => {
    const { service, notifyUser } = makeService();

    await service.handleOfferRejected({
      offer_id: 'offer-1',
      supplier_account: SUPPLIER,
      rejected_by: ADMIN,
      reason: 'Фото не соответствует описанию',
      coopname: COOP,
      product_name: 'Картофель',
    });

    const [recipient, workflowId, payload] = notifyUser.mock.calls[0];
    expect(recipient).toBe(SUPPLIER);
    expect(workflowId).toBe(Workflows.MarketplaceOfferRejected.id);
    expect(payload).toEqual(
      expect.objectContaining({ reason: 'Фото не соответствует описанию', productName: 'Картофель' })
    );
  });

  it('администратор не найден → уведомление пропускается, публикация не срывается', async () => {
    const { service, notifyUser, logger } = makeService([]);

    await expect(
      service.handleOfferOnModeration({
        offer_id: 'offer-1',
        supplier_account: SUPPLIER,
        coopname: COOP,
        product_name: 'Картофель',
      })
    ).resolves.toBeUndefined();

    expect(notifyUser).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('сбой отправки не поднимается наружу — модерация не зависит от доставки', async () => {
    const { service, logger } = makeService();
    // Центр уведомлений может быть недоступен; для модерации это не повод
    // ронять транзакцию, которая уже применена в базе.
    const failing = makeService();
    failing.notifyUser.mockRejectedValue(new Error('novu down'));

    await expect(
      failing.service.handleOfferApproved({
        offer_id: 'offer-1',
        supplier_account: SUPPLIER,
        approved_by: ADMIN,
        category_id: 1,
        coopname: COOP,
        product_name: 'Картофель',
      })
    ).resolves.toBeUndefined();

    expect(failing.logger.warn).toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    void service;
  });
});
