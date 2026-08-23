<template lang="pug">
.q-pa-md
  button.ku-back(type='button', @click='goBack')
    q-icon(name='arrow_back', size='16px')
    span К списку участков
  KuBranchDetailsWidget(:braname='braname')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { KuBranchDetailsWidget } from 'src/widgets/Ku/BranchDetails';

const route = useRoute();
const router = useRouter();
const system = useSystemStore();

const braname = computed(() => String(route.params.braname ?? ''));

function goBack(): void {
  router.push({ name: 'ku-branches', params: { coopname: system.info.coopname } });
}
</script>

<style scoped>
.ku-back {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
  margin-bottom: var(--p-4, 16px);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm, 13px);
  cursor: pointer;
  transition: color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.ku-back:hover {
  color: var(--p-ink);
}
</style>
