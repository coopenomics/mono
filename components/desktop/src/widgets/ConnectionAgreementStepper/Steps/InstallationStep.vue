<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)

const progress = computed(() => Math.max(0, Math.min(100, instance.value?.progress || 0)))

/**
 * Возврат в строй отличается от первой установки: платформа разворачивается
 * заново, но данные кооператива никуда не делись — они лежат в резервной
 * копии, снятой перед отключением сервера, и вернутся в конце цикла. Об этом
 * нужно сказать прямо: тот же экран с заголовком «устанавливаем» читается как
 * «всё начинается с чистого листа».
 */
const isRestoring = computed(() => instance.value?.is_restoring === true)

const INSTALL_STAGES = [
  { from: 0, title: 'Готовим сервер', body: 'Настраиваем окружение и разворачиваем серверные компоненты.' },
  { from: 20, title: 'Устанавливаем платформу', body: 'Загружаем программное обеспечение Цифрового Кооператива.' },
  { from: 40, title: 'Настраиваем хранилища', body: 'Разворачиваем базы данных и резервное копирование.' },
  { from: 60, title: 'Запускаем блокчейн-узел', body: 'Синхронизируем узел с сетью Кооперативной Экономики.' },
  { from: 80, title: 'Завершаем установку', body: 'Выполняем финальные настройки и проверяем, что всё работает.' },
]

const RESTORE_STAGES = [
  { from: 0, title: 'Арендуем новый сервер', body: 'Конфигурация та же, что была у кооператива до отключения.' },
  { from: 20, title: 'Устанавливаем платформу', body: 'Загружаем программное обеспечение Цифрового Кооператива.' },
  { from: 40, title: 'Настраиваем хранилища', body: 'Готовим базы данных и файловое хранилище под ваши данные.' },
  { from: 60, title: 'Запускаем блокчейн-узел', body: 'Синхронизируем узел с сетью Кооперативной Экономики.' },
  {
    from: 80,
    title: 'Возвращаем данные из копии',
    body: 'Восстанавливаем базы и файлы из последней резервной копии и открываем доступ к платформе.',
  },
]

const stages = computed(() => (isRestoring.value ? RESTORE_STAGES : INSTALL_STAGES))

const title = computed(() =>
  isRestoring.value ? 'Возвращаем кооператив в строй' : 'Устанавливаем вашу копию платформы',
)

const lead = computed(() =>
  isRestoring.value
    ? 'Оплата получена. Провайдер разворачивает платформу на новом сервере той же конфигурации ' +
      'и вернёт данные кооператива из последней резервной копии: документы, базы и файлы на месте, ' +
      'ничего заново заводить не нужно. Ждать на этой странице не обязательно.'
    : 'Провайдер разворачивает Цифровой Кооператив на вашем домене. Ждать на этой странице ' +
      'не обязательно: когда установка завершится, здесь появится панель подключения.',
)

const stageIndex = computed(() => {
  let i = 0
  stages.value.forEach((s, idx) => { if (progress.value >= s.from) i = idx })
  return i
})

const remainingMinutes = computed(() => Math.max(0, 100 - progress.value))
</script>

<template lang="pug">
StepFrame(
  :title="title"
  :lead="lead"
  :can-back="false"
  :has-next="false"
)
  .installation-step__progress
    .installation-step__progress-head
      span.t-sm.t-muted Осталось примерно {{ remainingMinutes }} мин
      span.t-mono.t-num.installation-step__pct {{ progress }}%
    .installation-step__bar
      .installation-step__bar-fill(:style="{ width: progress + '%' }")

  ol.installation-step__stages
    li.installation-step__stage(
      v-for="(s, idx) in stages"
      :key="s.from"
      :class="{ 'installation-step__stage--done': idx < stageIndex, 'installation-step__stage--active': idx === stageIndex }"
    )
      .installation-step__stage-mark
        q-icon(v-if="idx < stageIndex" name="check" size="14px")
        q-icon(v-else-if="idx === stageIndex" name="autorenew" size="14px").installation-step__spin
        span(v-else) {{ idx + 1 }}
      .installation-step__stage-body
        .installation-step__stage-title {{ s.title }}
        .t-sm.t-muted(v-if="idx === stageIndex") {{ s.body }}
</template>

<style scoped>
.installation-step__progress {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
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
.installation-step__stages {
  list-style: none;
  margin: var(--p-5) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.installation-step__stage {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: var(--p-3);
  align-items: start;
  color: var(--p-ink-3);
}
.installation-step__stage--active,
.installation-step__stage--done {
  color: var(--p-ink);
}
.installation-step__stage-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid var(--p-line-2);
  font-size: var(--p-fs-meta);
  font-weight: 600;
  color: var(--p-ink-2);
}
.installation-step__stage--active .installation-step__stage-mark {
  border-color: var(--p-primary);
  color: var(--p-primary);
}
.installation-step__stage--done .installation-step__stage-mark {
  background: var(--p-primary);
  border-color: var(--p-primary);
  color: var(--p-ink-on-primary);
}
.installation-step__stage-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  line-height: var(--p-lh-body);
}
.installation-step__spin {
  animation: installation-step-rotate 1.6s linear infinite;
}
@keyframes installation-step-rotate {
  to { transform: rotate(360deg); }
}
</style>
