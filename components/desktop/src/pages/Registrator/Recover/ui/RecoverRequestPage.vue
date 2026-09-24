<template>
  <div class="recover-page">
    <RecoverRequest>
      <template #actions>
        <AuthActions />
      </template>
      <template #pane-foot> {{ $t('registrator.recoverRequestPage.rememberedPasswordPrompt') }} <a class="auth-link" href="#" @click.prevent="goToSignIn">{{ $t('registrator.recoverRequestPage.signInAction') }}</a>
      </template>
      <template #footer>
        <a class="auth-link" href="#" @click.prevent="goToSignIn">{{ $t('registrator.recoverRequestPage.backToSignInAction') }}</a>
      </template>
    </RecoverRequest>
  </div>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { RecoverRequest } from 'src/widgets/Registrator/Recover/ui';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';

const router = useRouter();
const route = useRoute();

function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.recover-page {
  min-height: inherit;
}
</style>
