<template lang="pug">
//- Выбор периода оборотов в шапке страницы «Фонды». Шапка рисуется вне дерева
//- страницы, поэтому значение — общий для кнопки и страницы `fundsPeriod`.
MenuSelectButton(:model-value='fundsPeriod' :options='options' icon='date_range' @update:model-value='select')
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { MenuSelectButton, type MenuSelectOption } from 'src/shared/ui/domain'
import { FUNDS_PERIOD_KEYS, fundsPeriod, type FundsPeriodKey } from '../model/period'
import { t } from '../../../i18n'

const options = computed<MenuSelectOption[]>(() =>
  FUNDS_PERIOD_KEYS.map((key) => ({ value: key, label: t(`reports.fundsPage.period.${key}`) })),
)

function select(value: string | number): void {
  fundsPeriod.value = value as FundsPeriodKey
}
</script>
