<template>
  <div class="lostkey-page">
    <LostKey>
      <template #actions>
        <AuthActions />
      </template>
      <template #pane-foot> {{ $t('registrator.lostKeyPage.rememberedKeyPrompt') }} <a class="auth-link" href="#" @click.prevent="goToSignIn">{{ $t('registrator.lostKeyPage.signInAction') }}</a>
      </template>
      <template #footer>
        <a class="auth-link" href="#" @click.prevent="goBack">{{ $t('common.action.back') }}</a>
      </template>
    </LostKey>
  </div>
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { LostKey } from 'src/widgets/Registrator/LostKey/ui';
import { AuthActions } from 'src/widgets/Registrator/AuthActions';

const router = useRouter();
const route = useRoute();
function goBack(): void {
  router.go(-1);
}
function goToSignIn(): void {
  void router.push({ name: 'signin', params: { coopname: route.params.coopname } });
}
</script>

<style scoped>
.lostkey-page {
  min-height: inherit;
}
</style>
