<template lang="pug">
//- Содержание процесса — строгая сводка для бухгалтера. Шапка: что это
//- (снимок и название — если приложение назвало предмет процесса), главная
//- сумма, состояние, переход. Ниже сведения сеткой «подпись над значением» и
//- состав процесса таблицей: операция, чья она, сумма. Название процесса
//- стоит в заголовке места (панель, страница) и в карточке не повторяется.
BaseCard.process-content(variant='flat')
  .process-content__head
    .process-content__cover(v-if='content.image_url')
      img(:src='content.image_url', :alt='content.title')
    .process-content__identity(v-if='content.title')
      .process-content__title {{ content.title }}
      .process-content__meta(v-if='content.subtitle') {{ content.subtitle }}
    .process-content__money(v-if='content.amount')
      .process-content__eyebrow {{ content.amount_label }}
      .process-content__amount {{ formatAsset2Digits(content.amount) }}
    .process-content__side
      BaseBadge(v-if='content.status', variant='info') {{ content.status }}
      BaseButton(
        v-for='link in content.links'
        :key='link.path'
        variant='secondary'
        size='sm'
        @click='open(link.path)'
      ) {{ link.label }}

  ProcessFacts.process-content__section(v-if='content.facts.length', :facts='content.facts')

  .process-content__section(v-if='lines.length')
    .process-content__eyebrow {{ $t('process.processContentCard.linesTitle') }}
    BaseTable.process-content__lines(:columns='lineColumns', :rows='lines', row-key='key')
      template(#cell-amount='{ row }') {{ row.amount ? formatAsset2Digits(row.amount) : '—' }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BaseBadge, BaseButton, BaseCard, BaseTable } from 'src/shared/ui/base'
import type { BaseTableColumn } from 'src/shared/ui/base'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import { t } from 'src/shared/i18n'
import type { IProcessContent } from 'src/entities/Process'
import ProcessFacts from './ProcessFacts.vue'

const props = defineProps<{
  /** Кооператив: путь перехода считается от его стола. */
  coopname: string
  /** Содержание процесса, как его описало приложение процесса. */
  content: NonNullable<IProcessContent>
}>()

const router = useRouter()

const lineColumns: BaseTableColumn[] = [
  { key: 'label', label: t('process.processContentCard.column.operation') },
  { key: 'subject', label: t('process.processContentCard.column.subject'), nowrap: true },
  { key: 'amount', label: t('process.processContentCard.column.amount'), align: 'right', numeric: true, nowrap: true },
]

const lines = computed(() =>
  (props.content.lines ?? []).map((line, index) => ({ ...line, key: String(index), subject: line.subject ?? '—' })),
)

// Приложение задаёт путь без кооператива: «/market-admin/orders/<id>».
function open(path: string): void {
  void router.push(`/${props.coopname}${path}`)
}
</script>

<style scoped>
.process-content__head {
  display: flex;
  align-items: center;
  gap: var(--p-5);
  flex-wrap: wrap;
}
.process-content__cover {
  flex: none;
  width: 56px;
  height: 56px;
  border-radius: var(--p-r-md);
  overflow: hidden;
  background: var(--p-surface-2);
}
.process-content__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.process-content__identity {
  flex: 1 1 240px;
  min-width: 0;
}
.process-content__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.process-content__meta {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
.process-content__eyebrow {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}
.process-content__amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  font-family: var(--p-mono);
  color: var(--p-ink);
}
.process-content__side {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  margin-left: auto;
}
.process-content__section {
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.process-content__lines :deep(td) {
  font-size: var(--p-fs-body-sm);
}
</style>
