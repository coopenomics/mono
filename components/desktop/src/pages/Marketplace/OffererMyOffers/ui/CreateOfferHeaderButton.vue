<template lang="pug">
BaseButton(
  variant="primary",
  size="sm",
  :icon-only="isCompact",
  aria-label="Создать предложение",
  @click="goCreate"
)
  template(#icon-left)
    q-icon(name="add", size="18px")
  | Создать предложение
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { BaseButton } from 'src/shared/ui/base';

/**
 * Кнопка «Создать предложение» для правого верхнего угла шапки (телепорт через
 * useHeaderActions со стола поставщика). На десктопе — полная кнопка с
 * подписью, на телефоне (xs) сворачивается до иконки `add`.
 */
const $q = useQuasar();
const router = useRouter();
const { info } = useSystemStore();

const isCompact = computed(() => $q.screen.lt.sm);

function goCreate(): void {
  void router.push({
    name: 'marketplace-create-offer',
    params: { coopname: info.coopname },
  });
}
</script>
