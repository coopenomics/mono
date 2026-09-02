<template lang="pug">
.row.items-center.q-gutter-sm(v-if='state && !state.loading')
  BaseButton(
    :variant='state.issued ? "secondary" : "primary"',
    size='sm',
    :aria-label='state.issued ? "Открыть карту пайщика" : "Выпустить карту пайщика"',
    @click='state.onOpen'
  )
    template(#icon-left)
      q-icon(:name='state.issued ? "open_in_new" : "badge"', size='18px')
    | {{ state.issued ? 'Открыть карту' : 'Выпустить карту пайщика' }}
</template>

<script lang="ts" setup>
import { BaseButton } from 'src/shared/ui/base';
import { cardcoopHeaderState } from '../model/header';

/** Главное действие страницы карты — в шапке, как у всех страниц стола (канон). */
const state = cardcoopHeaderState;
</script>
