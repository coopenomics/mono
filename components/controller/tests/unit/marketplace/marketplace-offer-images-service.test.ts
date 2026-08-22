/**
 * Загрузка изображений товара: что вообще попадает в bucket.
 *
 * Ключ объекта content-addressed — `offers/<coopname>/<owner>/<sha256>.<ext>`,
 * поэтому мусор, попавший в хранилище, оттуда уже не вытеснить повторной
 * загрузкой: тот же файл даёт тот же ключ. Отсюда требование отбивать
 * непригодный файл до записи, а не чинить последствия.
 */
import { MarketplaceOfferImagesService } from '~/extensions/marketplace/application/services/marketplace-offer-images.service';

const COOP = 'voskhod';
const OWNER = 'ivanpetrov';

function makeService() {
  const bucket = {
    put: jest.fn().mockResolvedValue(undefined),
    getSignedUrl: jest.fn(),
  };
  return { service: new MarketplaceOfferImagesService(bucket as never), bucket };
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('MarketplaceOfferImagesService.putImage: что не доходит до bucket', () => {
  it('пустой файл → отказ, в bucket ничего не пишется', async () => {
    const { service, bucket } = makeService();

    await expect(
      service.putImage({
        bytes: new Uint8Array([]),
        contentType: 'image/png',
        coopname: COOP,
        ownerAccount: OWNER,
      })
    ).rejects.toThrow('Пустой файл изображения');

    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('неподдерживаемый тип → отказ, в bucket ничего не пишется', async () => {
    const { service, bucket } = makeService();

    await expect(
      service.putImage({
        bytes: PNG_BYTES,
        contentType: 'application/pdf',
        coopname: COOP,
        ownerAccount: OWNER,
      })
    ).rejects.toThrow('Поддерживаются только изображения');

    expect(bucket.put).not.toHaveBeenCalled();
  });

  it('годный файл сохраняется по content-addressed ключу', async () => {
    const { service, bucket } = makeService();

    const result = await service.putImage({
      bytes: PNG_BYTES,
      contentType: 'image/png',
      coopname: COOP,
      ownerAccount: OWNER,
    });

    expect(bucket.put).toHaveBeenCalledTimes(1);
    expect(result.bucket_key).toBe(`offers/${COOP}/${OWNER}/${result.content_hash}.png`);
    expect(result.mime_type).toBe('image/png');
    // sha256 в hex — 64 символа: ключ обязан быть детерминирован содержимым.
    expect(result.content_hash).toHaveLength(64);
  });

  it('повторная загрузка того же файла даёт тот же ключ', async () => {
    const { service } = makeService();
    const input = {
      bytes: PNG_BYTES,
      contentType: 'image/png',
      coopname: COOP,
      ownerAccount: OWNER,
    };

    const first = await service.putImage(input);
    const second = await service.putImage(input);

    expect(second.bucket_key).toBe(first.bucket_key);
  });
});
