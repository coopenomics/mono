<template lang="pug">
//- Страница приложения из каталога: название, состояние, описание и факты
//- подписки. Те же зоны, что у встроенного расширения, — путь один для всех.
.catalog-app-info
  .catalog-app-info__head
    h2.catalog-app-info__title {{ app.title }}
    BaseBadge(v-if='state', :variant='state.variant') {{ state.label }}

  p.catalog-app-info__desc {{ app.description }}

  .catalog-app-info__facts
    DataRow(:label="$t('catalogApp.info.price')", :value='price', align='spread')
    DataRow(
      v-if='!live && app.trialDays > 0',
      :label="$t('catalogApp.info.trial')",
      :value="$t('catalogApp.info.trialDays', { days: app.trialDays })",
      align='spread'
    )
    DataRow(
      v-if='sub && sub.isTrial',
      :label="$t('catalogApp.info.trialEnds')",
      :value='formatDay(sub.trialEndsAt)',
      align='spread'
    )
    DataRow(
      v-if='sub && !sub.isTrial && live',
      :label="$t('catalogApp.info.paidUntil')",
      :value='formatDay(sub.expiresAt)',
      align='spread'
    )
    DataRow(
      v-if='sub && live && sub.nextPaymentDue',
      :label="$t('catalogApp.info.nextCharge')",
      :value='formatDay(sub.nextPaymentDue)',
      align='spread'
    )
    DataRow(:label="$t('catalogApp.info.publisher')", :value='app.publisher', align='spread')
    DataRow(
      v-if='app.lastActiveVersion',
      :label="$t('catalogApp.info.version')",
      :value='app.lastActiveVersion',
      align='spread',
      mono
    )

  //- Откуда списываются деньги — одним абзацем: на узле кооператива кошелька
  //- нет, он у оператора; без этой фразы председатель искал его здесь.
  p.catalog-app-info__note(v-if='app.rubPerMonth > 0') {{ $t('catalogApp.info.billingNote') }}
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { BaseBadge } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { type CatalogApp, isLiveSubscription } from 'src/entities/CatalogApp';
import { catalogAppPrice, catalogAppState, formatDay } from '../lib/presentation';

const props = defineProps<{ app: CatalogApp }>();

const sub = computed(() => props.app.subscription);
const live = computed(() => isLiveSubscription(sub.value));
const price = computed(() => catalogAppPrice(props.app));
const state = computed(() => catalogAppState(props.app));
</script>

<style scoped lang="scss">
.catalog-app-info__head {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-bottom: var(--p-4, 16px);
}

.catalog-app-info__title {
  margin: 0;
  font-size: var(--p-fs-h1, 24px);
  font-weight: 700;
  letter-spacing: var(--p-ls-h1, -0.01em);
  color: var(--p-ink);
}

.catalog-app-info__desc {
  margin: 0 0 var(--p-5, 20px);
  font-size: var(--p-fs-body);
  line-height: 1.6;
  color: var(--p-ink-1);
}

.catalog-app-info__facts {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  max-width: 520px;
  padding: var(--p-4, 16px) 0;
  border-top: 1px solid var(--p-line);
  border-bottom: 1px solid var(--p-line);
}

.catalog-app-info__note {
  margin: var(--p-4, 16px) 0 0;
  max-width: 520px;
  font-size: var(--p-fs-body-sm);
  line-height: 1.5;
  color: var(--p-ink-2);
}
</style>
