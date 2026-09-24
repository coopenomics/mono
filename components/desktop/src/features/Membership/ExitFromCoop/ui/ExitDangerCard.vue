<template lang="pug">
BaseCard(
  :title='$t("membership.exitDangerCard.title")',
  :subtitle='$t("membership.exitDangerCard.subtitle")'
)
  .exit-danger
    p.exit-danger__hint
      | {{ $t('membership.exitDangerCard.irreversibleHintLine1') }}
      | {{ $t('membership.exitDangerCard.irreversibleHintLine2') }}
    .exit-danger__actions
      BaseButton(variant='danger', @click='infoOpen = true')
        template(#icon-left)
          q-icon(name='group_remove', size='18px')
        | {{ $t('membership.exitDangerCard.exitButtonLabel') }}

  //- Шаг 1: как проходит выход (бывшая отдельная страница, свёрнута в диалог).
  //- Шаг 2 — заявление и подпись — открывает ExitButton своим диалогом поверх.
  BaseDialog(v-model='infoOpen', :title='$t("membership.exitDangerCard.infoDialogTitle")', size='md')
    .exit-danger__info
      BaseBanner(variant='warn')
        | {{ $t('membership.exitDangerCard.infoVoluntaryLine1') }}
        | {{ $t('membership.exitDangerCard.infoVoluntaryLine2') }}
        | {{ $t('membership.exitDangerCard.infoVoluntaryLine3') }}

      ul.exit-points
        li
          q-icon(name='description', size='18px')
          span
            | {{ $t('membership.exitDangerCard.infoStep1Line1') }}
            | {{ $t('membership.exitDangerCard.infoStep1Line2') }}
        li
          q-icon(name='mark_email_unread', size='18px')
          span
            | {{ $t('membership.exitDangerCard.infoStep2Line1') }}
            | {{ $t('membership.exitDangerCard.infoStep2Line2') }}
        li
          q-icon(name='handshake', size='18px')
          span
            | {{ $t('membership.exitDangerCard.infoAnnulmentLine1') }}
            | {{ $t('membership.exitDangerCard.infoAnnulmentLine2') }}
        li
          q-icon(name='payments', size='18px')
          span
            | {{ $t('membership.exitDangerCard.infoStep3Line1') }}
            | {{ $t('membership.exitDangerCard.infoStep3Line2') }}
        li.exit-points__note
          q-icon(name='block', size='18px')
          span
            | {{ $t('membership.exitDangerCard.infoStep4Line1') }}
            | {{ $t('membership.exitDangerCard.infoStep4Line2') }}

    template(#footer)
      BaseButton(variant='secondary', @click='infoOpen = false') {{ $t('common.action.cancel') }}
      ExitButton(
        :label='$t("membership.exitDangerCard.infoWriteApplicationLabel")',
        variant='danger',
        icon='edit_note'
      )
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import ExitButton from './ExitButton.vue';

const infoOpen = ref(false);
</script>

<style scoped lang="scss">
.exit-danger {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.exit-danger__hint {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.exit-danger__actions {
  display: flex;
}
.exit-danger__info {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.exit-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.exit-points li {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.exit-points li .q-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--p-ink-3);
}
.exit-points__note {
  color: var(--p-ink-3);
}
</style>
