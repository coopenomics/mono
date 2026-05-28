<template lang="pug">
.meet-actions
  BaseButton(
    v-if="canCloseBySecretary",
    variant="primary",
    :loading="isProcessing",
    @click="closeMeetBySecretary"
  )
    q-icon(name="fa-solid fa-signature", size="16px")
    span.q-ml-sm Подписать протокол
  BaseButton(
    v-if="canCloseByPresider",
    variant="primary",
    :loading="isProcessing",
    @click="closeMeetByPresider"
  )
    q-icon(name="fa-solid fa-stamp", size="16px")
    span.q-ml-sm Утвердить протокол
  RestartMeet(
    v-if="canRestartMeet",
    show-button,
    :loading="isProcessing",
    @restart="handleRestartMeet"
  )
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCloseMeet } from 'src/features/Meet/CloseMeetWithDecision/model'
import { useRestartMeet } from 'src/features/Meet/RestartMeet/model'
import { RestartMeet } from 'src/features/Meet/RestartMeet'
import { BaseButton } from 'src/shared/ui/base/BaseButton'
import { useMeetStore } from 'src/entities/Meet'
import type { IMeet } from 'src/entities/Meet'

const props = defineProps<{
  meet: IMeet
  coopname: string
  meetHash: string
}>()

const isProcessing = ref(false)
const meetStore = useMeetStore()
const router = useRouter()

// Устанавливаем текущее собрание в store при монтировании и обновлении пропсов
onMounted(() => {
  meetStore.setCurrentMeet(props.meet)
})

watch(() => props.meet, (newMeet) => {
  meetStore.setCurrentMeet(newMeet)
}, { deep: true })

const {
  canCloseBySecretary,
  canCloseByPresider,
  closeMeetBySecretary,
  closeMeetByPresider
} = useCloseMeet(isProcessing)

const {
  canRestartMeet,
  handleRestartMeet
} = useRestartMeet(router, isProcessing)

</script>

<style lang="scss" scoped>
.meet-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  align-items: center;
}
</style>
