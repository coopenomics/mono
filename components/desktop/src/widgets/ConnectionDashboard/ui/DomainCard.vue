<template lang="pug">
.domain-card
  BaseCard
    //- Адрес — самое крупное на странице: это «шильдик» кооператива, по нему
    //- его находят пайщики. Поэтому название карточки уходит в eyebrow, а
    //- место заголовка занимает сам домен. Шапка BaseCard не используется:
    //- вне режима правки тело карточки было бы пустым и давало лишний отступ.
    .domain-card__top
      .domain-card__head
        .t-eyebrow.t-muted Адрес кооператива
        .domain-card__host.t-mono(:class="{ 't-muted': isEditing }") {{ announce || '—' }}
      .domain-card__actions
        BaseBadge(:variant="delegationVariant") {{ delegationLabel }}
        BaseButton(
          v-if="!isEditing"
          variant="ghost"
          size="sm"
          type="button"
          aria-label="Изменить домен"
          @click="startEdit"
        )
          q-icon(name="edit" size="14px").q-mr-xs
          | Изменить

    template(v-if="isEditing")
      BaseBanner(variant="warn").q-mb-md
        | Убедитесь, что домен делегирован на IP {{ SERVER_IP }}.
        | Обновление перезагрузит цифровой кооператив; данные сохранятся.

      BaseInput(
        v-model="domainValue"
        label="Доменное имя"
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
          | Сохранить
        BaseButton(
          variant="ghost"
          size="sm"
          type="button"
          @click="cancelEdit"
        )
          q-icon(name="close" size="14px").q-mr-xs
          | Отменить
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { useUpdateCoop } from 'src/features/Cooperative/UpdateCoop'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { useSessionStore } from 'src/entities/Session'
import {
  BaseBadge,
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseInput,
} from 'src/shared/ui/base'
import { useProviderSubscriptions } from 'src/features/Provider/model'

const connectionAgreement = useConnectionAgreementStore()
const coop = useCooperativeStore()
const { updateCoop } = useUpdateCoop()
const session = useSessionStore()
const { SERVER_IP } = useProviderSubscriptions()
const instance = computed(() => connectionAgreement.currentInstance)

const isEditing = ref(false)
const domainValue = ref('')
const isDelegatingLoading = ref(false)

const announce = computed(() => coop.publicCooperativeData?.announce || '')

const delegationLabel = computed(() => {
  if (isDelegatingLoading.value) return 'обновляем'
  return instance.value?.is_delegated ? 'домен делегирован' : 'ожидание делегирования'
})

const delegationVariant = computed(() => {
  if (isDelegatingLoading.value) return 'neutral'
  return instance.value?.is_delegated ? 'pos' : 'warn'
})

coop.loadPublicCooperativeData(session.username)

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
    FailAlert('Домен не может быть пустым')
    return
  }
  if (!coop.publicCooperativeData) {
    FailAlert('Не удалось получить данные кооператива')
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
    SuccessAlert('Домен успешно обновлён')
  } catch (error: any) {
    FailAlert(`Ошибка при обновлении домена: ${error.message}`)
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
