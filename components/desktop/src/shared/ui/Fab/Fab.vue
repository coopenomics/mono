<template lang="pug">
q-page-sticky(position="bottom-right" :offset="fabPos")
  // Если есть слот actions - рендерим раскрывающийся FAB
  //- fa-solid fa-dharmachakra
  q-fab(
    ref="fabRef"
    v-if="$slots.actions"
    icon="add"
    direction="up"
    vertical-actions-align="right"
    :disable="draggingFab"
    v-touch-pan.prevent.mouse="moveFab"
    text-color="white"
    color="primary"
    @mouseenter="onFabEnter"
    @mouseleave="onFabLeave"
    :class="`${fabClass || ''}`"
  )
    template(#default)
      div(@mouseenter="onActionsEnter" @mouseleave="onActionsLeave")
        slot(name="actions")

  // Если есть слот default - рендерим содержимое слота как обычную кнопку
  div(v-else)
    slot
</template>
<script setup lang="ts">
import { ref, watch } from 'vue'
import { LocalStorage } from 'quasar'

const FAB_POSITION_KEY = 'fab-position'

// Восстанавливаем позицию из LocalStorage или используем дефолтную
const savedPos = LocalStorage.getItem(FAB_POSITION_KEY)
const fabPos = ref(Array.isArray(savedPos) ? savedPos : [18, 18])
const draggingFab = ref(false)
const fabRef = ref()

// Отслеживаем, находится ли курсор над FAB или его действиями
let isHoveringFab = false
let isHoveringActions = false
let hideTimeout: ReturnType<typeof setTimeout> | null = null

const moveFab = (ev: any) => {
  draggingFab.value = ev.isFirst !== true && ev.isFinal !== true

  fabPos.value = [
    fabPos.value[0] - ev.delta.x,
    fabPos.value[1] - ev.delta.y
  ]
}

const onFabEnter = () => {
  isHoveringFab = true
  // Очищаем таймер скрытия, если он был запущен
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
  fabRef.value?.show()
}

const onFabLeave = () => {
  isHoveringFab = false
  // Запускаем таймер скрытия с задержкой
  scheduleHide()
}

const onActionsEnter = () => {
  isHoveringActions = true
  // Очищаем таймер скрытия, если он был запущен
  if (hideTimeout) {
    clearTimeout(hideTimeout)
    hideTimeout = null
  }
}

const onActionsLeave = () => {
  isHoveringActions = false
  // Запускаем таймер скрытия с задержкой
  scheduleHide()
}

const scheduleHide = () => {
  // Скрываем только если курсор не над FAB и не над действиями
  if (!isHoveringFab && !isHoveringActions) {
    hideTimeout = setTimeout(() => {
      fabRef.value?.hide()
      hideTimeout = null
    }, 1000) // Задержка 1000мс
  }
}

// Сохраняем позицию в LocalStorage при изменении
watch(fabPos, (newPos) => {
  LocalStorage.set(FAB_POSITION_KEY, newPos)
}, { deep: true })

defineProps<{
  fabClass?: string;
}>();
</script>
