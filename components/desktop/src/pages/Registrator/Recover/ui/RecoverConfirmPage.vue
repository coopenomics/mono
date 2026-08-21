<template>
  <div class="recover-page">
    <RecoverConfirm :token="token" :coopname="coopname">
      <template #footer>
        <BaseButton variant="ghost" size="sm" @click="goToSignIn">
          Вернуться ко входу
        </BaseButton>
      </template>
    </RecoverConfirm>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { RecoverConfirm } from 'src/widgets/Registrator/Recover/ui';

const router = useRouter();
const route = useRoute();

const token = computed(() => String(route.params.token ?? ''));
const coopname = computed(() => String(route.params.coopname ?? ''));

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: coopname.value } });
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
