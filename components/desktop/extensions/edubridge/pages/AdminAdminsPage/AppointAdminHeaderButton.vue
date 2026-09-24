<template lang="pug">
BaseButton(variant="primary" size="sm" :icon-only="isCompact" :aria-label="$t('edubridge.appointAdminHeaderButton.label')" @click="emit('click')")
  template(#icon-left)
    q-icon(name="person_add" size="18px")
  | {{ $t('edubridge.appointAdminHeaderButton.label') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { BaseButton } from 'src/shared/ui/base';

/** Кнопка «Назначить администратора» в правом верхнем углу шапки (телепорт через useHeaderActions). */
const emit = defineEmits<{ click: [] }>();
const $q = useQuasar();
const isCompact = computed(() => $q.screen.lt.sm);
</script>
