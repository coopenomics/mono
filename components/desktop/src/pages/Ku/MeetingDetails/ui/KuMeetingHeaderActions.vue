<template lang="pug">
.row.items-center.q-gutter-sm(v-if='state')
  BaseButton(
    v-if='state.canJoin',
    variant='primary',
    size='sm',
    :loading='state.busy',
    aria-label='Участвовать в собрании',
    @click='state.onJoin'
  )
    template(#icon-left)
      q-icon(name='how_to_reg', size='18px')
    | Участвовать
  span(v-if='state.canStart')
    BaseButton(
      variant='primary',
      size='sm',
      :disabled='!state.hasQuorum',
      :loading='state.busy',
      aria-label='Открыть голосование',
      @click='state.onStartOpen'
    )
      template(#icon-left)
        q-icon(name='how_to_vote', size='18px')
      | Открыть голосование
    q-tooltip(v-if='!state.hasQuorum')
      | Для открытия голосования нужно не менее 3 участников собрания.
      | Пока их меньше — собрание можно только отменить.
  BaseButton(
    v-if='state.canClose',
    variant='primary',
    size='sm',
    :loading='state.busy',
    aria-label='Завершить и утвердить протокол',
    @click='state.onClose'
  )
    template(#icon-left)
      q-icon(name='task_alt', size='18px')
    | Завершить и утвердить протокол
  BaseButton(
    v-if='state.canExec',
    variant='primary',
    size='sm',
    :loading='state.busy',
    aria-label='Направить в совет',
    @click='state.onExec'
  )
    template(#icon-left)
      q-icon(name='send', size='18px')
    | Направить в совет
  BaseButton(
    v-if='state.canCancel',
    variant='secondary',
    size='sm',
    :loading='state.busy',
    aria-label='Отменить собрание',
    @click='state.onCancelOpen'
  )
    template(#icon-left)
      q-icon(name='event_busy', size='18px')
    | Отменить собрание
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { kuMeetingHeaderActions } from '../model/header-actions-store';

const state = computed(() => kuMeetingHeaderActions.value);
</script>
