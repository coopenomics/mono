<template lang="pug">
BaseButton(v-if='canManage' variant='primary' size='sm' @click='create')
  q-icon(name='add' size='18px')
  span {{ $t('greetings.templates.create') }}
</template>

<script lang="ts" setup>
import { useRoute, useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base';
import { useCanManageGreetings } from '../../../entities/Greeting';

/** Кнопка шапки «Создать шаблон»: открывает редактор нового черновика. Видна председателю. */
const router = useRouter();
const route = useRoute();
const canManage = useCanManageGreetings();

function create() {
  void router.push({ name: 'greetings-template', params: { coopname: route.params.coopname, id: 'new' } });
}
</script>
