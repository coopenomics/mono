<template lang="pug">
q-btn(
  v-if="!hasUserSentNotification && isAvailableForNotification"
  :loading="loading"
  color="primary"
  icon="note_add"
  :label="label"
  @click="handleSignNotification"
).q-mb-md.q-mt-md
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSignNotification } from '../model'
import { useSessionStore } from 'src/entities/Session'
import { useMeetStore } from 'src/entities/Meet'
import { Zeus } from '@coopenomics/sdk';
import { t } from 'src/shared/i18n';

const props = defineProps<{
  coopname: string
  meetHash: string
  label?: string
}>()

const session = useSessionStore()
const meetStore = useMeetStore()
const { signNotification, loading, hasUserSentNotification } = useSignNotification()

const username = computed(() => session.username)
const label = computed(() => props.label || t('meet.signNotificationButton.label'))

const isAvailableForNotification = computed(() => {
  const meet = meetStore.currentMeet
  if (!meet || !meet.processing || !meet.processing.extendedStatus) {
    return false
  }

  return meet.processing.extendedStatus === Zeus.ExtendedMeetStatus.WAITING_FOR_OPENING
})

// Загружаем данные о собрании, если они еще не загружены
const loadMeetData = async () => {
  if (!meetStore.currentMeet || meetStore.currentMeet.hash !== props.meetHash) {
    await meetStore.loadMeet({
      coopname: props.coopname,
      hash: props.meetHash
    })
  }
}

// Загружаем данные при создании компонента
loadMeetData()

const handleSignNotification = async () => {
  await signNotification({
    coopname: props.coopname,
    meet_hash: props.meetHash,
    username: username.value
  })
}
</script>
