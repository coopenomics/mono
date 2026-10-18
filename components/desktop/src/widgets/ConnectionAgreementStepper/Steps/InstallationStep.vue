<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
const instance = computed(() => connectionAgreement.currentInstance)

// Вехи провайдера: 30% — плейбук отправлен, 85% — плейбук отработал. Между
// ними идёт почти вся установка, а веха стоит на месте, поэтому внутри
// диапазона процент считается по доле выполненных задач Ansible. Общее число
// задач провайдер берёт из прошлой успешной установки; до вехи 85% полоса не
// доходит, даже если прогон длиннее эталона.
const PLAYBOOK_FROM = 30
const PLAYBOOK_TO = 85

const progress = computed(() => {
  const milestone = Math.max(0, Math.min(100, instance.value?.progress || 0))
  const step = instance.value?.playbook_step ?? 0
  const total = instance.value?.playbook_total_steps ?? 0
  if (milestone < PLAYBOOK_FROM || milestone >= PLAYBOOK_TO || step <= 0 || total <= 0) return milestone
  const share = Math.min(step / total, 1)
  const withinPlaybook = Math.floor(PLAYBOOK_FROM + (PLAYBOOK_TO - PLAYBOOK_FROM) * share)
  return Math.max(milestone, Math.min(withinPlaybook, PLAYBOOK_TO - 1))
})

/**
 * Возврат в строй отличается от первой установки: платформа разворачивается
 * заново, но данные кооператива никуда не делись — они лежат в резервной
 * копии, снятой перед отключением сервера, и вернутся в конце цикла. Об этом
 * нужно сказать прямо: тот же экран с заголовком «устанавливаем» читается как
 * «всё начинается с чистого листа».
 */
const isRestoring = computed(() => instance.value?.is_restoring === true)

const INSTALL_STAGES = [
  { from: 0, title: t('connectionAgreementStepper.installationStep.install.server.title'), body: t('connectionAgreementStepper.installationStep.install.server.body') },
  { from: 20, title: t('connectionAgreementStepper.installationStep.install.platform.title'), body: t('connectionAgreementStepper.installationStep.install.platform.body') },
  { from: 40, title: t('connectionAgreementStepper.installationStep.install.storage.title'), body: t('connectionAgreementStepper.installationStep.install.storage.body') },
  { from: 60, title: t('connectionAgreementStepper.installationStep.install.chain.title'), body: t('connectionAgreementStepper.installationStep.install.chain.body') },
  { from: 80, title: t('connectionAgreementStepper.installationStep.install.finish.title'), body: t('connectionAgreementStepper.installationStep.install.finish.body') },
]

const RESTORE_STAGES = [
  { from: 0, title: t('connectionAgreementStepper.installationStep.restore.server.title'), body: t('connectionAgreementStepper.installationStep.restore.server.body') },
  { from: 20, title: t('connectionAgreementStepper.installationStep.restore.platform.title'), body: t('connectionAgreementStepper.installationStep.restore.platform.body') },
  { from: 40, title: t('connectionAgreementStepper.installationStep.restore.storage.title'), body: t('connectionAgreementStepper.installationStep.restore.storage.body') },
  { from: 60, title: t('connectionAgreementStepper.installationStep.restore.chain.title'), body: t('connectionAgreementStepper.installationStep.restore.chain.body') },
  {
    from: 80,
    title: t('connectionAgreementStepper.installationStep.restore.data.title'),
    body: t('connectionAgreementStepper.installationStep.restore.data.body'),
  },
]

const stages = computed(() => (isRestoring.value ? RESTORE_STAGES : INSTALL_STAGES))

const title = computed(() =>
  isRestoring.value ? t('connectionAgreementStepper.installationStep.restoreTitle') : t('connectionAgreementStepper.installationStep.installTitle'),
)

const lead = computed(() =>
  isRestoring.value
    ? t('connectionAgreementStepper.installationStep.restoreLeadLine1') +
      t('connectionAgreementStepper.installationStep.restoreLeadLine2') +
      t('connectionAgreementStepper.installationStep.restoreLeadLine3')
    : t('connectionAgreementStepper.installationStep.installLeadLine1') +
      t('connectionAgreementStepper.installationStep.installLeadLine2'),
)

const stageIndex = computed(() => {
  let i = 0
  stages.value.forEach((s, idx) => { if (progress.value >= s.from) i = idx })
  return i
})

// Заливка — верхний слой той же ширины, что и полоса, обрезанный по проценту:
// число в центре полосы читается и на заливке, и на пустой части.
const fillClip = computed(() => `inset(0 ${100 - progress.value}% 0 0)`)
</script>

<template lang="pug">
StepFrame(
  :title="title"
  :lead="lead"
  :can-back="false"
  :has-next="false"
)
  .installation-step__bar(
    role="progressbar"
    :aria-label="$t('connectionAgreementStepper.installationStep.progressAria')"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-valuenow="progress"
  )
    span.installation-step__pct.t-num {{ progress }}%
    .installation-step__bar-fill(:style="{ clipPath: fillClip }")
      span.installation-step__pct.t-num {{ progress }}%

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
.installation-step__bar {
  position: relative;
  height: var(--p-7);
  border-radius: var(--p-r-pill);
  background: var(--p-surface-3);
  overflow: hidden;
}
.installation-step__bar-fill {
  position: absolute;
  inset: 0;
  background: var(--p-primary);
  color: var(--p-ink-on-primary);
  transition: clip-path var(--p-dur-slow) var(--p-ease-standard);
}
.installation-step__pct {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.installation-step__bar-fill .installation-step__pct {
  color: var(--p-ink-on-primary);
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
