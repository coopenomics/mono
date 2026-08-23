<template>
  <div class="mp-egb">
    <div class="mp-egb__hint">
      Перетаскивайте заявки между колонками. Для оптом-переноса используйте «Переместить всё».
    </div>

    <div class="row q-col-gutter-md no-wrap mp-egb__board">
      <div
        v-for="col in columns"
        :key="col.id"
        class="mp-egb__column"
        :class="{ 'mp-egb__column--hover': hoverColId === col.id }"
        @dragover.prevent="hoverColId = col.id"
        @dragleave="hoverColId === col.id && (hoverColId = null)"
        @drop="onDrop(col.id, $event)"
      >
        <div class="mp-egb__col-header">
          <div class="mp-egb__col-title">{{ col.title }}</div>
          <span class="mp-status-chip mp-status-chip--neutral">
            {{ col.items.length }}
          </span>
        </div>

        <div v-if="col.meta" class="mp-egb__col-meta">{{ col.meta }}</div>

        <div class="mp-egb__items mp-gap-sm">
          <div
            v-for="item in col.items"
            :key="item.id"
            class="mp-egb__item mp-card"
            draggable="true"
            @dragstart="onDragStart($event, item.id, col.id)"
          >
            <div class="mp-egb__item-id">№ {{ item.shortId }}</div>
            <div class="mp-egb__item-title">{{ item.title }}</div>
            <div class="mp-egb__item-meta">
              {{ item.units }}×{{ item.unitLabel ?? 'ед.' }} · {{ item.pvz }}
            </div>
          </div>

          <div v-if="!col.items.length" class="mp-egb__empty">
            <q-icon name="fa-solid fa-inbox" size="28px" class="mp-egb__empty-icon" />
            <div class="mp-egb__empty-text">Перетащите сюда</div>
          </div>
        </div>

        <!-- Bulk move: переместить все элементы из других колонок (если в столбце мало или пусто
             и есть много единиц того же заказа в соседней колонке — оператору не нужно тащить по одной). -->
        <div v-if="bulkSources(col).length" class="mp-egb__bulk">
          <q-btn
            v-for="src in bulkSources(col)"
            :key="src.id"
            flat
            dense
            no-caps
            class="mp-egb__bulk-btn"
            :label="`Переместить всё (${src.items.length}) из «${src.title}»`"
            @click="moveAll(src.id, col.id)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, type PropType } from 'vue'

export interface GroupingItem {
  id: string | number
  shortId: string
  title: string
  units: number
  unitLabel?: string
  pvz: string
}

export interface GroupingColumn {
  id: string
  title: string
  meta?: string
  items: GroupingItem[]
}

const props = defineProps({
  columns: { type: Array as PropType<GroupingColumn[]>, required: true },
})

const emit = defineEmits<{
  (e: 'move', payload: { itemId: string | number; fromColumnId: string; toColumnId: string }): void
  (e: 'move-all', payload: { fromColumnId: string; toColumnId: string }): void
}>()

const hoverColId = ref<string | null>(null)

function onDragStart(ev: DragEvent, itemId: string | number, fromColumnId: string) {
  ev.dataTransfer?.setData('application/x-mp-item', JSON.stringify({ itemId, fromColumnId }))
  if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'
}

function onDrop(toColumnId: string, ev: DragEvent) {
  hoverColId.value = null
  const raw = ev.dataTransfer?.getData('application/x-mp-item')
  if (!raw) return
  try {
    const { itemId, fromColumnId } = JSON.parse(raw)
    if (fromColumnId === toColumnId) return
    emit('move', { itemId, fromColumnId, toColumnId })
  } catch { /* noop */ }
}

// Подбор источников для bulk-move: для колонки `target`
// показываем все колонки, в которых ≥2 элементов, которые могут поехать сюда оптом.
// Решение «куда» оставляем за оператором — он жмёт явную кнопку.
function bulkSources(target: GroupingColumn) {
  return props.columns.filter((c) => c.id !== target.id && c.items.length >= 2)
}

function moveAll(fromColumnId: string, toColumnId: string) {
  emit('move-all', { fromColumnId, toColumnId })
}
</script>

<style scoped lang="scss">
.mp-egb {
  &__hint {
    font-size: 13px;
    color: var(--mp-on-surface-muted);
    margin-bottom: var(--mp-space-md);
  }

  &__board {
    overflow-x: auto;
    padding-bottom: var(--mp-space-sm);
  }

  &__column {
    min-width: 280px;
    flex: 1;
    background: var(--mp-surface-1);
    border: 1px solid var(--mp-border-subtle);
    border-radius: var(--mp-radius-md);
    padding: var(--mp-space-md);
    display: flex;
    flex-direction: column;
    transition: border-color .15s ease, background-color .15s ease;

    &--hover {
      border-color: var(--q-primary);
      background: var(--mp-surface-2);
    }
  }

  &__col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--mp-space-xs);
  }

  &__col-title {
    font-weight: 600;
    color: var(--mp-on-surface);
  }

  &__col-meta {
    font-size: 12px;
    color: var(--mp-on-surface-muted);
    margin-bottom: var(--mp-space-sm);
  }

  &__items {
    display: flex;
    flex-direction: column;
    gap: var(--mp-space-sm);
    flex: 1;
  }

  &__item {
    padding: var(--mp-space-sm) var(--mp-space-md);
    cursor: grab;
    &:active { cursor: grabbing; }
  }

  &__item-id {
    font-size: 12px;
    color: var(--mp-on-surface-muted);
  }

  &__item-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--mp-on-surface);
    margin-top: 2px;
  }

  &__item-meta {
    font-size: 12px;
    color: var(--mp-on-surface-muted);
    margin-top: 4px;
  }

  &__empty {
    border: 1px dashed var(--mp-border-strong);
    border-radius: var(--mp-radius-sm);
    padding: var(--mp-space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--mp-on-surface-muted);
  }

  &__empty-icon { color: var(--mp-on-surface-muted); opacity: .6; }
  &__empty-text { font-size: 12px; margin-top: var(--mp-space-xs); }

  &__bulk {
    margin-top: var(--mp-space-sm);
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: var(--mp-space-sm);
    border-top: 1px dashed var(--mp-border-subtle);
  }

  &__bulk-btn {
    border-radius: var(--mp-radius-sm);
    justify-content: flex-start;
    color: var(--q-primary);
  }
}
</style>
