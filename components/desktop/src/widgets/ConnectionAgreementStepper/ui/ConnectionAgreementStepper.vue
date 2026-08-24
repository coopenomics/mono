<script setup lang="ts">
import { onMounted, computed, watch } from 'vue'
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper'
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper'
import UnionMembershipStep from '../Steps/UnionMembershipStep.vue'
import IntroStep from '../Steps/IntroStep.vue'
import CooperativeProfileStep from '../Steps/CooperativeProfileStep.vue'
import DomainStep from '../Steps/DomainStep.vue'
import FinancialParamsStep from '../Steps/FinancialParamsStep.vue'
import AgreementStep from '../Steps/AgreementStep.vue'
import DomainValidationStep from '../Steps/DomainValidationStep.vue'
import ApprovalWaitingStep from '../Steps/ApprovalWaitingStep.vue'
import InstallationStep from '../Steps/InstallationStep.vue'
import {
  useConnectionAgreementStore,
  CONNECTION_STEP,
  isTariffChoiceAvailable,
} from 'src/entities/ConnectionAgreement'
import { useSystemStore } from 'src/entities/System/model'
import { useConnectionCatalog } from 'src/features/Provider/model'

const connectionAgreement = useConnectionAgreementStore()
// Живой каталог провайдера (Epic 28): «от N ₽» и триал в сводке условий.
const { minPriceLabel, trialDays, load: loadCatalog } = useConnectionCatalog()
onMounted(() => { void loadCatalog() })
const system = useSystemStore()

const currentStep = computed(() => connectionAgreement.currentStep)
const selectedTariff = computed(() => connectionAgreement.selectedTariff)
const document = computed(() => connectionAgreement.document)

const html = computed(() => document.value?.data?.html)

// Полный реестр шагов в порядке прохождения. Индекс шага берётся из
// CONNECTION_STEP — там же его читают страница и сами шаги, чтобы числа не
// разъезжались при появлении и скрытии шагов.
// Подпись под шагом — в одну строку, о чём шаг: подробное объяснение живёт
// в самой карточке шага.
const ALL_STEPS: Array<StepperStep & { index: number }> = [
  { key: 'union', index: CONNECTION_STEP.union, label: 'Членство в союзе', description: 'Аккаунт для связи с союзом' },
  { key: 'intro', index: CONNECTION_STEP.intro, label: 'Тариф', description: 'Ежемесячная плата за обслуживание' },
  { key: 'profile', index: CONNECTION_STEP.profile, label: 'О кооперативе', description: 'Рассказ о деятельности и устав' },
  { key: 'domain', index: CONNECTION_STEP.domain, label: 'Адрес кооператива', description: 'Домен, на котором будет работать платформа' },
  { key: 'financial', index: CONNECTION_STEP.financial, label: 'Взносы при вступлении', description: 'Вступительный и минимальный паевой' },
  { key: 'agreement', index: CONNECTION_STEP.agreement, label: 'Соглашение', description: 'Прочитать и подписать ключом' },
  { key: 'dns', index: CONNECTION_STEP.dns, label: 'Настройка домена', description: 'Одна DNS-запись у регистратора' },
  { key: 'approval', index: CONNECTION_STEP.approval, label: 'Подтверждение совета', description: 'Ничего делать не нужно' },
  { key: 'installation', index: CONNECTION_STEP.installation, label: 'Установка', description: 'Провайдер разворачивает платформу' },
]

// Шаг союза нужен только его членам, шаг тарифа — только когда есть из чего
// выбирать. Единственный тариф назначается молча ниже, и мастер начинается
// сразу с домена.
const visibleSteps = computed(() =>
  ALL_STEPS.filter((s) => {
    if (s.key === 'union') return system.info.is_unioned
    if (s.key === 'intro') return isTariffChoiceAvailable
    return true
  }),
)

const stepperSteps = computed<StepperStep[]>(() =>
  visibleSteps.value.map(({ key, label, description }) => ({ key, label, description })),
)

const activeKey = computed(() => {
  const found = visibleSteps.value.find((s) => s.index === currentStep.value)
  return found?.key ?? visibleSteps.value[0]?.key ?? 'intro'
})

