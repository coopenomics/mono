<script lang="ts" setup>
/**
 * Эпик 5 / Story 5.x: read-only лента выплат поставщикам для совета.
 *
 * Текущий backend (`marketplaceListOutgoingPaymentsAsSupplier`) фильтрует
 * по `member.username` — каждый поставщик видит только свои выплаты.
 * Для совета (видит выплаты всех поставщиков) нужно дополнить:
 *   1. Добавить `Payment` policy в marketplace-access-matrix.ts с
 *      разрешением `read:all` для роли committee/admin.
 *   2. Новая query `marketplaceListOutgoingPayments` с фильтром
 *      `supplier_account?` (опциональный) под `read:all`.
 *   3. SDK wrapper Queries.Marketplace.ListOutgoingPayments.
 *
 * До этого — страница informational. Совету пока доступны выплаты через
 * core cassir-стол (общий стол кассира кооператива), который видит всю
 * историю outgoing payments кооператива.
 */
</script>

<template lang="pug">
q-page.mp-role-admin.mp-board-payouts(role="region", aria-label="Выплаты поставщикам — совет")
  div.text-h5 Выплаты поставщикам — обзор совета

  q-banner.q-mt-md(rounded, class="bg-amber-1 text-amber-9")
    template(#avatar)
      q-icon(name="fa-solid fa-screwdriver-wrench", color="amber-9")
    div.text-subtitle2 Раздел в подготовке
    div.text-body2
      | Совет пока не имеет собственного среза по выплатам — текущий backend marketplace отдаёт только историю текущего пользователя как поставщика. Чтобы открыть обзор по всем поставщикам кооператива, нужно расширить marketplace-access-matrix новой politykой
      strong  Payment / read:all
      | , добавить query
      strong  marketplaceListOutgoingPayments
      |  с опциональным supplier_account и сгенерировать SDK wrapper.
    div.text-body2.q-mt-sm
      | До этого — выплаты доступны через
      strong  core cassir-стол
      |  кооператива (общий стол кассира), который видит outgoing-payments всех расширений сразу.

  q-card.q-mt-md(flat, bordered)
    q-card-section
      div.text-subtitle1 Что увидит совет, когда раздел будет готов
      ul.q-pl-md
        li Ленту всех PENDING / CONFIRMED / FAILED / RETRY выплат за период.
        li Сумму выплаты, поставщика, заказ-источник, дату выплаты.
        li Фильтр по статусу + per-supplier breakdown.
        li Read-only — само подтверждение делает кассир, не совет.

    q-separator
    q-card-section
      div.text-subtitle1 Связанные документы
      ul.q-pl-md
        li
          strong PRD MVP:
          |  /home/admin/blago/production/1-prilozhenie-stol-zakazov/_bmad-output/planning-artifacts/prd.md
        li
          strong Резолвер сейчас:
          |  components/controller/src/extensions/marketplace/application/resolvers/marketplace-outgoing-payment.resolver.ts
        li
          strong Access matrix:
          |  components/controller/src/extensions/marketplace/application/access/marketplace-access-matrix.ts
</template>

<style scoped lang="scss">
.mp-board-payouts {
  padding: var(--mp-space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--mp-space-md);
}
</style>
