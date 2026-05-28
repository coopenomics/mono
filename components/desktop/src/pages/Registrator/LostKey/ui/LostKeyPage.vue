<template>
  <div class="lostkey-page">
    <LostKey>
      <template #footer>
        <BaseButton variant="ghost" size="sm" @click="goBack">Назад</BaseButton>
      </template>
    </LostKey>
  </div>
</template>

<script lang="ts" setup>
import { useRouter } from 'vue-router';
import { LostKey } from 'src/widgets/Registrator/LostKey/ui';

const router = useRouter();
function goBack(): void {
  router.go(-1);
}
</script>

<style scoped>
.lostkey-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
}
</style>
