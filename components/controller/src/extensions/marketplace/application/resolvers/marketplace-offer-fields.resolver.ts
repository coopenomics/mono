import { Injectable } from '@nestjs/common';
import { Parent, ResolveField, Resolver } from '@nestjs/graphql';

import { MarketplaceOfferDTO, MarketplaceOfferImageDTO } from '../dto/marketplace-offer.dto';
import { MarketplaceOfferImagesService } from '../services/marketplace-offer-images.service';

/**
 * Story 3.2 (доп.): ленивый резолв изображений Offer'а.
 *
 * `MarketplaceOfferDTO` несёт только сырые ключи bucket'а (`image_records`),
 * а HMAC-signed URL'ы вычисляются здесь — и только когда клиент реально
 * запросил поле `images`. Это поле-резолвер применяется к типу
 * `MarketplaceOffer` в любом запросе, где он возвращается (каталог, «мои
 * предложения», модерация), без дублирования URL-логики в каждом резолвере.
 */
@Resolver(() => MarketplaceOfferDTO)
@Injectable()
export class MarketplaceOfferFieldsResolver {
  constructor(private readonly imagesService: MarketplaceOfferImagesService) {}

  @ResolveField('images', () => [MarketplaceOfferImageDTO], {
    description: 'Изображения товара (обложка — первое). URL подписаны и ограничены по TTL.',
  })
  async images(@Parent() offer: MarketplaceOfferDTO): Promise<MarketplaceOfferImageDTO[]> {
    const records = offer.image_records ?? [];
    return Promise.all(
      records.map(async (rec, index) => {
        const url = await this.imagesService.getReadUrl(rec.bucket_key);
        return new MarketplaceOfferImageDTO({
          url,
          bucket_key: rec.bucket_key,
          mime_type: rec.mime_type,
          sort_order: index,
          is_cover: index === 0,
        });
      })
    );
  }
}
