<template lang="pug">
.provision-back
  BaseButton(variant='ghost', size='sm', @click='goBack')
    template(#icon-left)
      q-icon.q-mr-xs(name='arrow_back', size='18px')
    | {{ label }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { t } from 'src/shared/i18n';

const router = useRouter();
const session = useSessionStore();

const isLoggedIn = computed(() => Boolean(session.isAuth));

const label = computed(() => (isLoggedIn.value ? t('agreementer.provisionBackButton.loggedInLabel') : t('agreementer.provisionBackButton.loggedOutLabel')));

/**
 * Публичные положения открывают и по прямой ссылке, в том числе без входа,
 * поэтому уходить «назад» по истории некуда, а дровера на этих страницах нет:
 * он живёт внутри рабочего стола кооператива, а в адресе положения нет имени
 * кооператива. Возврат ведём на корневой маршрут — он сам разводит пайщика на
 * его стол, а гостя на публичную главную.
 */
function goBack() {
  router.push({ name: 'index' });
}
</script>

<style scoped>
.provision-back {
  margin-bottom: var(--p-3);
}
</style>
