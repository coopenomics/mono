<template lang="pug">
q-card(flat).mb-4
  q-card-section
    q-checkbox(
      v-model='expandAllModel',
      :label='$t("capital.expandOptionsWidget.expandAllLabel")'
    )

</template>

<script lang="ts" setup>
import { ref, watch } from 'vue';


const props = defineProps<{
  expandAll?: boolean;
  expandedProjects?: Record<string, boolean>;
  expandedComponents?: Record<string, boolean>;
  totalProjects?: number;
  totalComponents?: number;
}>();

const emit = defineEmits<{
  'expand-all-changed': [value: boolean];
}>();

// Простая реактивная модель для чекбокса
const expandAllModel = ref(false);

// Синхронизируем с prop
watch(() => props.expandAll, (newValue) => {
  expandAllModel.value = newValue || false;
}, { immediate: true });

// При изменении чекбокса отправляем событие
watch(expandAllModel, (newValue) => {
  emit('expand-all-changed', newValue);
});
</script>

<style lang="scss" scoped>
.q-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}
</style>
