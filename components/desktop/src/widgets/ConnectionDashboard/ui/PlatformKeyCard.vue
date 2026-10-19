<template lang="pug">
//- bare — без своей рамки и подписей: экран завершения встраивает ключ шагом
//- в общую карточку и сам подписывает каждое состояние (см. state).
component(
  :is="bare ? 'div' : BaseCard"
  v-bind="bare ? {} : { title: title || $t('connectionDashboard.platformKeyCard.title'), subtitle: subtitle || $t('connectionDashboard.platformKeyCard.subtitle') }"
)
  //- Ключ показывается один раз: на сервер уходит только публичная часть,
  //- приватная живёт до ухода со страницы. Об этом говорится только здесь,
  //- в момент показа, — после перезагрузки ключа уже нет на экране.
  template(v-if="issued")
    p.platform-key__note(v-if="!bare") {{ $t('connectionDashboard.platformKeyCard.shownNote') }}
    .platform-key__value
      span.platform-key__wif {{ issued.privateKey }}
      BaseButton(variant="secondary" :size="buttonSize" type="button" @click="copyKey")
        q-icon(name="content_copy" size="16px").q-mr-xs
        | {{ $t('connectionDashboard.platformKeyCard.copy') }}
    BaseButton.q-mt-md(v-if="siteUrl" variant="primary" :size="buttonSize" type="button" @click="openSite")
      | {{ $t('connectionDashboard.platformKeyCard.goToSite') }}
      q-icon(name="open_in_new" size="16px").q-ml-xs
  template(v-else-if="record")
    //- Перевыпуск останавливает платформу кооператива до ввода нового ключа —
    //- поэтому сначала предупреждение и отдельное подтверждение.
    template(v-if="confirming")
      BaseBanner(variant="warn").q-mb-md {{ $t('connectionDashboard.platformKeyCard.reissueNote') }}
      .platform-key__actions
        BaseButton(variant="primary" :size="buttonSize" type="button" :loading="isIssuing" @click="issue")
          | {{ $t('connectionDashboard.platformKeyCard.confirmReissue') }}
        BaseButton(variant="ghost" :size="buttonSize" type="button" :disabled="isIssuing" @click="confirming = false")
          | {{ $t('connectionDashboard.platformKeyCard.cancel') }}
    template(v-else)
      p.platform-key__note(v-if="!bare") {{ $t('connectionDashboard.platformKeyCard.lostHint') }}
      .platform-key__actions
        BaseButton(v-if="siteUrl" variant="primary" :size="buttonSize" type="button" @click="openSite")
          | {{ $t('connectionDashboard.platformKeyCard.goToSite') }}
          q-icon(name="open_in_new" size="16px").q-ml-xs
        BaseButton(variant="secondary" :size="buttonSize" type="button" @click="confirming = true")
          | {{ $t('connectionDashboard.platformKeyCard.reissue') }}
  BaseButton(
    v-else
    variant="primary"
    :size="buttonSize"
    type="button"
    :loading="isIssuing"
    @click="issue"
  ) {{ $t('connectionDashboard.platformKeyCard.issue') }}
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { copyToClipboard } from 'quasar'
import { RegistratorContract } from 'cooptypes'
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base'
import { FailAlert, SuccessAlert } from 'src/shared/api'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { useSessionStore } from 'src/entities/Session'
import {
  useIssuePlatformKey,
  type IIssuedPlatformKey,
  type IPlatformKeyRecord,
} from 'src/features/Cooperative/IssuePlatformKey'
import { t } from 'src/shared/i18n'
import type { PlatformKeyState } from '../model/platformKey'

// Адрес сайта кооператива: на панели управления карточка ведёт туда, где
// мастер установки спросит ключ. На экране завершения переход — отдельным шагом.
const props = withDefaults(
  defineProps<{ siteUrl?: string; title?: string; subtitle?: string; bare?: boolean; buttonSize?: 'sm' | 'md' }>(),
  { buttonSize: 'sm' },
)
const emit = defineEmits<{ state: [state: PlatformKeyState] }>()

const session = useSessionStore()
const { loadPlatformKey, issuePlatformKey } = useIssuePlatformKey()

const record = ref<IPlatformKeyRecord | null>(null)
const issued = ref<IIssuedPlatformKey | null>(null)
const isIssuing = ref(false)
const confirming = ref(false)

const load = async () => {
  record.value = await loadPlatformKey(session.username)
  emit('state', issued.value ? 'shown' : record.value ? 'exists' : 'none')
}

const copyKey = async () => {
  if (!issued.value) return
  try {
    await copyToClipboard(issued.value.privateKey)
    SuccessAlert(t('ui.copyableInput.copiedText'))
  } catch (error: any) {
    FailAlert(error?.message ?? '')
  }
}

const openSite = () => {
  if (props.siteUrl) window.open(props.siteUrl, '_blank')
}

onMounted(load)
useLiveReload([liveTable(RegistratorContract, RegistratorContract.Tables.Platforms)], load)

const issue = async () => {
  isIssuing.value = true
  try {
    issued.value = await issuePlatformKey()
    confirming.value = false
    await load()
  } catch (error: any) {
    FailAlert(t('connectionDashboard.platformKeyCard.issueError', { errorMessage: error?.message ?? '' }))
  } finally {
    isIssuing.value = false
  }
}
</script>

<style scoped>
.platform-key__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2);
}
.platform-key__note {
  margin: 0 0 var(--p-3);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
/* Ключ — одной строкой в поле с кнопкой копирования рядом; длинный ключ
   переносится внутри поля, кнопка остаётся справа. */
.platform-key__value {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-2) var(--p-2) var(--p-2) var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
}
.platform-key__wif {
  flex: 1;
  min-width: 0;
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink);
  word-break: break-all;
}
</style>
