<template lang="pug">
//- Голосование живёт внутри «Результатов»: корень перенаправляет туда,
//- деталь по конкретному компоненту открывается как раньше.
router-view(v-if='!isVotingRoot')
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const isVotingRoot = computed(() => route.name === 'voting');

onMounted(() => {
  if (isVotingRoot.value) {
    router.replace({ name: 'results' });
  }
});
</script>
