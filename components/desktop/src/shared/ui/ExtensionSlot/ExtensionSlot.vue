<template lang="pug">
//- Блоки других расширений, зарегистрированные в именованной точке страницы.
component(v-for='entry in entries', :key='entry.key', :is='entry.component')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { slotComponents } from 'src/shared/lib/extension-slots';

const props = defineProps<{ name: string }>();

const entries = computed(() => slotComponents(props.name));
</script>
