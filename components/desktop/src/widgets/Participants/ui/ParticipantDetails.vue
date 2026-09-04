<template lang="pug">
//- Развёрнутая строка пайщика — только его данные.
//- Документы пайщика живут в отдельном «Реестре документов», здесь не дублируются.
.participant-details
  .participant-details__verification
    .participant-details__verification-title.t-sm.t-muted Верификация личности
    template(v-if='currentLevel')
      .participant-details__verification-row
        BaseBadge(:variant='verificationBadgeVariant(currentLevel.type)') {{ currentLevel.short }}
        span {{ currentLevel.label }}
        span.t-sm.t-muted(v-if='currentLevel.hint') {{ currentLevel.hint }}
      //- Пройденные ступени — без бейджей: бейдж показывает, где пайщик сейчас,
      //- а это подписи к тому, чем каждая ступень подтверждена.
      .participant-details__verification-step(
        v-for='level in passedLevels',
        :key='level.type'
      ) {{ level.label }}{{ level.hint ? ` — ${level.hint}` : '' }}
    .participant-details__verification-row(v-else)
      BaseBadge(variant='neutral') Не верифицирован
      span.t-sm.t-muted Личность подтверждает председатель совета или кооперативный участок при предъявлении паспорта
    VerifyIdentityActions(
      :participant='participant',
      @changed='emit("verification-changed")'
    )

  //- Второй фактор входа: председатель снимает приложение-аутентификатор
  //- пайщику, потерявшему устройство с кодами.
  ResetTwoFactorAction(:participant='participant')

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
import { BaseBadge } from 'src/shared/ui/base/BaseBadge'
import {
  highestVerificationLevel,
  participantVerificationView,
  verificationBadgeVariant,
  type VerificationNaming,
} from 'src/shared/lib/verification'
import { VerifyIdentityActions } from 'src/features/User/VerifyIdentity'
import { ResetTwoFactorAction } from 'src/features/User/ResetTwoFactor'
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
  /** Как называть верификатора и участок в подписи уровня. */
  naming?: VerificationNaming
}>()

// Emits
const emit = defineEmits<{
  (e: 'update', newData: IIndividualData | IOrganizationData | IEntrepreneurData): void
  (e: 'verification-changed'): void
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

// Уровни верификации пайщика — единый маппинг из @coopenomics/auth.
const verificationLevels = computed(() => participantVerificationView(props.participant, props.naming))

// Бейдж один — текущая ступень; остальные достигнутые уходят подписями ниже.
const currentLevel = computed(() => highestVerificationLevel(verificationLevels.value))
const passedLevels = computed(() =>
  verificationLevels.value.filter((level) => level.type !== currentLevel.value?.type),
)

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

.participant-details__verification {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  margin-bottom: var(--p-4);
  padding-bottom: var(--p-4);
  border-bottom: 1px solid var(--p-line);
}

.participant-details__verification-row {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
}

/* Пройденная ступень — подпись под текущей, с отступом под ширину бейджа. */
.participant-details__verification-step {
  padding-left: var(--p-6);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-3);
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
