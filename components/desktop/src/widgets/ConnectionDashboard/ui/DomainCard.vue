<template lang="pug">
.domain-card
  ColorCard(color='blue', @click.stop)
    // Заголовок
    .domain-header
      .domain-title
        q-icon(name="domain" size="20px").q-mr-sm
        | {{ $t('connectionDashboard.domainCard.title') }}

      // Отображение или редактирование домена
      .domain-display
        .flex.items-center
          .domain-text.full-width
            template(v-if="!isEditing")
              div.q-pa-md.text-h6.q-mr-sm {{ coop.publicCooperativeData?.announce || '—' }}
                q-btn(
                  flat
                  round
                  icon="edit"
                  size="sm"
                  color="primary"
                  @click="startEdit"
                )
                  q-tooltip {{ $t('connectionDashboard.domainCard.editTooltip') }}
            div(v-else).q-pa-sm
              .domain-warning.q-mb-md.full-width
                .text-caption.text-orange-8.q-mb-sm
                  | {{ $t('connectionDashboard.domainCard.delegateWarningLine1', { serverIp: SERVER_IP }) }}
                  | {{ $t('connectionDashboard.domainCard.delegateWarningLine2') }}
                  | {{ $t('connectionDashboard.domainCard.delegateWarningLine3') }}

              q-input(
                v-model="domainValue"
                :placeholder="$t('connectionDashboard.domainCard.domainPlaceholder')"
                outlined
                dense
                autofocus
                @keyup.enter="saveDomain"
                @keyup.escape="cancelEdit"
                :rules="[(val) => !!val || $t('connectionDashboard.domainCard.domainRequired')]"
              ).full-width.q-mt-md
                template(#prepend)
                  q-btn(
                    flat
                    round
                    icon="close"
                    size="sm"
                    color="negative"
                    @click="cancelEdit"
                  )
                    q-tooltip {{ $t('connectionDashboard.domainCard.cancelTooltip') }}
                template(#append)
                  q-btn(
                    flat
                    round
                    icon="check"
                    size="sm"
                    color="positive"
                    @click="saveDomain"
                  )
                    q-tooltip {{ $t('common.action.save') }}


      .row
        //- .col-6
          //- .text-caption.text-grey-7 Членство в союзе
          //- .text-body2.text-weight-medium
          //-   q-chip(
          //-     :color="getMembershipStatusColor"
          //-     outline
          //-     size="sm"
          //-   ) {{ getMembershipStatusLabel }}
        .col-6
          .text-caption.text-grey-7 {{ $t('connectionDashboard.domainCard.delegatedLabel') }}
          .text-body2.text-weight-medium
            q-chip(
              :color="isDelegatingLoading ? 'grey' : (instance?.is_delegated ? 'positive' : 'grey')"
              outline
              size="sm"
            )
              template(v-if="isDelegatingLoading")
                q-spinner(color="white" size="16px")
              template(v-else)
                q-icon(
                  v-if="!instance?.is_delegated"
                  name="refresh"
                  size="14px"
                  class="q-ml-xs rotating-icon"
                  color="grey-5"
                )
                span {{ instance?.is_delegated ? $t('common.answer.yes') : $t('connectionDashboard.domainCard.updatingStatus') }}

</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { useUpdateCoop } from 'src/features/Cooperative/UpdateCoop'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import { ColorCard } from 'src/shared/ui'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { t } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()

const coop = useCooperativeStore()
const { updateCoop } = useUpdateCoop()
const session = useSessionStore()
const { SERVER_IP } = useProviderSubscriptions()
// Получаем instance напрямую из store
const instance = computed(() => connectionAgreement.currentInstance)

// Цвет статуса членства
// const getMembershipStatusColor = computed(() => {
//   if (instance.value?.blockchain_status === 'active') return 'positive'
//   if (instance.value?.blockchain_status === 'pending') return 'warning'
//   if (instance.value?.blockchain_status === 'blocked') return 'negative'
//   return 'grey'
// })

// // Метка статуса членства
// const getMembershipStatusLabel = computed(() => {
//   if (instance.value?.blockchain_status === 'active') return 'Активно'
//   if (instance.value?.blockchain_status === 'pending') return 'Ожидает подтверждения'
//   if (instance.value?.blockchain_status === 'blocked') return 'Заблокировано'
//   return 'Неизвестно'
// })

// Состояние редактирования домена
const isEditing = ref(false)
const domainValue = ref('')
const isDelegatingLoading = ref(false)

// Загружаем данные кооператива при монтировании
coop.loadPublicCooperativeData(session.username)

// Синхронизируем значение домена при изменении данных кооператива
watch(() => coop?.publicCooperativeData?.announce, (newAnnounce) => {
  if (newAnnounce && !isEditing.value) {
    domainValue.value = newAnnounce
  }
}, { immediate: true })

// Начать редактирование
const startEdit = () => {
  isEditing.value = true
  domainValue.value = coop?.publicCooperativeData?.announce || ''
}

// Отменить редактирование
const cancelEdit = () => {
  isEditing.value = false
  domainValue.value = coop?.publicCooperativeData?.announce || ''
}

// Сохранить домен
const saveDomain = async () => {
  if (!domainValue.value.trim()) {
    FailAlert(t('connectionDashboard.domainCard.domainEmptyError'))
    return
  }

  if (!coop.publicCooperativeData) {
    FailAlert(t('connectionDashboard.domainCard.coopDataError'))
    return
  }

  try {
    isDelegatingLoading.value = true

    await updateCoop({
      coopname: session.username,
      username: session.username,
      initial: coop.publicCooperativeData.initial,
      minimum: coop.publicCooperativeData.minimum,
      org_initial: coop.publicCooperativeData.org_initial,
      org_minimum: coop.publicCooperativeData.org_minimum,
      announce: domainValue.value.trim(), // Обновляем announce (домен)
      description: coop.publicCooperativeData.description
    })

    // Перезагружаем данные
    await coop.loadPublicCooperativeData(session.username)
    await connectionAgreement.loadCurrentInstance()

    isEditing.value = false
    SuccessAlert(t('connectionDashboard.domainCard.domainUpdateSuccess'))
  } catch (error: any) {
    FailAlert(t('connectionDashboard.domainCard.domainUpdateError', { errorMessage: error.message }))
  } finally {
    isDelegatingLoading.value = false
  }
}
</script>

<style lang="scss" scoped>
.domain-card {
  padding: 8px;

  // Переопределяем отступ ColorCard только для этого виджета
  :deep(.color-card) {
    margin-bottom: 0 !important;
  }

  .domain-header {
    margin-bottom: 12px;

    .domain-title {
      display: flex;
      align-items: center;
      font-size: 14px;
      font-weight: 600;
    }
  }

  .domain-display {
    .domain-text {
      display: flex;
      align-items: center;

      .text-h6 {
        margin-right: 8px;
      }
    }
  }

  // Анимация вращения иконки обновления
  .rotating-icon {
    animation: rotate 2s linear infinite;
  }

  @keyframes rotate {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
}
</style>
