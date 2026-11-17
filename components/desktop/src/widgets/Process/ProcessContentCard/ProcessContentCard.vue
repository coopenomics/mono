<template lang="pug">
//- Содержание процесса: о чём он словами предметной области. Зоны строки —
//- опознание (что это: снимок, название, количество), деньги (сколько),
//- состояние (на каком шаге), действия (куда перейти). Ниже — сведения
//- «подпись — значение»: стороны, участок, вехи.
BaseCard.process-content(variant='flat')
  .process-content__head
    .process-content__cover(v-if='content.image_url')
      img(:src='content.image_url', :alt='content.title')
    .process-content__identity
      .process-content__title {{ content.title }}
      .process-content__meta(v-if='content.subtitle') {{ content.subtitle }}
    .process-content__money(v-if='content.amount')
      .process-content__eyebrow {{ content.amount_label }}
      .process-content__amount {{ formatAsset2Digits(content.amount) }}
    .process-content__state(v-if='content.status')
      BaseBadge(variant='info') {{ content.status }}
    .process-content__actions(v-if='content.links.length')
      BaseButton(
        v-for='link in content.links'
        :key='link.path'
        variant='secondary'
        size='sm'
        @click='open(link.path)'
      ) {{ link.label }}
  .process-content__facts(v-if='content.facts.length')
    //- Короткое значение стоит у правого края строки; длинное (назначение,
    //- причина) занимает всю ширину карточки, подпись — над значением.
    DataRow(
      v-for='fact in facts'
      :key='fact.label'
      :class='{ "process-content__fact--wide": fact.wide }'
      :label='fact.label'
      :value='fact.value'
      :align='fact.wide ? "vertical" : "spread"'
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BaseBadge, BaseButton, BaseCard } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { formatAsset2Digits } from 'src/shared/lib/utils'
import type { IProcessContent } from 'src/entities/Process'

const props = defineProps<{
  /** Кооператив: путь перехода считается от его стола. */
  coopname: string
  /** Содержание процесса, как его описало приложение процесса. */
  content: NonNullable<IProcessContent>
}>()

const router = useRouter()

/** Предел длины значения у правого края: длиннее — строка на всю ширину. */
const SPREAD_VALUE_LIMIT = 36

const facts = computed(() =>
  props.content.facts.map((fact) => ({ ...fact, wide: fact.value.length > SPREAD_VALUE_LIMIT })),
)

// Приложение задаёт путь без кооператива: «/market-admin/orders/<id>».
function open(path: string): void {
  void router.push(`/${props.coopname}${path}`)
}
</script>

<style scoped>
/* Ширину задаёт место карточки (раскрытый процесс, правая панель), не экран. */
.process-content {
  container-type: inline-size;
}
.process-content__head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: var(--p-6);
}
.process-content__cover {
  width: 64px;
  height: 64px;
  border-radius: var(--p-r-md);
  overflow: hidden;
  background: var(--p-surface-2);
}
.process-content__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
.process-content__money {
  text-align: right;
}
.process-content__eyebrow {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
}
.process-content__amount {
  font-size: var(--p-fs-h2);
  font-weight: 700;
  font-family: var(--p-mono);
  color: var(--p-ink);
}
.process-content__actions {
  display: flex;
  gap: var(--p-2);
}
.process-content__fact--wide {
  grid-column: 1 / -1;
}
.process-content__facts {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: var(--p-8);
  margin-top: var(--p-5);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
/* Узкое место: та же разметка, зоны в два яруса и сведения одной колонкой. */
@container (max-width: 640px) {
  .process-content__head {
    grid-template-columns: auto minmax(0, 1fr);
  }
  .process-content__money,
  .process-content__state,
  .process-content__actions {
    grid-column: 1 / -1;
    text-align: left;
  }
  .process-content__facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
