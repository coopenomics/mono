<template lang="pug">
.domain-card
  BaseCard
    //- Адрес — самое крупное на странице: это «шильдик» кооператива, по нему
    //- его находят пайщики. Поэтому название карточки уходит в eyebrow, а
    //- место заголовка занимает сам домен. Шапка BaseCard не используется:
    //- вне режима правки тело карточки было бы пустым и давало лишний отступ.
    .domain-card__top
      .domain-card__head
        .t-eyebrow.t-muted {{ $t('connectionDashboard.domainCard.addressEyebrow') }}
        .domain-card__host.t-mono(:class="{ 't-muted': isEditing }") {{ announce || '—' }}
      .domain-card__actions
        BaseBadge(:variant="delegationVariant") {{ delegationLabel }}
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
import { isSubdomain } from 'src/shared/lib/utils'
import { useSessionStore } from 'src/entities/Session'
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseInput,
} from 'src/shared/ui/base'
import { useProviderSubscriptions } from 'src/features/Provider/model'
import { t, t as i18nT } from 'src/shared/i18n';

const connectionAgreement = useConnectionAgreementStore()
const coop = useCooperativeStore()
const { updateCoop } = useUpdateCoop()
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
  if (!domainValue.value.trim()) {
    FailAlert(t('connectionDashboard.domainCard.domainEmptyError'))
    return
  }
  const subdomain = isSubdomain(domainValue.value)
  if (subdomain !== true) {
    FailAlert(subdomain)
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
      announce: domainValue.value.trim(),
      description: coop.publicCooperativeData.description,
    })
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
.domain-card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--p-4);
}
.domain-card__head {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.domain-card__host {
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  letter-spacing: var(--p-ls-h1);
  font-weight: 600;
  color: var(--p-ink);
  word-break: break-all;
}
.domain-card__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-shrink: 0;
}
.domain-card__edit-actions {
  display: flex;
  gap: var(--p-2);
  margin-top: var(--p-3);
}
.domain-card__top + * {
  margin-top: var(--p-4);
}
</style>
