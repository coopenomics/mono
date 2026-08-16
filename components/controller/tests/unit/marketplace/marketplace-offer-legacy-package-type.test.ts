/**
 * Предложения, заведённые до появления вида упаковки, обязаны читаться.
 *
 * Вид упаковки добавили обязательным полем ответа, а у уже сохранённых
 * упаковок этого ключа в jsonb просто нет. GraphQL отказывался отдавать весь
 * ответ целиком («Cannot return null for non-nullable field
 * MarketplaceOfferPackage.package_type»), и каталог со столом поставщика
 * оставались пустыми у всех — при том что данные в базе целы.
 *
 * Требование к записи не смягчается: новую упаковку без названной тары
 * сохранить нельзя (см. normalizePackages в marketplace-offer.service).
 */
import type { MarketplaceOfferDomainEntity } from '~/extensions/marketplace/domain/entities/marketplace-offer.entity';
import { toMarketplaceOfferDTO } from '~/extensions/marketplace/application/dto/marketplace-offer.dto';

/** Предложение, каким оно лежит в базе после релизов до вида упаковки. */
function legacyOffer(
  packages: Array<Record<string, unknown>>
): MarketplaceOfferDomainEntity {
  return {
    id: 'offer-1',
    coopname: 'voskhod',
    supplier_account: 'ant',
    vitrine_id: 'vitrine-1',
    product_name: 'Молоко',
    description: null,
    category_id: 1,
    price_per_unit: '100.0000',
    unit_of_measure: 'liter',
    sale_form: 'packaged',
    packages,
    quantity_available: 10,
    quantity_blocked: 0,
    quantity_consumed: 0,
    unlimited_flag: false,
    delivery_points: [],
    shelf_life_days: 5,
    warranty_days: 0,
    barcode_strategy: 'per_unit',
    pack_size: 1,
    stock_braname: null,
    images: [],
    status: 'ACTIVE',
    approved_by: null,
    approved_at: null,
    rejected_by: null,
    rejected_at: null,
    reject_reason: null,
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-01T00:00:00Z'),
  } as unknown as MarketplaceOfferDomainEntity;
}

describe('toMarketplaceOfferDTO — упаковка без названной тары', () => {
  it('старая упаковка (ключа нет в jsonb) читается с пустым видом упаковки', () => {
    const dto = toMarketplaceOfferDTO(
      legacyOffer([{ id: 'p1', size: 0.5, price: '50.0000', label: null, sort_order: 0, is_default: true }])
    );

    expect(dto.packages).toHaveLength(1);
    // Именно null, а не undefined: undefined в non-nullable поле роняет весь ответ.
    expect(dto.packages[0].package_type).toBeNull();
    // Остальное предложение читается без потерь.
    expect(dto.packages[0].size).toBe(0.5);
    expect(dto.packages[0].price).toBe('50.0000');
  });

  it('упаковка с названной тарой отдаёт её как есть', () => {
    const dto = toMarketplaceOfferDTO(
      legacyOffer([
        {
          id: 'p1',
          size: 0.5,
          price: '50.0000',
          label: null,
          package_type: 'стекло',
          sort_order: 0,
          is_default: true,
        },
      ])
    );

    expect(dto.packages[0].package_type).toBe('стекло');
  });

  it('явный null в хранилище не подменяется выдуманной тарой', () => {
    const dto = toMarketplaceOfferDTO(
      legacyOffer([
        { id: 'p1', size: 1, price: '90.0000', label: null, package_type: null, sort_order: 0, is_default: true },
      ])
    );

    expect(dto.packages[0].package_type).toBeNull();
  });
});
