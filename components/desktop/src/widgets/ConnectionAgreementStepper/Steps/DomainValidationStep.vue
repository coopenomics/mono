<template lang="pug">
  q-step(
    :name="4"
    :title="$t('connectionAgreementStepper.domainValidationStep.title')"
    icon="domain"
    :done="isDone"
  )
    .domain-validation-container.q-pa-md

      //- Основная инструкция
      .dns-instruction-card.q-mb-xl
        .instruction-header
          .text-subtitle2.instruction-title {{ $t('connectionAgreementStepper.domainValidationStep.dnsInstructionTitle') }}

        //- Краткая инструкция
        .instruction-intro.q-mb-lg
          .text-body1.text-grey-8
            | {{ $t('connectionAgreementStepper.domainValidationStep.dnsInstructionIntro') }}


        .row.q-mb-md.justify-center
          .col-md-6.col-xs-12.q-pa-sm
              .dns-record-item
                .record-label {{ $t('connectionAgreementStepper.domainValidationStep.domainLabel') }}
                .record-value {{ coop?.announce }}

          .col-md-6.col-xs-12.q-pa-sm
            .dns-record-item
              .record-label {{ $t('connectionAgreementStepper.domainValidationStep.addressLabel') }}
              .record-value.record-highlight
                | {{ SERVER_IP }}

                q-btn.copy-ip-btn(
                  size="sm"
                  flat
                  round
                  dense
                  icon="content_copy"
                  @click="copyIpAddress"
                )
                  q-tooltip {{ $t('connectionAgreementStepper.domainValidationStep.copyIpTooltip') }}

        .instruction-separator

        .status-chips.row.justify-center.q-mb-md
          .chip-wrapper(v-if="instance?.is_valid")
            q-chip.status-chip(
              :class="{ 'delegated': instance?.is_delegated, 'waiting': !instance?.is_delegated }"
              text-color="white"
              size="md"
              clickable
              @click="handleReload"
            )
              q-spinner(size="16px" color="white")
              span.q-ml-xs {{ instance?.is_delegated ? $t('connectionAgreementStepper.domainValidationStep.delegatedStatus') : $t('connectionAgreementStepper.domainValidationStep.pendingDelegationStatus') }}

        .instruction-footer
          | {{ $t('connectionAgreementStepper.domainValidationStep.footerNote') }}

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
import { computed, onMounted } from 'vue'
import { copyToClipboard } from 'quasar'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import type { IStepProps } from '../model/types'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { t } from 'src/shared/i18n';

const props = withDefaults(defineProps<IStepProps>(), {})

const connectionAgreement = useConnectionAgreementStore()
const { loadCurrentInstance } = connectionAgreement
const { SERVER_IP } = useProviderSubscriptions()

// Получаем данные напрямую из store
const coop = computed(() => connectionAgreement.coop)
const instance = computed(() => connectionAgreement.currentInstance)

// Загружаем кооператива при монтировании, если его нет в store
const loadCoopIfNeeded = async () => {
  if (!coop.value) {
    try {
      await connectionAgreement.reloadCooperative()
    } catch (error) {
      console.error('Ошибка загрузки кооператива:', error)
    }
  }
}

onMounted(async () => {
  await loadCoopIfNeeded()
})

const isDone = computed(() => props.isDone)


const handleBack = () => {
  connectionAgreement.setCurrentStep(2)
}

const handleReload = async () => {
  try {
    await loadCurrentInstance()
  } catch (error) {
    console.error('Ошибка обновления инстанса:', error)
  }
}

const copyIpAddress = async () => {
  try {
    await copyToClipboard(SERVER_IP)
    SuccessAlert(t('connectionAgreementStepper.domainValidationStep.ipCopiedSuccess'))
  } catch (error) {
    console.error('Ошибка копирования:', error)
    FailAlert(t('connectionAgreementStepper.domainValidationStep.ipCopyError'))
  }
}
</script>

<style scoped>
.domain-validation-container {
  max-width: 800px;
  margin: 0 auto;
  position: relative;
}

/* Статус чипы */
.status-header {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 2rem;
}

.status-chips {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.chip-wrapper {
  position: relative;
}

.status-chip {
  border-radius: 20px;
  font-weight: 500;
  letter-spacing: 0.5px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  backdrop-filter: blur(10px);
}

.status-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.status-chip.valid {
  background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.status-chip.warning {
  background: linear-gradient(135deg, #FF9800 0%, #f57c00 100%);
  border: 1px solid rgba(255, 152, 0, 0.2);
}

.status-chip.delegated {
  background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
  border: 1px solid rgba(33, 150, 243, 0.2);
}

.status-chip.waiting {
  background: linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%);
  border: 1px solid rgba(156, 39, 176, 0.2);
}

/* DNS инструкция */
.dns-instruction-card {
  border-radius: 16px;
  padding: 2rem;
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.dns-instruction-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #2196F3 0%, #21CBF3 50%, #2196F3 100%);
  background-size: 200% 100%;
  animation: shimmer 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

@keyframes shimmer {
  0% { background-position: -100% 0; }
  100% { background-position: 100% 0; }
}

.instruction-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.instruction-intro {
  text-align: center;
  padding: 1rem 1.5rem;
  border-radius: 12px;
}

.instruction-title {
  font-weight: 600;
  letter-spacing: 0.5px;
  position: relative;
  display: inline-block;
}

.instruction-title::after {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 40px;
  height: 2px;
  border-radius: 1px;
}

/* DNS записи */
.dns-record-item {
  text-align: center;
  padding: 0.75rem;
  border-radius: 12px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
}

.dns-record-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 0, 0, 0.1);
}

/* Кнопка копирования IP */
.copy-ip-btn {
  position: absolute;
  top: 6px;
  right: 6px;
  opacity: 0;
  transition: opacity 0.3s ease;
  border-radius: 50% !important;
}

.record-highlight:hover .copy-ip-btn {
  opacity: 1;
}

.record-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  margin-bottom: 0.5rem;
}

.record-value {
  font-size: 0.95rem;
  font-weight: 600;
  word-break: break-all;
}

.record-highlight {
  font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

/* Разделитель */
.instruction-separator {
  height: 1px;
  margin: 2rem 0;
  position: relative;
}

.instruction-separator::before {
  content: '';
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

/* Футер инструкции */
.instruction-footer {
  text-align: center;
  font-size: 0.875rem;
  line-height: 1.5;
  font-weight: 400;
}


/* Адаптивность */
@media (max-width: 768px) {
  .dns-record-item {
    padding: 0.5rem;
  }

  .status-chips {
    flex-direction: column;
    gap: 0.75rem;
  }

  .dns-instruction-card {
    padding: 1.5rem;
  }

  .instruction-intro {
    padding: 0.75rem 1rem;
  }
}

@media (max-width: 480px) {
  .domain-validation-container {
    padding: 1rem;
  }

  .dns-instruction-card {
    padding: 1rem;
  }

  .instruction-title {
    font-size: 1rem;
  }

  .instruction-intro {
    padding: 0.5rem 0.75rem;
  }

  .record-value {
    font-size: 0.9rem;
  }

  .copy-ip-btn {
    top: 4px;
    right: 4px;
  }
}

</style>
