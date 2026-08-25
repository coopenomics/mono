<template lang="pug">
.coop-decision
  BaseButton(
    v-if="!isActive"
    variant="primary"
    size="sm"
    type="button"
    :loading="pending === 'activate'"
    @click.stop="askActivate"
  ) Подтвердить подключение
  BaseButton(
    v-if="!isBlocked"
    variant="danger"
    size="sm"
    type="button"
    :loading="pending === 'block'"
    @click.stop="askBlock"
  ) Заблокировать

  //- Оба решения совета необратимы одним кликом и видны пайщикам сразу:
  //- подключение запускает поставку, блокировка гасит сайт кооператива.
  //- Поэтому каждое подтверждается отдельно, а не выполняется по нажатию.
  BaseDialog(
    v-model="confirmActivate"
    :title="isBlocked ? 'Разблокировать кооператив' : 'Подтвердить подключение'"
    size="md"
  )
    p.coop-decision__text(v-if="isBlocked")
      | Кооператив {{ title }} сейчас заблокирован. Подтверждение вернёт его
      | в строй, и провайдер снимет заглушку с домена кооператива.
    p.coop-decision__text(v-else)
      | Совет подтверждает подключение кооператива {{ title }} к платформе.
      | После этого провайдер начнёт поставку.
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="pending === 'activate'"
        @click="confirmActivate = false"
      ) Отменить
      BaseButton(
        variant="primary"
        type="button"
        :loading="pending === 'activate'"
        @click="activate"
      ) Подтвердить подключение

  BaseDialog(
    v-model="confirmBlock"
    title="Заблокировать кооператив"
    size="md"
  )
    p.coop-decision__text
      | Кооператив {{ title }} будет заблокирован в сети. Провайдер повесит
      | на его домен заглушку — сайт кооператива перестанет открываться.
    p.coop-decision__text.t-muted
      | Сервер кооператива при этом сохраняется: освобождают его отдельным
      | решением оператора. Блокировку можно снять — тогда заглушка
      | снимется сама.
    template(#footer)
      BaseButton(
        variant="ghost"
        type="button"
        :disabled="pending === 'block'"
        @click="confirmBlock = false"
      ) Отменить
      BaseButton(
        variant="negative"
        type="button"
        :loading="pending === 'block'"
        @click="block"
      ) Заблокировать
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { BaseButton, BaseDialog } from 'src/shared/ui/base'
import { useActivateCooperative } from 'src/features/Union/ActivateCooperative'
import { useBlockCooperative } from 'src/features/Union/BlockCooperative'
import { isRegistryStatus } from 'src/entities/Union'
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts'

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
    SuccessAlert(isBlocked.value ? 'Кооператив разблокирован' : 'Подключение кооператива подтверждено')
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
    SuccessAlert('Кооператив заблокирован')
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
