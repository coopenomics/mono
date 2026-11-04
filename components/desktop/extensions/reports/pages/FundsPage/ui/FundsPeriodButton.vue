<template lang="pug">
//- Выбор периода оборотов в шапке страницы «Фонды»: кнопка с названием
//- периода, список готовых периодов открывается меню под кнопкой.
BaseButton(variant='secondary' size='sm')
  template(#icon-left)
    q-icon(name='date_range' size='18px')
  | {{ $t(`reports.fundsPage.period.${fundsPeriod}`) }}
  q-icon.q-ml-xs(name='expand_more' size='18px')
  q-menu(anchor='bottom right' self='top right')
    q-list(dense)
      q-item(
        v-for='key in FUNDS_PERIOD_KEYS'
        :key='key'
        v-close-popup
        clickable
        :active='key === fundsPeriod'
        active-class='text-primary'
        @click='fundsPeriod = key'
      )
        q-item-section {{ $t(`reports.fundsPage.period.${key}`) }}
</template>

<script setup lang="ts">
import { BaseButton } from 'src/shared/ui/base'
import { FUNDS_PERIOD_KEYS, fundsPeriod } from '../model/period'
</script>
