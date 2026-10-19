<template lang="pug">
BaseCard(:title="$t('connectionDashboard.platformKeyCard.title')" :subtitle="$t('connectionDashboard.platformKeyCard.subtitle')")
  //- Ключ показывается один раз: на сервер уходит только публичная часть,
  //- приватная живёт до ухода со страницы.
  template(v-if="issued")
    BaseBanner(variant="warn").q-mb-md {{ $t('connectionDashboard.platformKeyCard.saveWarning') }}
    DataRow(:label="$t('connectionDashboard.platformKeyCard.keyLabel')" :value="issued.privateKey" mono copyable)
    BaseButton.q-mt-md(v-if="siteUrl" variant="primary" size="sm" type="button" @click="openSite")
      | {{ $t('connectionDashboard.platformKeyCard.goToSite') }}
      q-icon(name="open_in_new" size="14px").q-ml-xs
  template(v-else-if="record")
    p.t-sm.t-muted.q-mb-md {{ $t('connectionDashboard.platformKeyCard.issuedAt', { date: issuedAt }) }}
    //- Перевыпуск останавливает платформу кооператива до ввода нового ключа —
    //- поэтому сначала предупреждение и отдельное подтверждение.
    template(v-if="confirming")
      BaseBanner(variant="warn").q-mb-md {{ $t('connectionDashboard.platformKeyCard.reissueNote') }}
      .platform-key__actions
        BaseButton(variant="primary" size="sm" type="button" :loading="isIssuing" @click="issue")
          | {{ $t('connectionDashboard.platformKeyCard.confirmReissue') }}
        BaseButton(variant="ghost" size="sm" type="button" :disabled="isIssuing" @click="confirming = false")
          | {{ $t('connectionDashboard.platformKeyCard.cancel') }}
    .platform-key__actions(v-else)
      BaseButton(v-if="siteUrl" variant="primary" size="sm" type="button" @click="openSite")
        | {{ $t('connectionDashboard.platformKeyCard.goToSite') }}
        q-icon(name="open_in_new" size="14px").q-ml-xs
      BaseButton(variant="secondary" size="sm" type="button" @click="confirming = true")
        | {{ $t('connectionDashboard.platformKeyCard.reissue') }}
  BaseButton(
    v-else
    variant="primary"
    size="sm"
    type="button"
    :loading="isIssuing"
    @click="issue"
  ) {{ $t('connectionDashboard.platformKeyCard.issue') }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RegistratorContract } from 'cooptypes'
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base'
import { DataRow } from 'src/shared/ui/domain'
import { FailAlert } from 'src/shared/api'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import moment from 'src/shared/lib/utils/dates/moment'
import { useSessionStore } from 'src/entities/Session'
import {
  useIssuePlatformKey,
  type IIssuedPlatformKey,
  type IPlatformKeyRecord,
} from 'src/features/Cooperative/IssuePlatformKey'
import { t } from 'src/shared/i18n'

// Адрес сайта кооператива: на панели управления карточка ведёт туда, где
// мастер установки спросит ключ. На экране завершения переход — отдельным шагом.
const props = defineProps<{ siteUrl?: string }>()
// Есть ли действующий ключ — экран завершения открывает по нему следующие шаги.
const emit = defineEmits<{ state: [hasKey: boolean] }>()

const session = useSessionStore()
const { loadPlatformKey, issuePlatformKey } = useIssuePlatformKey()

const record = ref<IPlatformKeyRecord | null>(null)
const issued = ref<IIssuedPlatformKey | null>(null)
const isIssuing = ref(false)
const confirming = ref(false)

const issuedAt = computed(() => (record.value ? moment.utc(record.value.issued_at).local().format('DD.MM.YYYY HH:mm') : ''))

const load = async () => {
  record.value = await loadPlatformKey(session.username)
  emit('state', !!record.value || !!issued.value)
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
  gap: var(--p-2);
}
</style>
