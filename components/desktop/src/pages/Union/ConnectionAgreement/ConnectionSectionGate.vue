<template lang="pug">
//- Разделы подключения, которые живут отдельными пунктами меню («Подписки»,
//- «Узел»), имеют смысл только у подключённого кооператива. Пока установка
//- не завершена, страница ведёт на «Подключение», где идёт мастер.
.conn-gate
  WindowLoader(v-if="loading", :text="$t('union.connectionAgreementPage.loadingText')")
  slot(v-else-if="completed")
  BaseCard(v-else)
    EmptyState(
      :title="$t('union.connectionSectionGate.title')"
      :body="$t('union.connectionSectionGate.body')"
    )
      template(#icon)
        q-icon(name="link" size="28px")
      template(#action)
        BaseButton(variant="primary" type="button" @click="goToConnection") {{ $t('union.connectionSectionGate.action') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Zeus } from '@coopenomics/sdk'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base'
import { WindowLoader } from 'src/shared/ui/Loader'

const router = useRouter()
const route = useRoute()
const connectionAgreement = useConnectionAgreementStore()
const loading = ref(!connectionAgreement.currentInstance)

const completed = computed(() => {
  const instance = connectionAgreement.currentInstance
  return instance?.progress === 100 && instance?.status === Zeus.InstanceStatus.ACTIVE
})

// realtime: нет источника — состояние установки ведёт провайдер подключения (другой узел); его опрашивает страница «Подключение».
onMounted(async () => {
  if (!connectionAgreement.currentInstance) {
    try {
      await connectionAgreement.loadCurrentInstance()
    } finally {
      loading.value = false
    }
  }
})

const goToConnection = () => {
  void router.push({ name: 'connect', params: { coopname: route.params.coopname } })
}
</script>

<style scoped>
.conn-gate {
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
</style>
