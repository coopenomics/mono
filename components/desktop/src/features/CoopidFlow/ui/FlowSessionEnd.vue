<template lang="pug">
.flow-session-end
  BaseBanner(variant='info')
    strong {{ $t('coopidFlow.flowSessionEnd.title') }}
    |  {{ $t('coopidFlow.flowSessionEnd.text', { application }) }}
  .flow-stage__actions
    BaseButton(variant='primary', @click='emit("leave")') {{ $t('coopidFlow.flowSessionEnd.openDeskAction') }}
    BaseButton(v-if='back', variant='secondary', @click='openApplication') {{ $t('coopidFlow.flowSessionEnd.backAction', { application }) }}
</template>

<script lang="ts" setup>
/** Завершение сессии (стадия `ak-stage-session-end`) после выхода из стороннего сервиса. */
import { computed } from 'vue';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';
import { t } from 'src/shared/i18n';

const props = defineProps<{ challenge: FlowChallenge }>();
const emit = defineEmits<{ leave: [] }>();
const application = computed(() => props.challenge.application_name ?? t('coopidFlow.flowSessionEnd.defaultApplicationName'));
const back = computed(() => props.challenge.application_launch_url ?? null);
const openApplication = (): void => {
  if (back.value) window.location.assign(back.value);
};
</script>
