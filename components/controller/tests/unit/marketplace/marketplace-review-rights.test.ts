/**
 * Права профиля поставщика и отзывов (задача 598-61, случаи mkt.review.rights.*
 * в test-registry/marketplace.reviews.yaml).
 *
 * Требование каждой операции читается из исходника резолвера, гард — настоящий:
 * общий `RightsGuard` над таблицей прав Стола заказов.
 */
import { memberOf, makeScopeGuard, requirementOf, type ScopeWorld } from './right-scope.harness';

const OWN = { code: 'KIT_RIGHT_SCOPE_OWN' };
const NO_RIGHT = { code: 'KIT_INSUFFICIENT_RIGHTS' };

const REVIEWS = 'marketplace-review.resolver.ts';
const PROFILES = 'marketplace-supplier-profile.resolver.ts';

const ivan = memberOf('ivan', 'orderer');
const petr = memberOf('petr', 'orderer');
const supplier = memberOf('sup1', 'orderer', 'offerer');
const operator = memberOf('chairkrg', 'orderer', 'operator');
const chairman = memberOf('ant', 'orderer', 'admin');
const council = memberOf('sov', 'board_readonly');

const world: ScopeWorld = {
  objects: {
    Order: { o1: { orderer_account: 'ivan', supplier_account: 'sup1', delivery_braname: 'krg', order_hash: 'h1' } },
    Review: { rev1: { author_account: 'ivan' } },
  },
};

describe('отзыв: пишет и правит только автор', () => {
  // mkt.review.rights.happy.01
  it('заказчик оставляет отзыв по своему заказу и правит свой отзыв', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceCreateReview'), ivan, { data: { order_id: 'o1' } })
    ).resolves.toMatchObject({ scopes: ['own'] });
    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceUpdateMyReview'), ivan, { data: { id: 'rev1' } })
    ).resolves.toMatchObject({ scopes: ['own'] });
  });

  // mkt.review.rights.side.01
  it('по чужому заказу отзыв не оставить, чужой отзыв не поправить — отказ по охвату', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceCreateReview'), petr, { data: { order_id: 'o1' } })
    ).rejects.toMatchObject(OWN);
    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceUpdateMyReview'), petr, { data: { id: 'rev1' } })
    ).rejects.toMatchObject(OWN);
  });

  // mkt.review.rights.side.02
  it('поставщик на отзыв о себе повлиять не может: ни править, ни скрывать', async () => {
    const supplierOnly = memberOf('sup1', 'offerer');
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceUpdateMyReview'), supplierOnly, { data: { id: 'rev1' } })
    ).rejects.toMatchObject(NO_RIGHT);
    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceSetReviewStatus'), supplier, { data: { id: 'rev1' } })
    ).rejects.toMatchObject(NO_RIGHT);
  });

  // mkt.review.rights.side.03
  it('заказчик без оферты и пункта выдачи отзывы не пишет', async () => {
    const { granted } = makeScopeGuard({ ...world, onboarded: false });

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceCreateReview'), ivan, { data: { order_id: 'o1' } })
    ).rejects.toBeDefined();
  });
});

describe('отзыв: скрывает только администратор', () => {
  // mkt.review.rights.happy.02
  it('администратор скрывает отзыв', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceSetReviewStatus'), chairman, { data: { id: 'rev1' } })
    ).resolves.toBeDefined();
  });

  // mkt.review.rights.side.04
  it.each([
    ['заказчик', ivan],
    ['оператор участка', operator],
    ['член совета', council],
  ])('%s отзыв не скрывает', async (_title, member) => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(REVIEWS, 'marketplaceSetReviewStatus'), member, { data: { id: 'rev1' } })
    ).rejects.toMatchObject(NO_RIGHT);
  });
});

describe('чтение отзывов и профиля поставщика', () => {
  const reads: [string, string][] = [
    [REVIEWS, 'marketplaceListReviews'],
    [REVIEWS, 'marketplaceReviewSummary'],
    [REVIEWS, 'marketplaceMyReviewByOrder'],
    [PROFILES, 'marketplaceSupplierProfile'],
  ];

  // mkt.review.rights.happy.03
  it.each([
    ['заказчик', ivan],
    ['поставщик', memberOf('sup1', 'offerer')],
    ['оператор участка', memberOf('chairkrg', 'operator')],
    ['администратор', memberOf('ant', 'admin')],
    ['член совета', council],
  ])('%s читает отзывы и профиль поставщика', async (_title, member) => {
    const { granted } = makeScopeGuard(world);

    for (const [file, operation] of reads) {
      await expect(granted(requirementOf(file, operation), member)).resolves.toBeDefined();
    }
  });
});

describe('профиль: поставщик правит свой, администратор — профиль кооператива', () => {
  // mkt.profile.rights.happy.01
  it('поставщик правит свой профиль', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(PROFILES, 'marketplaceUpdateMySupplierProfile'), supplier, { data: {} })
    ).resolves.toMatchObject({ scopes: ['own'] });
  });

  // mkt.profile.rights.side.01
  it('заказчик, не поставщик, профиль поставщика не ведёт', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(PROFILES, 'marketplaceUpdateMySupplierProfile'), ivan, { data: {} })
    ).rejects.toMatchObject(NO_RIGHT);
  });

  // mkt.profile.rights.happy.02
  it('профиль кооператива правит администратор', async () => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(PROFILES, 'marketplaceUpdateCooperativeProfile'), chairman, { data: {} })
    ).resolves.toBeDefined();
  });

  // mkt.profile.rights.side.02
  it.each([
    ['поставщик', supplier],
    ['оператор участка', operator],
    ['член совета', council],
  ])('%s профиль кооператива не правит', async (_title, member) => {
    const { granted } = makeScopeGuard(world);

    await expect(
      granted(requirementOf(PROFILES, 'marketplaceUpdateCooperativeProfile'), member, { data: {} })
    ).rejects.toMatchObject(NO_RIGHT);
  });
});
