<template>
  <div class="recover-page">
    <RecoverConfirm :token="token" :coopname="coopname">
      <template #actions>
        <AuthActions />
      </template>
      <template #pane-foot> {{ $t('registrator.recoverConfirmPage.rememberedPasswordPrompt') }} <a class="auth-link" href="#" @click.prevent="goToSignIn">{{ $t('registrator.recoverConfirmPage.signInAction') }}</a>
      </template>
      <template #footer>
        <a class="auth-link" href="#" @click.prevent="goToSignIn">{{ $t('registrator.recoverConfirmPage.backToSignInAction') }}</a>
      </template>
    </RecoverConfirm>
  </div>
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { RecoverConfirm } from 'src/widgets/Registrator/Recover/ui';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';

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
  min-height: inherit;
}
</style>
