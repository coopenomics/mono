<template>
  <AuthSplit
    :eyebrow="coopTitle"
    :title="LOGIN_PANE.title"
    :lead="LOGIN_PANE.lead"
    :quote="LOGIN_PANE.quote"
    :step-eyebrow="$t('registrator.signIn.stepEyebrow')"
    :heading="title"
    :text="subtitle"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <LoginForm @step-change="step = $event" />
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { LoginForm } from 'src/features/User/LoginUser/ui/LoginForm';
import { LOGIN_PANE, useLoginStepHeading } from 'src/features/User/LoginUser';
import { useSystemStore } from 'src/entities/System/model';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { t } from 'src/shared/i18n';

const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const { step, title, subtitle } = useLoginStepHeading({
  title: t('registrator.signIn.title'),
  subtitle: t('registrator.signIn.subtitle'),
});
</script>
