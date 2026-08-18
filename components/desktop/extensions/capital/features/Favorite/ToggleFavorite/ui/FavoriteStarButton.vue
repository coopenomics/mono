<template lang="pug">
BaseButton.favorite-star-btn(
  variant='ghost',
  size='sm',
  icon-only,
  :disabled='pending',
  :class="{ 'favorite-star-btn--active': active }",
  :aria-label="hint",
  @click.stop='onToggle'
)
  template(#icon-left)
    q-icon(:name="active ? 'star' : 'star_outline'", size='18px')
    q-tooltip {{ hint }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert } from 'src/shared/api';
import { BaseButton } from 'src/shared/ui/base';
import { useFavoritesStore } from 'app/extensions/capital/entities/Favorite';
import type { IFavoriteTargetType } from 'app/extensions/capital/entities/Favorite';

const props = defineProps<{
  targetType: IFavoriteTargetType;
  targetHash: string;
}>();

const session = useSessionStore();
const system = useSystemStore();
const favorites = useFavoritesStore();

const active = computed(() => favorites.isFavorite(props.targetType, props.targetHash));
const hint = computed(() => (active.value ? 'Убрать из избранного' : 'В избранное'));
const pending = ref(false);

async function onToggle(): Promise<void> {
  if (pending.value) return;
  pending.value = true;
  try {
    await favorites.toggleFavorite({
      coopname: system.info.coopname,
      username: session.username,
      target_type: props.targetType,
      target_hash: props.targetHash,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    FailAlert('Не удалось обновить избранное: ' + msg);
  } finally {
    pending.value = false;
  }
}
</script>

<style lang="scss" scoped>
/* Цвет — прямо на иконке: цвет кнопки перебивается канон-стилями q-btn,
   наследование ненадёжно. Fallback на случай непрогретых токенов. */
.favorite-star-btn :deep(.q-icon) {
  color: var(--p-ink-3);
}
.favorite-star-btn--active :deep(.q-icon) {
  color: var(--p-star, #f59e0b);
}
</style>
