<template>
  <div class="recover-page">
    <RecoverRequest>
      <template #footer>
        <BaseButton variant="ghost" size="sm" @click="goToSignIn">
          Вернуться ко входу
        </BaseButton>
      </template>
    </RecoverRequest>
  </div>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { RecoverRequest } from 'src/widgets/Registrator/Recover/ui';

const router = useRouter();
const route = useRoute();

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.recover-page {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
}
</style>
