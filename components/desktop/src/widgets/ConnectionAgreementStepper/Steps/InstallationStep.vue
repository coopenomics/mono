<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)

const progress = computed(() => Math.max(0, Math.min(100, instance.value?.progress || 0)))

const stage = computed(() => {
  const p = progress.value
  if (p < 20) return { title: 'Подготовка серверного окружения', body: 'Настраиваем инфраструктуру и развёртываем серверные компоненты.' }
  if (p < 40) return { title: 'Загрузка компонентов Цифрового Кооператива', body: 'Устанавливаем программное обеспечение и зависимости платформы.' }
  if (p < 60) return { title: 'Настройка баз данных и хранилищ', body: 'Разворачиваем базы данных, инициализируем структуры и резервное копирование.' }
  if (p < 80) return { title: 'Запуск блокчейн-узла', body: 'Разворачиваем и синхронизируем узел с сетью Кооперативной Экономики.' }
  return { title: 'Финализация поставки', body: 'Выполняем заключительные настройки и проверяем работоспособность.' }
})

const remainingMinutes = computed(() => Math.max(0, 100 - progress.value))
</script>

<template lang="pug">
.installation-step
  p.t-sm.t-muted.installation-step__lead Поставка Цифрового Кооператива с подключением к платформе Кооперативной Экономики.

  .installation-step__progress
    .installation-step__progress-head
      span.t-eyebrow.t-muted Прогресс поставки
      span.t-mono.t-num.installation-step__pct {{ progress }}%
    .installation-step__bar
      .installation-step__bar-fill(:style="{ width: progress + '%' }")
    p.t-meta.t-muted.installation-step__remaining
      | Осталось примерно {{ remainingMinutes }} мин

  .installation-step__stage
    .t-h3 {{ stage.title }}
    p.t-sm.t-muted.installation-step__stage-body {{ stage.body }}
</template>

<style scoped>
.installation-step {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
  max-width: 640px;
}
.installation-step__lead {
  margin: 0;
}
.installation-step__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}
.installation-step__progress-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.installation-step__pct {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.installation-step__bar {
  position: relative;
  height: 4px;
  border-radius: var(--p-r-pill);
  background: var(--p-surface-3);
  overflow: hidden;
}
.installation-step__bar-fill {
  height: 100%;
  background: var(--p-primary);
  border-radius: var(--p-r-pill);
  transition: width var(--p-dur-slow) var(--p-ease-standard);
}
.installation-step__remaining {
  margin: 0;
}
.installation-step__stage {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  padding: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}
.installation-step__stage-body {
  margin: 0;
}
</style>
