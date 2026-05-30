<template lang="pug">
.domain-card
  BaseCard(title="Подключение" subtitle="Доменное имя цифрового кооператива у провайдера")
    template(#actions)
      .domain-card__actions
        BaseChip(
          :variant="isDelegatingLoading ? 'neutral' : (instance?.is_delegated ? 'pos' : 'warn')"
          size="sm"
        )
          q-icon(v-if="isDelegatingLoading" name="autorenew" size="12px").q-mr-xs.domain-card__spin
          q-icon(v-else-if="instance?.is_delegated" name="check" size="12px").q-mr-xs
          q-icon(v-else name="schedule" size="12px").q-mr-xs
          span {{ delegationLabel }}
        BaseButton(
          v-if="!isEditing"
          variant="secondary"
          size="sm"
          type="button"
          aria-label="Изменить домен"
          @click="startEdit"
        )
          q-icon(name="edit" size="14px").q-mr-xs
          | Изменить

    template(v-if="!isEditing")
      .domain-card__view
        .domain-card__host.t-mono {{ coop.publicCooperativeData?.announce || '—' }}

    template(v-else)
      BaseBanner(variant="warn").q-mb-md
        | Убедитесь, что домен делегирован на IP {{ SERVER_IP }}.
        | Обновление перезагрузит цифровой кооператив; данные сохранятся.

      BaseInput(
        v-model="domainValue"
        label="Доменное имя"
        placeholder="example.coopenomics.world"
        mono
      )

      .domain-card__edit-actions.q-mt-sm
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
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseChip,
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

const delegationLabel = computed(() => {
  if (isDelegatingLoading.value) return 'обновляем'
  return instance.value?.is_delegated ? 'домен делегирован' : 'ожидание делегирования'
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
.domain-card__actions {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
.domain-card__view {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-2) 0;
}
.domain-card__host {
  font-size: var(--p-fs-h2);
  font-weight: 600;
  color: var(--p-ink);
  word-break: break-all;
  flex: 1;
}
.domain-card__edit-actions {
  display: flex;
  gap: var(--p-2);
}
.domain-card__spin {
  animation: domain-card-rotate 1.6s linear infinite;
}
@keyframes domain-card-rotate {
  to { transform: rotate(360deg); }
}
</style>
