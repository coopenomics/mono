/**
 * Story 3.2 / 3.5: справочник 10 baseline-категорий Стола заказов.
 * Конструктор кастомных категорий — Out-of-MVP.
 */
export class MarketplaceCategoryDomainEntity {
  public readonly id!: number;
  public readonly display_name!: string;
  public readonly sort_order!: number;
  public readonly mvp_baseline!: boolean;

  constructor(init: {
    id: number;
    display_name: string;
    sort_order: number;
    mvp_baseline: boolean;
  }) {
    this.id = init.id;
    this.display_name = init.display_name;
    this.sort_order = init.sort_order;
    this.mvp_baseline = init.mvp_baseline;
  }
}

export const MARKETPLACE_BASELINE_CATEGORIES: ReadonlyArray<{
  id: number;
  display_name: string;
  sort_order: number;
}> = [
  { id: 1, display_name: 'Продовольственные товары', sort_order: 1 },
  { id: 2, display_name: 'Хозяйственные товары', sort_order: 2 },
  { id: 3, display_name: 'Стройматериалы', sort_order: 3 },
  { id: 4, display_name: 'Электроника и техника', sort_order: 4 },
  { id: 5, display_name: 'Одежда и обувь', sort_order: 5 },
  { id: 6, display_name: 'Книги и канцелярия', sort_order: 6 },
  { id: 7, display_name: 'Сад/огород/инструменты', sort_order: 7 },
  { id: 8, display_name: 'Услуги по доставке', sort_order: 8 },
  { id: 9, display_name: 'Услуги по ремонту', sort_order: 9 },
  { id: 10, display_name: 'Прочие товары и услуги', sort_order: 10 },
];
