<template lang="pug">
.meet-actions
  //- Протокол вслепую не подписывается: кнопка открывает текст протокола,
  //- подпись — по подтверждению в окне (решение владельца 24.11.2026).
  BaseButton(
    v-if="canCloseBySecretary",
    variant="primary",
    :loading="isProcessing",
    @click="openSecretaryProtocol"
  )
    q-icon(name="draw", size="18px")
    span.q-ml-sm {{ $t('meet.meetDetailsActions.signProtocol') }}
  BaseButton(
    v-if="canCloseByPresider",
    variant="primary",
    :loading="isProcessing",
    @click="openPresiderProtocol"
  )
    q-icon(name="approval", size="18px")
    span.q-ml-sm {{ $t('meet.meetDetailsActions.approveProtocol') }}
  RestartMeet(
    v-if="canRestartMeet",
    show-button,
    :loading="isProcessing",
    @restart="handleRestartMeet"
  )

BaseDialog(
  v-model="protocolPreviewOpen",
  :title="$t('meet.meetDetailsActions.protocolPreviewTitle')",
  size="lg"
)
  template(v-if="protocolPreview")
    .t-sm.t-muted.q-mb-md {{ $t('meet.meetDetailsActions.protocolPreviewNotice') }}
    BaseDocument(:document-aggregate="protocolPreview.aggregate")
    .row.justify-end.q-gutter-sm.q-mt-md
      BaseButton(variant="secondary", type="button", @click="protocolPreviewOpen = false") {{ $t('common.action.back') }}
      BaseButton(variant="primary", :loading="isProcessing", @click="confirmProtocol")
        | {{ protocolPreview.role === 'secretary' ? $t('meet.meetDetailsActions.signProtocol') : $t('meet.meetDetailsActions.approveProtocol') }}
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useCloseMeet } from 'src/features/Meet/CloseMeetWithDecision/model'
import { useRestartMeet } from 'src/features/Meet/RestartMeet/model'
import { RestartMeet } from 'src/features/Meet/RestartMeet'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { BaseDocument } from 'src/shared/ui/BaseDocument'
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
  protocolPreview,
  protocolPreviewOpen,
  openSecretaryProtocol,
  openPresiderProtocol,
  confirmProtocol
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
