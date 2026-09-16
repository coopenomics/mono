<template lang="pug">
StatusPage(
  icon='search_off',
  title='Страница не найдена',
  body='Такого адреса в кабинете нет: ссылка устарела или в ней опечатка. Вернитесь на главную или на предыдущую страницу.'
)
  template(#actions)
    BaseButton(variant='primary', @click='goHome') На главную
    BaseButton(v-if='canGoBack', variant='ghost', @click='router.back()') Назад
</template>

<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';
import { StatusPage } from 'src/shared/ui/domain';
import { useGoHome } from 'src/shared/lib/navigation';

const router = useRouter();
const goHome = useGoHome();
// «Назад» есть только когда есть куда: у прямого захода по ссылке истории нет.
const canGoBack = computed(() => typeof window !== 'undefined' && window.history.length > 1);
</script>
