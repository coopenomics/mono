<template lang="pug">
.flow-consent
  p.flow-stage__lead {{ lead }}
  ul.flow-consent__list(v-if='permissions.length')
    li(v-for='right in permissions', :key='right.id') {{ right.name }}
  .flow-stage__actions
    BaseButton(variant='primary', :loading='sending', @click='answer') {{ action }}
</template>

<script lang="ts" setup>
/**
 * Согласие (стадия `ak-stage-consent`): выдача прав стороннему сервису либо подтверждение
 * действия, если прав не просят. Стандартные права authentik названы по-английски —
 * переводятся здесь; права, названные в блюпринтах по-русски, идут как есть.
 */
import { computed } from 'vue';
import { BaseButton } from 'src/shared/ui/base';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';
import { t } from 'src/shared/i18n';

const props = defineProps<{ challenge: FlowChallenge; sending: boolean }>();
const emit = defineEmits<{ answer: [payload: Record<string, unknown>] }>();

const RIGHT_NAMES: Readonly<Record<string, string>> = {
  'Email address': t('coopidFlow.flowConsent.scope.emailAddress'),
  'General Profile Information': t('coopidFlow.flowConsent.scope.profile'),
  'GoAuthentik.io API Access': t('coopidFlow.flowConsent.scope.apiAccess'),
};

const permissions = computed(() =>
  (props.challenge.permissions ?? [])
    .map((right) => ({ id: right.id, name: RIGHT_NAMES[right.name.trim()] ?? right.name.trim() }))
    .filter((right) => right.name.length > 0),
);
const confirming = computed(() => permissions.value.length === 0);
const lead = computed(() => (confirming.value ? t('coopidFlow.flowConsent.confirmLead') : t('coopidFlow.flowConsent.accessLead')));
const action = computed(() => (confirming.value ? t('common.action.confirm') : t('coopidFlow.flowConsent.allowAction')));
const answer = (): void => emit('answer', { component: props.challenge.component, token: props.challenge.token });
</script>

<style lang="scss" scoped>
.flow-consent__list {
  margin: 0 0 var(--p-4);
  padding-left: var(--p-5);
  display: grid;
  gap: var(--p-1);
  color: var(--p-ink-2);
}
</style>
