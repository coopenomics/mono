<template lang="pug">
.coop-decision
  BaseButton(
    v-if="!isActive"
    variant="primary"
    size="sm"
    type="button"
    :loading="pending === 'activate'"
    @click.stop="askActivate"
  ) {{ $t('cooperativeDecision.actions.confirm') }}
  BaseButton(
    v-if="!isBlocked"
    variant="danger"
    size="sm"
    type="button"
    :loading="pending === 'block'"
    @click.stop="askBlock"
  ) {{ $t('cooperativeDecision.actions.block') }}

  //- Оба решения совета необратимы одним кликом и видны пайщикам сразу:
  //- подключение запускает поставку, блокировка гасит сайт кооператива.
  //- Поэтому каждое подтверждается отдельно, а не выполняется по нажатию.
  BaseDialog(
    v-model="confirmActivate"
    :title="isBlocked ? $t('cooperativeDecision.actions.unblockTitle') : $t('cooperativeDecision.actions.confirm')"
    size="md"
  )
    p.coop-decision__text(v-if="isBlocked")
      | {{ $t('cooperativeDecision.actions.unblockLine1', { title }) }}
      | {{ $t('cooperativeDecision.actions.unblockLine2') }}
    p.coop-decision__text(v-else)
      | {{ $t('cooperativeDecision.actions.confirmLine1', { title }) }}
      | {{ $t('cooperativeDecision.actions.confirmLine2') }}
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="pending === 'activate'"
        @click="confirmActivate = false"
      ) {{ $t('cooperativeDecision.actions.cancel') }}
      BaseButton(
        variant="primary"
        type="button"
        :loading="pending === 'activate'"
        @click="activate"
      ) {{ $t('cooperativeDecision.actions.confirm') }}

  BaseDialog(
    v-model="confirmBlock"
    :title="$t('cooperativeDecision.actions.blockDialogTitle')"
    size="md"
  )
    p.coop-decision__text
      | {{ $t('cooperativeDecision.actions.blockLine1', { title }) }}
      | {{ $t('cooperativeDecision.actions.blockLine2') }}
    p.coop-decision__text.t-muted
      | {{ $t('cooperativeDecision.actions.blockLine3') }}
      | {{ $t('cooperativeDecision.actions.blockLine4') }}
      | {{ $t('cooperativeDecision.actions.blockLine5') }}
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="pending === 'block'"
        @click="confirmBlock = false"
      ) {{ $t('cooperativeDecision.actions.cancel') }}
      BaseButton(
        variant="negative"
        type="button"
        :loading="pending === 'block'"
        @click="block"
      ) {{ $t('cooperativeDecision.actions.block') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { useActivateCooperative } from 'src/features/Union/ActivateCooperative'
import { useBlockCooperative } from 'src/features/Union/BlockCooperative'
import { isRegistryStatus } from 'src/entities/Union'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'
import { t } from 'src/shared/i18n';

const props = defineProps<{
  coopname: string
  /** Человеческое имя кооператива: в диалоге совет должен видеть его, а не account-id. */
  name?: string | null
  status?: string | null
}>()

const emit = defineEmits<{ (e: 'decided'): void }>()

const confirmActivate = ref(false)
const confirmBlock = ref(false)
// Пустая строка — решения нет в работе. Знать, какое именно идёт, нужно, чтобы
// подпись занимала только свою кнопку: обе видны на экране одновременно.
const pending = ref<'' | 'activate' | 'block'>('')

const isActive = computed(() => isRegistryStatus(props.status, 'active'))
const isBlocked = computed(() => isRegistryStatus(props.status, 'blocked'))
const title = computed(() => props.name || props.coopname)

const askActivate = () => {
  confirmActivate.value = true
}

const askBlock = () => {
  confirmBlock.value = true
}

const activate = async () => {
  const { activateCooperative } = useActivateCooperative()
  pending.value = 'activate'
  try {
    await activateCooperative(props.coopname)
    confirmActivate.value = false
    emit('decided')
    SuccessAlert(isBlocked.value ? t('cooperativeDecision.actions.unblocked') : t('cooperativeDecision.actions.confirmed'))
  } catch (e: any) {
    FailAlert(e)
  } finally {
    pending.value = ''
  }
}

const block = async () => {
  const { blockCooperative } = useBlockCooperative()
  pending.value = 'block'
  try {
    await blockCooperative(props.coopname)
    confirmBlock.value = false
    emit('decided')
    SuccessAlert(t('cooperativeDecision.actions.blocked'))
  } catch (e: any) {
    FailAlert(e)
  } finally {
    pending.value = ''
  }
}
</script>

<style scoped>
.coop-decision {
  display: contents;
}
.coop-decision__text {
  margin: 0 0 var(--p-2);
}
.coop-decision__text:last-child {
  margin-bottom: 0;
}
</style>
