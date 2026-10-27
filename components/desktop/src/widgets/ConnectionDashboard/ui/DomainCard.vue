<template lang="pug">
.domain-card
  BaseCard(
    :title="$t('connectionDashboard.domainCard.addressEyebrow')"
    :subtitle="$t('connectionDashboard.domainCard.subtitle')"
  )
    //- Действие — в шапке карточки (канон): менять адрес приходится редко.
    template(#actions)
      BaseButton(
        v-if="!isEditing"
        variant="secondary"
        size="sm"
        type="button"
        :aria-label="$t('connectionDashboard.domainCard.editAria')"
        @click="startEdit"
      )
        q-icon(name="edit" size="14px").q-mr-xs
        | {{ $t('connectionDashboard.domainCard.edit') }}

    template(v-if="!isEditing")
      DataRow(
        :label="$t('connectionDashboard.domainCard.domainRow')"
        :value="announce || '—'"
        mono
        copyable
        align="spread"
      )
      DataRow(:label="$t('connectionDashboard.domainCard.stateRow')" align="spread")
        template(#value-override)
          BaseBadge(:variant="delegationVariant") {{ delegationLabel }}

    template(v-if="isEditing")
      BaseBanner(variant="warn").q-mb-md
        | {{ $t('connectionDashboard.domainCard.cnameWarning', { host: CONNECTOR_HOST }) }}
        | {{ $t('connectionDashboard.domainCard.reloadWarning') }}

      BaseInput(
        v-model="domainValue"
        :label="$t('connectionDashboard.domainCard.domainLabel')"
        placeholder="example.coopenomics.world"
        mono
      )

      .domain-card__edit-actions
        BaseButton(
          variant="primary"
          size="sm"
          type="button"
          :loading="isDelegatingLoading"
          @click="saveDomain"
        )
          q-icon(name="check" size="14px").q-mr-xs
          | {{ $t('common.action.save') }}
        BaseButton(
          variant="ghost"
          size="sm"
          type="button"
          @click="cancelEdit"
        )
          q-icon(name="close" size="14px").q-mr-xs
          | {{ $t('connectionDashboard.domainCard.cancel') }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RegistratorContract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { useUpdateCoop } from 'src/features/Cooperative/UpdateCoop'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { isCoopDomain } from 'src/shared/lib/utils'
import { useSessionStore } from 'src/entities/Session'
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseInput,
} from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { t, t as i18nT } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
const coop = useCooperativeStore()
const { changeCoopDomain } = useUpdateCoop()
const session = useSessionStore()
const { CONNECTOR_HOST } = useProviderSubscriptions()
// Получаем instance напрямую из store
const instance = computed(() => connectionAgreement.currentInstance)

const isEditing = ref(false)
const domainValue = ref('')
const isDelegatingLoading = ref(false)

const announce = computed(() => coop.publicCooperativeData?.announce || '')

const delegationLabel = computed(() => {
  if (isDelegatingLoading.value) return i18nT('connectionDashboard.domainCard.delegationUpdating')
  return instance.value?.is_delegated ? i18nT('connectionDashboard.domainCard.delegationDone') : i18nT('connectionDashboard.domainCard.delegationWaiting')
})

const delegationVariant = computed(() => {
  if (isDelegatingLoading.value) return 'neutral'
  return instance.value?.is_delegated ? 'pos' : 'warn'
})

coop.loadPublicCooperativeData(session.username)

// Домен кооператива в реестре сети живёт по ленте; состояние сервера — у
// провайдера, его карточка читает при действиях.
useLiveReload([liveTable(RegistratorContract, RegistratorContract.Tables.Cooperatives)], () => coop.loadPublicCooperativeData(session.username))

watch(
  () => coop?.publicCooperativeData?.announce,
  (newAnnounce) => {
    if (newAnnounce && !isEditing.value) domainValue.value = newAnnounce
  },
  { immediate: true },
)

const startEdit = () => {
  isEditing.value = true
  domainValue.value = coop?.publicCooperativeData?.announce || ''
}

const cancelEdit = () => {
  isEditing.value = false
  domainValue.value = coop?.publicCooperativeData?.announce || ''
}

const saveDomain = async () => {
  const valid = isCoopDomain(domainValue.value)
  if (valid !== true) {
    FailAlert(valid)
    return
  }
  if (!coop.publicCooperativeData) {
    FailAlert(t('connectionDashboard.domainCard.coopDataError'))
    return
  }
  try {
    isDelegatingLoading.value = true
    await changeCoopDomain(coop.publicCooperativeData, domainValue.value)
    await coop.loadPublicCooperativeData(session.username)
    await connectionAgreement.loadCurrentInstance()
    isEditing.value = false
    SuccessAlert(i18nT('connectionDashboard.domainCard.domainUpdated'))
  } catch (error: any) {
    FailAlert(t('connectionDashboard.domainCard.domainUpdateError', { errorMessage: error.message }))
  } finally {
    isDelegatingLoading.value = false
  }
}
</script>

<style scoped>
.domain-card__edit-actions {
  display: flex;
  gap: var(--p-2);
  margin-top: var(--p-3);
}
</style>
