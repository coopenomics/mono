<template lang="pug">
  q-step(
    :name="5"
    :title="$t('connectionAgreementStepper.approvalWaitingStep.title')"
    icon="schedule"
    :done="isDone"
  )
    .approval-waiting-container.q-pa-md

      //- Основная карточка ожидания
      .waiting-card.bg-surface.q-mb-xl
        .waiting-header
          .waiting-icon-container
            q-icon.waiting-icon(
              :name="getWaitingIcon"
              :color="getWaitingIconColor"
              size="80px"
              @click="refreshStatus"
              clickable
            )
            .pulse-ring(v-if="instance?.blockchain_status !== 'active'")
          .waiting-title.text-h5.text-weight-medium.text-primary {{ $t('connectionAgreementStepper.approvalWaitingStep.waitingTitle') }}

        //- Статусная информация
        .status-info.q-mt-lg
          .status-description.text-body1.text-on-surface
            | {{ $t('connectionAgreementStepper.approvalWaitingStep.statusLine1') }}
            | {{ $t('connectionAgreementStepper.approvalWaitingStep.statusLine2') }}
            | {{ $t('connectionAgreementStepper.approvalWaitingStep.statusLine3') }}

    //- Навигация
    q-stepper-navigation.q-gutter-sm
      q-btn(
        color="grey-6"
        flat
        :label="$t('common.action.back')"
        @click="handleBack"
      )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IStepProps } from '../model/types'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const props = withDefaults(defineProps<IStepProps>(), {})

const connectionAgreement = useConnectionAgreementStore()

// Получаем данные напрямую из store
const instance = computed(() => connectionAgreement.currentInstance)

const isDone = computed(() => props.isDone)

// Иконка ожидания
const getWaitingIcon = computed(() => {
  if (instance.value?.blockchain_status === 'active') return 'check_circle'
  return 'schedule'
})

// Цвет иконки ожидания
const getWaitingIconColor = computed(() => {
  if (instance.value?.blockchain_status === 'active') return 'positive'
  return 'warning'
})

// Функция обновления статуса
const refreshStatus = async () => {
  try {
    await connectionAgreement.loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления статуса:', error)
  }
}

const handleBack = () => {
  connectionAgreement.setCurrentStep(4)
}
</script>

<style scoped>
.approval-waiting-container {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}

/* Основная карточка ожидания */
.waiting-card {
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.waiting-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--q-primary) 0%, var(--q-secondary) 50%, var(--q-primary) 100%);
  background-size: 200% 100%;
  animation: shimmer 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

@keyframes shimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 100% 0; }
}

/* Заголовок карточки */
.waiting-header {
  text-align: center;
  margin-bottom: 2rem;
}

.waiting-icon-container {
  position: relative;
  display: inline-block;
  margin-bottom: 1.5rem;
}

.waiting-icon {
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.15));
  animation: gentle-pulse 3s ease-in-out infinite;
  cursor: pointer;
  transition: all 0.3s ease;
}

.waiting-icon:hover {
  transform: scale(1.1);
  filter: drop-shadow(0 6px 20px rgba(0, 0, 0, 0.25));
}

@keyframes gentle-pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.9;
  }
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 90px;
  height: 90px;
  border: 1px solid rgba(255, 152, 0, 0.2);
  border-radius: 50%;
  animation: pulse-ring 2s cubic-bezier(0.455, 0.03, 0.515, 0.955) infinite;
}

@keyframes pulse-ring {
  0% {
    transform: translate(-50%, -50%) scale(0.8);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.4);
    opacity: 0;
  }
}

.waiting-title {
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Статусная информация */
.status-info {
  padding: 1.5rem;
  border-radius: 16px;
  border: 1px solid rgba(255, 152, 0, 0.1);
}

.status-description {
  line-height: 1.6;
  text-align: center;
}




/* Адаптивность */
@media (max-width: 768px) {
  .waiting-card {
    padding: 2rem;
  }



  .pulse-ring {
    width: 70px;
    height: 70px;
  }
}

@media (max-width: 480px) {
  .approval-waiting-container {
    padding: 1rem;
  }

  .waiting-card {
    padding: 1.5rem;
  }

  .waiting-icon {
    font-size: 60px;
  }

  .pulse-ring {
    width: 60px;
    height: 60px;
  }

  .status-info {
    padding: 1rem;
  }

}
</style>

