<template lang="pug">
BaseButton(variant="primary" size="sm" :icon-only="isCompact" :aria-label="$t('edubridge.addLearnerHeaderButton.label')" @click="emit('click')")
  template(#icon-left)
    q-icon(name="person_add" size="18px")
  | {{ $t('edubridge.addLearnerHeaderButton.label') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { BaseButton } from 'src/shared/ui/base';

const emit = defineEmits<{ click: [] }>();
const $q = useQuasar();
const isCompact = computed(() => $q.screen.lt.sm);
</script>
