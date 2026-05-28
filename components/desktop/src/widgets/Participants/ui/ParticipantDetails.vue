<template lang="pug">
//- Развёрнутая строка пайщика — только его данные.
//- Документы пайщика живут в отдельном «Реестре документов», здесь не дублируются.
.participant-details
  EditableIndividualCard(
    v-if="individualParticipantData"
    :participantData="individualParticipantData"
    @update="onUpdate"
  )
  EditableEntrepreneurCard(
    v-if="entrepreneurParticipantData"
    :participantData="entrepreneurParticipantData"
    @update="onUpdate"
  )
  EditableOrganizationCard(
    v-if="organizationParticipantData"
    :participantData="organizationParticipantData"
    @update="onUpdate"
  )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EditableEntrepreneurCard } from 'src/shared/ui/EditableEntrepreneurCard'
import { EditableIndividualCard } from 'src/shared/ui/EditableIndividualCard'
import { EditableOrganizationCard } from 'src/shared/ui/EditableOrganizationCard'
import {
  AccountTypes,
  type IAccount,
  type IIndividualData,
  type IOrganizationData,
  type IEntrepreneurData
} from 'src/entities/Account/types'

// Props
const props = defineProps<{
  participant: IAccount
}>()

// Emits
const emit = defineEmits<{
  (e: 'update', newData: IIndividualData | IOrganizationData | IEntrepreneurData): void
}>()

const individualParticipantData = computed((): IIndividualData | null => {
  const pa = props.participant.private_account
  if (pa?.type !== AccountTypes.individual) return null
  return pa.individual_data ?? null
})

const entrepreneurParticipantData = computed((): IEntrepreneurData | null => {
  const pa = props.participant.private_account
  if (pa?.type !== AccountTypes.entrepreneur) return null
  return pa.entrepreneur_data ?? null
})

const organizationParticipantData = computed((): IOrganizationData | null => {
  const pa = props.participant.private_account
  if (pa?.type !== AccountTypes.organization) return null
  return pa.organization_data ?? null
})

// События
const onUpdate = (newData: IIndividualData | IOrganizationData | IEntrepreneurData) => {
  emit('update', newData)
}
</script>

<style lang="scss" scoped>
/* Развёрнутые данные пайщика — спокойная вложенная панель с дыханием между полями */
.participant-details {
  padding: var(--p-5, 20px) var(--p-6, 24px);
  background: var(--p-surface-2);
}

/* Форму держим читаемой шириной, не растягиваем на весь экран */
.participant-details :deep(.q-form) {
  max-width: 640px;
}

/* Вертикальный ритм между полями ввода */
.participant-details :deep(.q-field) {
  margin-bottom: var(--p-2, 8px);
}
</style>
