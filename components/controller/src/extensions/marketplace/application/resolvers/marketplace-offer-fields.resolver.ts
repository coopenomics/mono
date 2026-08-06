import { Injectable } from '@nestjs/common';
import { Float, Parent, ResolveField, Resolver } from '@nestjs/graphql';

import {
  MarketplaceOfferDeliveryPointDTO,
  MarketplaceOfferDTO,
  MarketplaceOfferImageDTO,
} from '../dto/marketplace-offer.dto';
import { MarketplaceOfferImagesService } from '../services/marketplace-offer-images.service';
import { MarketplaceOrderDisplayService } from '../services/marketplace-order-display.service';
import { MarketplaceStockService } from '../services/marketplace-stock.service';

/**
 * Story 3.2 (доп.): ленивый резолв изображений Offer'а.
 *
 * `MarketplaceOfferDTO` несёт только сырые ключи bucket'а (`image_records`),
 * а HMAC-signed URL'ы вычисляются здесь — и только когда клиент реально
 * запросил поле `images`. Это поле-резолвер применяется к типу
 * `MarketplaceOffer` в любом запросе, где он возвращается (каталог, «мои
 * предложения», модерация), без дублирования URL-логики в каждом резолвере.
 *
 * Здесь же — системный резолв отображаемого имени поставщика (`supplier_name`):
 * имя берётся живьём из аккаунта на бэкенде, фронт не дозапрашивает его отдельно.
 */
@Resolver(() => MarketplaceOfferDTO)
@Injectable()
export class MarketplaceOfferFieldsResolver {
  constructor(
    private readonly imagesService: MarketplaceOfferImagesService,
    private readonly displayService: MarketplaceOrderDisplayService,
    private readonly stockService: MarketplaceStockService
  ) {}

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

  @ResolveField('supplier_name', () => String, {
    nullable: true,
    description: 'Отображаемое имя поставщика (ФИО физлица/ИП или наименование организации).',
  })
  async supplierName(@Parent() offer: MarketplaceOfferDTO): Promise<string | null> {
    return this.displayService.resolveAccountName(offer.supplier_account);
  }

  @ResolveField('stock_package_size', () => Float, {
    nullable: true,
    description:
      'Размер упаковки, в которой остаток фактически принят на склад (Эпик 18) — только для предложений докладки со склада (stock_braname задан). Null — отпуск по мере или партии разной фасовки в остатке.',
  })
  async stockPackageSize(@Parent() offer: MarketplaceOfferDTO): Promise<number | null> {
    if (!offer.stock_braname) return null;
    return this.stockService.resolveStockPackageSize(offer.coopname, offer.id);
  }
}

/**
 * Системный резолв отображаемых реквизитов участка поставки (ПВЗ) по `braname`:
 * наименование и адрес — живьём из организации кооперативного участка (единый
 * источник правды, правится председателем в «Кооперативные участки»), координаты
 * — из геокода КУ. Применяется к типу `MarketplaceOfferDeliveryPoint` везде, где
 * он возвращается, чтобы фронт не обогащал имя/адрес участка сторонними запросами.
 */
@Resolver(() => MarketplaceOfferDeliveryPointDTO)
@Injectable()
export class MarketplaceOfferDeliveryPointFieldsResolver {
  constructor(private readonly displayService: MarketplaceOrderDisplayService) {}

  /**
   * Один резолв реквизитов участка на инстанс точки за запрос: промис кешируется
   * прямо на объекте, чтобы 4 поля (name/address/lat/lng) не дёргали БД повторно.
   */
  private display(
    point: MarketplaceOfferDeliveryPointDTO
  ): Promise<{ name: string | null; address: string | null; lat: number | null; lng: number | null }> {
    const memo = point as MarketplaceOfferDeliveryPointDTO & {
      __display?: ReturnType<MarketplaceOrderDisplayService['resolveBranchDisplay']>;
    };
    if (!memo.__display) memo.__display = this.displayService.resolveBranchDisplay(point.braname);
    return memo.__display;
  }

  @ResolveField('name', () => String, {
    nullable: true,
    description: 'Наименование кооперативного участка (живьём из организации участка).',
  })
  async name(@Parent() point: MarketplaceOfferDeliveryPointDTO): Promise<string | null> {
    return (await this.display(point)).name;
  }

  @ResolveField('address', () => String, {
    nullable: true,
    description: 'Адрес кооперативного участка (живьём из организации участка).',
  })
  async address(@Parent() point: MarketplaceOfferDeliveryPointDTO): Promise<string | null> {
    return (await this.display(point)).address;
  }

  @ResolveField('lat', () => Float, {
    nullable: true,
    description: 'Широта участка (геокод КУ), если адрес геокодирован.',
  })
  async lat(@Parent() point: MarketplaceOfferDeliveryPointDTO): Promise<number | null> {
    return (await this.display(point)).lat;
  }

  @ResolveField('lng', () => Float, {
    nullable: true,
    description: 'Долгота участка (геокод КУ), если адрес геокодирован.',
  })
  async lng(@Parent() point: MarketplaceOfferDeliveryPointDTO): Promise<number | null> {
    return (await this.display(point)).lng;
  }
}
