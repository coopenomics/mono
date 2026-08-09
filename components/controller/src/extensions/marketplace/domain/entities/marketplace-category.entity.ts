/**
 * Story 3.2 / 3.5: справочник baseline-категорий Стола заказов.
 *
 * MVP — фокус на продовольственных товарах (стресс-тест через скоропорт,
 * см. PRD «Стола заказов» и архитектурный документ L7). 8 продовольственных
 * подкатегорий + одна общая категория «Прочее». Категория «Услуги»
 * выведена из MVP по требованию правовой проработки (PRD пункт 3.2.7).
 *
 * Эпик 16: baseline-категории (`mvp_baseline=true`, `coopname=null`) общие и
 * неизменяемы; кооператив добавляет собственные (`mvp_baseline=false`,
 * `coopname=<кооператив>`), которые можно создавать и удалять.
 */
export class MarketplaceCategoryDomainEntity {
  public readonly id!: number;
  public readonly display_name!: string;
  public readonly sort_order!: number;
  public readonly mvp_baseline!: boolean;
  /** Владелец кастомной категории; null для общих baseline-категорий. */
  public readonly coopname!: string | null;

  constructor(init: {
    id: number;
    display_name: string;
    sort_order: number;
    mvp_baseline: boolean;
    coopname?: string | null;
  }) {
    this.id = init.id;
    this.display_name = init.display_name;
    this.sort_order = init.sort_order;
    this.mvp_baseline = init.mvp_baseline;
    this.coopname = init.coopname ?? null;
  }
}

export const MARKETPLACE_FOOD_CATEGORIES: ReadonlyArray<{
  id: number;
  slug: string;
  display_name: string;
  sort_order: number;
}> = [
  { id: 1, slug: 'vegetables_fruits', display_name: 'Овощи и фрукты', sort_order: 1 },
  { id: 2, slug: 'dairy', display_name: 'Молочные продукты', sort_order: 2 },
  { id: 3, slug: 'meat_poultry', display_name: 'Мясо и птица', sort_order: 3 },
  { id: 4, slug: 'fish_seafood', display_name: 'Рыба и морепродукты', sort_order: 4 },
  { id: 5, slug: 'bakery', display_name: 'Хлеб и выпечка', sort_order: 5 },
  { id: 6, slug: 'grocery', display_name: 'Бакалея (крупы, мука, масло)', sort_order: 6 },
  { id: 7, slug: 'beverages', display_name: 'Напитки', sort_order: 7 },
  { id: 8, slug: 'ready_meals', display_name: 'Готовая еда', sort_order: 8 },
  { id: 9, slug: 'other', display_name: 'Прочее', sort_order: 9 },
];
