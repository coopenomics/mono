<template lang="pug">
.flow-autosubmit
  p.flow-stage__lead Продолжаем…
  form(ref='form', :action='challenge.url', method='post')
    input(v-for='[name, value] in fields', :key='name', type='hidden', :name='name', :value='value')
</template>

<script lang="ts" setup>
/** Автоматическая отправка формы наружу (стадия `ak-stage-autosubmit`): чужая сторона ждёт переход браузера. */
import { onMounted, ref } from 'vue';
import type { FlowChallenge } from 'src/shared/api/authentik-flow';

const props = defineProps<{ challenge: FlowChallenge }>();
const form = ref<HTMLFormElement | null>(null);
const fields = Object.entries(props.challenge.attrs ?? {});
onMounted(() => form.value?.submit());
</script>
