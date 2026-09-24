<template lang="pug">
  q-step(
    :name="6"
    :title="$t('connection.installation.stepTitle')"
    icon="cloud_download"
    :done="isDone"
  )
    .installation-container.q-pa-md

      //- Установка в процессе
      div
        //- Заголовок с градиентом

        .installation-header
          .text-h6.installation-title {{ $t('connection.installation.title') }}
          .subtitle.text-body2.text-grey-7.q-mt-sm
            | {{ $t('connection.installation.subtitle') }}

        //- Основная карточка прогресса
        .progress-card.q-mb-xl
          .progress-header
            .progress-title
              q-icon(name="rocket_launch" size="24px" color="primary").q-mr-sm
              span.text-subtitle1.text-weight-medium {{ $t('connection.installation.progress') }}

          //- Живой прогресс-бар с анимацией
          .progress-bar-container.q-mt-lg
            .progress-bar-background
              .progress-bar-fill(
                :style="{ width: (instance?.progress || 0) + '%' }"
              )
                .progress-bar-shimmer
            .progress-bar-glow(:style="{ width: (instance?.progress || 0) + '%' }")

          //- Оставшееся время
          .remaining-time.q-mt-md
            .time-display
              q-icon(name="schedule" size="18px" color="primary").q-mr-sm
              span.text-body2 {{ $t('connection.installation.remaining', { minutes: remainingTime }) }}

          //- Статус текущего этапа
          .current-stage.q-mt-lg
            .stage-info
              .stage-icon
                q-icon(:name="currentStageIcon" size="32px" :color="currentStageColor")
              .stage-details
                .stage-title.text-body1.text-weight-medium {{ currentStageTitle }}
                .stage-description.text-body2.text-grey-7.q-mt-xs {{ currentStageDescription }}



</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IStepProps } from '../model/types'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { t } from 'src/shared/i18n';

const props = withDefaults(defineProps<IStepProps>(), {})

const connectionAgreement = useConnectionAgreementStore()

// Получаем данные напрямую из store
const instance = computed(() => connectionAgreement.currentInstance)

const isDone = computed(() => props.isDone)

// Текущий этап (соответствует логике из startup-workflow.service.ts)
const currentStageInfo = computed(() => {
  const progress = instance.value?.progress || 0

  if (progress < 20) {
    return {
      icon: 'settings',
      color: 'primary',
      title: t('connection.installation.prepareTitle'),
      description: t('connection.installation.prepareText')
    }
  } else if (progress < 40) {
    return {
      icon: 'download',
      color: 'info',
      title: t('connection.installation.loadTitle'),
      description: t('connection.installation.loadText')
    }
  } else if (progress < 60) {
    return {
      icon: 'storage',
      color: 'warning',
      title: t('connection.installation.dbTitle'),
      description: t('connection.installation.dbText')
    }
  } else if (progress < 80) {
    return {
      icon: 'security',
      color: 'secondary',
      title: t('connection.installation.nodeTitle'),
      description: t('connection.installation.nodeText')
    }
  } else {
    return {
      icon: 'check_circle',
      color: 'positive',
      title: t('connection.installation.finalTitle'),
      description: t('connection.installation.finalText')
    }
  }
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const currentStageIcon = computed(() => currentStageInfo.value.icon)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const currentStageColor = computed(() => currentStageInfo.value.color)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const currentStageTitle = computed(() => currentStageInfo.value.title)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const currentStageDescription = computed(() => currentStageInfo.value.description)

// Расчет оставшегося времени (общая установка 100 минут)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const remainingTime = computed(() => {
  const progress = instance.value?.progress || 0
  const totalMinutes = 100
  const remaining = totalMinutes - progress
  return Math.max(0, remaining) // Не показываем отрицательные значения
})

// Редирект теперь обрабатывается в ConnectionAgreementPage через реактивность
// Здесь только отображение прогресса
</script>

<style scoped>
.installation-container {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}

/* Заголовок с градиентом */
.installation-header {
  text-align: center;
  margin-bottom: 2rem;
}

.installation-title {
  font-weight: 700;
  letter-spacing: -0.5px;
  background: linear-gradient(135deg, var(--q-primary) 0%, rgba(25, 118, 210, 0.8) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(25, 118, 210, 0.3);
}

/* Основная карточка прогресса */
.progress-card {
  border-radius: 20px;
  padding: 2.5rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.progress-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--q-primary) 0%, var(--q-secondary) 50%, var(--q-accent) 100%);
  background-size: 200% 100%;
  animation: shimmer 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.progress-title {
  display: flex;
  align-items: center;
  font-weight: 600;
  color: var(--q-primary);
}


/* Живой прогресс-бар */
.progress-bar-container {
  position: relative;
  height: 12px;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 20px;
  overflow: hidden;
  box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.1);
}

.progress-bar-background {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  width: 100%;
  background: linear-gradient(90deg, #e0e0e0 0%, #f0f0f0 100%);
}

.progress-bar-fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: linear-gradient(135deg, var(--q-primary) 0%, var(--q-secondary) 100%);
  border-radius: 20px;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow:
    0 0 20px rgba(25, 118, 210, 0.3),
    inset 0 1px 2px rgba(255, 255, 255, 0.2);
  position: relative;
  overflow: hidden;
}

.progress-bar-shimmer {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(255, 255, 255, 0.6) 30%,
    rgba(255, 255, 255, 0.8) 50%,
    rgba(255, 255, 255, 0.6) 70%,
    transparent 100%
  );
  animation: progress-shimmer 1.2s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes progress-shimmer {
  0% {
    left: -100%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 100%;
    opacity: 0;
  }
}

.progress-bar-glow {
  position: absolute;
  top: -2px;
  left: 0;
  height: 16px;
  background: linear-gradient(135deg, var(--q-primary) 0%, rgba(25, 118, 210, 0.3) 100%);
  border-radius: 20px;
  filter: blur(4px);
  opacity: 0.6;
  transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

/* Текущий этап */
.current-stage {
  margin-top: 2rem;
  padding: 1.5rem;
  background: rgba(25, 118, 210, 0.02);
  border-radius: 16px;
  border: 1px solid rgba(25, 118, 210, 0.1);
}

.stage-info {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stage-icon {
  background: linear-gradient(135deg, var(--q-primary) 0%, rgba(25, 118, 210, 0.8) 100%);
  border-radius: 50%;
  padding: 0.75rem;
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.2);
}

.stage-details {
  flex: 1;
}

.stage-title {
  color: var(--q-primary);
  margin-bottom: 0.25rem;
}

.stage-description {
  color: #666;
}

/* Оставшееся время */
.remaining-time {
  display: flex;
  justify-content: center;
  align-items: center;
}

.time-display {
  display: flex;
  align-items: center;
  padding: 0.75rem 1.5rem;
  background: rgba(25, 118, 210, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(25, 118, 210, 0.1);
}


/* Адаптивность */
@media (max-width: 768px) {
  .progress-card {
    padding: 2rem;
  }

  .progress-header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .stage-info {
    flex-direction: column;
    text-align: center;
    gap: 0.75rem;
  }

  .time-display {
    padding: 0.5rem 1rem;
  }
}

@media (max-width: 480px) {
  .installation-container {
    padding: 1rem;
  }

  .progress-card {
    padding: 1.5rem;
  }

  .time-display {
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
  }
}
</style>