const completedKeys = computed(() =>
  visibleSteps.value.filter((s) => s.index < currentStep.value).map((s) => s.key),
)

const stepNumber = computed(() => visibleSteps.value.findIndex((s) => s.key === activeKey.value) + 1)

function onStepperChange(key: string) {
  const found = ALL_STEPS.find((s) => s.key === key)
  if (!found) return
  if (found.index >= currentStep.value) return
  connectionAgreement.setCurrentStep(found.index)
}

// Тариф хранится в состоянии подключения независимо от того, показывали ли
// экран выбора: соглашение и последующие шаги читают его оттуда.

watch(
  () => currentStep.value,
  async (newStep, oldStep) => {
    if (newStep === CONNECTION_STEP.agreement && oldStep !== CONNECTION_STEP.agreement) {
      try {
        await connectionAgreement.generateDocument()
      } catch (error) {
        console.error('Ошибка генерации документа:', error)
      }
    }
  },
)
</script>

<template lang="pug">
.connection-stepper.row.q-col-gutter-lg
  //- Слева — карта пути: что уже пройдено, где мы, что впереди. Здесь же
  //- вводное слово, чтобы новый пользователь понял, зачем всё это.
  aside.col-12.col-md-4.col-lg-3
    .connection-stepper__rail
      p.t-sm.connection-stepper__intro
        | После подключения у кооператива появится собственная копия платформы —
        | такая же, в какой вы работаете сейчас, — на вашем домене.

      //- Условия — коротко и на виду, чтобы их не приходилось искать по шагам.
      dl.connection-stepper__terms
        .connection-stepper__term
          dt Стоимость
          dd
            | от 
            span.t-mono.t-num {{ minPriceLabel ?? '…' }}
            |  в месяц
          //- Из чего складывается сверх минимума — по факту работы кооператива.
          ul.connection-stepper__breakdown
            li ≈20 ₽ — новый пайщик
            li ≈10 ₽ — пакет документов
        .connection-stepper__term(v-if="trialDays")
          dt Первые {{ trialDays }} дней
          dd бесплатно
        .connection-stepper__term
          dt Оплата
          dd членским взносом с кошелька кооператива — этого аккаунта
      .t-eyebrow.t-muted.connection-stepper__counter Шаг {{ stepNumber }} из {{ visibleSteps.length }}
      VerticalStepper(
        :steps="stepperSteps"
        :active-key="activeKey"
        :completed="completedKeys"
        @change="onStepperChange"
      )

  .col-12.col-md-8.col-lg-9
    .connection-stepper__content(:key="activeKey")
      UnionMembershipStep(v-if="activeKey === 'union'")
        template(#registration)
          slot(name="union-registration")
      IntroStep(
        v-else-if="activeKey === 'intro'"
        :selected-tariff="selectedTariff"
      )
      CooperativeProfileStep(v-else-if="activeKey === 'profile'")
      DomainStep(v-else-if="activeKey === 'domain'")
      FinancialParamsStep(v-else-if="activeKey === 'financial'")
      AgreementStep(
        v-else-if="activeKey === 'agreement'"
        :html="html"
      )
      DomainValidationStep(v-else-if="activeKey === 'dns'")
      ApprovalWaitingStep(v-else-if="activeKey === 'approval'")
      InstallationStep(v-else-if="activeKey === 'installation'")
</template>

<style scoped>
.connection-stepper {
  padding: var(--p-4);
}
/* Навигация остаётся на экране, пока длинный шаг (соглашение) прокручивается. */
.connection-stepper__rail {
  position: sticky;
  top: var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.connection-stepper__intro {
  margin: 0;
  color: var(--p-ink-1);
}
.connection-stepper__terms {
  margin: 0;
  padding: var(--p-3) var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
}
.connection-stepper__term dt {
  font-size: var(--p-fs-meta);
  color: var(--p-ink-2);
}
.connection-stepper__breakdown {
  margin: var(--p-1) 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: var(--p-fs-meta);
  line-height: var(--p-lh-meta);
  color: var(--p-ink-2);
}
.connection-stepper__term dd {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink);
  font-weight: 500;
}
.connection-stepper__counter {
  margin: 0;
}
</style>
