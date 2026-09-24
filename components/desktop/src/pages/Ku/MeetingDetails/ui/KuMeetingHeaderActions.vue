<template lang="pug">
.row.items-center.q-gutter-sm(v-if='state')
  BaseButton(
    v-if='state.canJoin',
    variant='primary',
    size='sm',
    :loading='state.busy',
    :aria-label='$t("ku.kuMeetingHeaderActions.joinAction")',
    @click='state.onJoin'
  )
    template(#icon-left)
      q-icon(name='how_to_reg', size='18px')
    | {{ $t('ku.kuMeetingHeaderActions.joinLabel') }}
  span(v-if='state.canStart')
    BaseButton(
      variant='primary',
      size='sm',
      :disabled='!state.hasQuorum',
      :loading='state.busy',
      :aria-label='$t("ku.kuMeetingHeaderActions.openVotingAction")',
      @click='state.onStartOpen'
    )
      template(#icon-left)
        q-icon(name='how_to_vote', size='18px')
      | {{ $t('ku.kuMeetingHeaderActions.openVotingAction') }}
    q-tooltip(v-if='!state.hasQuorum')
      | {{ $t('ku.kuMeetingHeaderActions.noQuorumHintLine1') }}
      | {{ $t('ku.kuMeetingHeaderActions.noQuorumHintLine2') }}
  BaseButton(
    v-if='state.canClose',
    variant='primary',
    size='sm',
    :loading='state.busy',
    :aria-label='$t("ku.kuMeetingHeaderActions.closeAction")',
    @click='state.onClose'
  )
    template(#icon-left)
      q-icon(name='task_alt', size='18px')
    | {{ $t('ku.kuMeetingHeaderActions.closeAction') }}
  BaseButton(
    v-if='state.canExec',
    variant='primary',
    size='sm',
    :loading='state.busy',
    :aria-label='$t("ku.kuMeetingHeaderActions.execAction")',
    @click='state.onExec'
  )
    template(#icon-left)
      q-icon(name='send', size='18px')
    | {{ $t('ku.kuMeetingHeaderActions.execAction') }}
  BaseButton(
    v-if='state.canCancel',
    variant='secondary',
    size='sm',
    :loading='state.busy',
    :aria-label='$t("ku.kuMeetingHeaderActions.cancelAction")',
    @click='state.onCancelOpen'
  )
    template(#icon-left)
      q-icon(name='event_busy', size='18px')
    | {{ $t('ku.kuMeetingHeaderActions.cancelAction') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import { kuMeetingHeaderActions } from '../model/header-actions-store';

const state = computed(() => kuMeetingHeaderActions.value);
</script>
