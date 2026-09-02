<template lang="pug">
.flow-session-end
  BaseBanner(variant='info')
    strong Вы вышли.
    |  Сеанс в «{{ application }}» завершён.
  .flow-stage__actions
    BaseButton(variant='primary', @click='emit("leave")') Открыть стол
    BaseButton(v-if='back', variant='secondary', @click='openApplication') Вернуться в «{{ application }}»
</template>

<script lang="ts" setup>
/** Завершение сессии (стадия `ak-stage-session-end`) после выхода из стороннего сервиса. */
import { computed } from 'vue';
import { BaseBanner, BaseButton } from 'src/shared/ui/base';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge }>();
const emit = defineEmits<{ leave: [] }>();
const application = computed(() => props.challenge.application_name ?? 'сервис');
const back = computed(() => props.challenge.application_launch_url ?? null);
const openApplication = (): void => {
  if (back.value) window.location.assign(back.value);
};
</script>
