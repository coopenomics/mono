<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton } from 'src/shared/ui/base'
import { useConnectionAgreementStore, CONNECTION_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n'

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)
const isApproved = computed(() => instance.value?.blockchain_status === 'active')
const isChecking = ref(false)

// Путь подключения целиком: сделанное пайщиком отмечено, решение совета —
// текущий этап, установка — следующий. Тот же вид, что у шага установки.
const stages = computed(() => [
  { title: t('connectionAgreementStepper.approvalWaitingStep.stageDomain'), state: 'done' },
  { title: t('connectionAgreementStepper.approvalWaitingStep.stageAgreement'), state: 'done' },
  {
    title: t('connectionAgreementStepper.approvalWaitingStep.stageCouncil'),
    state: isApproved.value ? 'done' : 'active',
  },
  {
    title: t('connectionAgreementStepper.approvalWaitingStep.stageInstall'),
    state: isApproved.value ? 'active' : 'pending',
  },
])

// До решения совета можно вернуться к домену — сверить или исправить адрес.
// К соглашению и шагам до него назад не пускает: соглашение подписано.
const handleBack = () => {
  connectionAgreement.setCurrentStep(CONNECTION_STEP.dns)
}

const refreshStatus = async () => {
  isChecking.value = true
  try {
    await connectionAgreement.loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления статуса:', error)
  } finally {
    isChecking.value = false
  }
}
</script>

<template lang="pug">
StepFrame(
  :title="$t('connectionAgreementStepper.approvalWaitingStep.stepTitle')"
  :lead="$t('connectionAgreementStepper.approvalWaitingStep.lead')"
  :can-back="!isApproved"
  :has-next="false"
  @back="handleBack"
)
  .approval-step__hero(:class="{ 'approval-step__hero--done': isApproved }")
    .approval-step__icon
      q-icon(:name="isApproved ? 'check' : 'schedule'" size="28px")
    .approval-step__hero-body
      .approval-step__hero-title
        | {{ isApproved ? $t('connectionAgreementStepper.approvalWaitingStep.statusConfirmed') : $t('connectionAgreementStepper.approvalWaitingStep.statusWaiting') }}
      .t-sm.t-muted {{ isApproved ? $t('connectionAgreementStepper.approvalWaitingStep.noteConfirmed') : $t('connectionAgreementStepper.approvalWaitingStep.noteWaiting') }}
    BaseButton(
      v-if="!isApproved"
      variant="secondary"
      size="sm"
      type="button"
      :loading="isChecking"
      @click="refreshStatus"
    ) {{ $t('connectionAgreementStepper.approvalWaitingStep.checkNow') }}

  ol.approval-step__stages
    li.approval-step__stage(
      v-for="(s, idx) in stages"
      :key="idx"
      :class="`approval-step__stage--${s.state}`"
    )
      .approval-step__stage-mark
        q-icon(v-if="s.state === 'done'" name="check" size="14px")
        q-icon(v-else-if="s.state === 'active'" name="schedule" size="14px")
        template(v-else) {{ idx + 1 }}
      .approval-step__stage-title {{ s.title }}
</template>

<style scoped>
.approval-step__hero {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--p-4);
  padding: var(--p-5);
  border-radius: var(--p-r-lg);
  background: var(--p-warn-soft);
}
.approval-step__hero--done {
  background: var(--p-pos-soft);
}
.approval-step__icon {
  position: relative;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--p-surface);
  color: var(--p-warn);
}
.approval-step__hero--done .approval-step__icon {
  color: var(--p-pos);
}
/* Мягкая пульсация, пока ждём совет: заявка жива, страница следит сама. */
.approval-step__hero:not(.approval-step__hero--done) .approval-step__icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid var(--p-warn);
  animation: approval-step-pulse 2.4s ease-out infinite;
}
@keyframes approval-step-pulse {
  from { transform: scale(1); opacity: 0.6; }
  to { transform: scale(1.45); opacity: 0; }
}
.approval-step__hero-body {
  flex: 1 1 240px;
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
}
.approval-step__hero-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.approval-step__stages {
  list-style: none;
  margin: var(--p-6) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.approval-step__stage {
  display: grid;
  grid-template-columns: 24px 1fr;
  gap: var(--p-3);
  align-items: center;
  color: var(--p-ink-3);
}
.approval-step__stage--done,
.approval-step__stage--active {
  color: var(--p-ink);
}
.approval-step__stage-mark {
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
.approval-step__stage--active .approval-step__stage-mark {
  border-color: var(--p-warn);
  color: var(--p-warn);
}
.approval-step__stage--done .approval-step__stage-mark {
  background: var(--p-primary);
  border-color: var(--p-primary);
  color: var(--p-ink-on-primary);
}
.approval-step__stage-title {
  font-size: var(--p-fs-body);
}
.approval-step__stage--active .approval-step__stage-title {
  font-weight: 600;
}
</style>
