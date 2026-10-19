<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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

// Вехи провайдера по порядку. Между соседними вехами, кроме плейбука, провайдер
// молчит минутами (аренда сервера, загрузка ОС), и полоса стояла бы на месте.
// Поэтому там она медленно ползёт к следующей вехе и замирает за процент до
// неё: следующую веху всё равно показывает только провайдер.
const MILESTONES = [0, 10, 20, 30, 85, 90, 95, 100]
const CREEP_TAU_MS = 90_000

const milestone = computed(() => Math.max(0, Math.min(100, instance.value?.progress || 0)))

const now = ref(Date.now())
const milestoneSince = ref(Date.now())
watch(milestone, () => { milestoneSince.value = Date.now() })
const ticker = setInterval(() => { now.value = Date.now() }, 2_000)
onBeforeUnmount(() => clearInterval(ticker))

const creep = (from: number) => {
  const next = MILESTONES.find((m) => m > from)
  if (next === undefined || next - from <= 1) return from
  const share = 1 - Math.exp(-(now.value - milestoneSince.value) / CREEP_TAU_MS)
  return Math.min(next - 1, from + Math.floor((next - 1 - from) * share))
}

const progress = computed(() => {
  const step = instance.value?.playbook_step ?? 0
  const total = instance.value?.playbook_total_steps ?? 0
  const inPlaybook = milestone.value >= PLAYBOOK_FROM && milestone.value < PLAYBOOK_TO
  if (!inPlaybook) return creep(milestone.value)
  if (step <= 0 || total <= 0) return milestone.value
  const share = Math.min(step / total, 1)
  const withinPlaybook = Math.floor(PLAYBOOK_FROM + (PLAYBOOK_TO - PLAYBOOK_FROM) * share)
  return Math.max(milestone.value, Math.min(withinPlaybook, PLAYBOOK_TO - 1))
})

/**
 * Возврат в строй отличается от первой установки: платформа разворачивается
 * заново, но данные кооператива никуда не делись — они лежат в резервной
 * копии, снятой перед отключением сервера, и вернутся в конце цикла. Об этом
 * нужно сказать прямо: тот же экран с заголовком «устанавливаем» читается как
 * «всё начинается с чистого листа».
 */
const isRestoring = computed(() => instance.value?.is_restoring === true)

// Этапы повторяют ход плейбука установки (HOSTKEY-INITIAL-SETUP): порог
// этапа — номер его первой задачи в эталонном прогоне из 362 задач,
// переведённый в проценты шага 30–85%. До 30% — аренда сервера, после 85% —
// провайдер проверяет, что платформа отвечает. Резервного копирования в
// установке нет: копии снимаются по расписанию уже работающего узла.
const stage = (key: string, from: number, scope = 'install') => ({
  from,
  title: t(`connectionAgreementStepper.installationStep.${scope}.${key}.title`),
  body: t(`connectionAgreementStepper.installationStep.${scope}.${key}.body`),
})

const PLATFORM_STAGES = [
  stage('system', 30),
  stage('chain', 44),
  stage('data', 54),
  stage('apps', 63),
  stage('domain', 67),
  stage('monitoring', 73),
]

const INSTALL_STAGES = [stage('server', 0), ...PLATFORM_STAGES, stage('check', 85)]

const RESTORE_STAGES = [stage('server', 0, 'restore'), ...PLATFORM_STAGES, stage('data', 85, 'restore')]

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
