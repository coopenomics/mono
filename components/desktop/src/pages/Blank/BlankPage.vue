<template lang="pug">
StatusPage(
  icon='search_off',
  :title='$t("blank.blankPage.title")',
  :body='$t("blank.blankPage.body")'
)
  template(#actions)
    BaseButton(variant='primary', @click='goHome') {{ $t('blank.blankPage.homeLabel') }}
    BaseButton(v-if='canGoBack', variant='ghost', @click='router.back()') {{ $t('common.action.back') }}
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
