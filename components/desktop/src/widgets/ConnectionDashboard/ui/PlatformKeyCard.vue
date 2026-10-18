<template lang="pug">
BaseCard(:title="$t('connectionDashboard.platformKeyCard.title')" :subtitle="$t('connectionDashboard.platformKeyCard.subtitle')")
  //- Ключ показывается один раз: на сервер уходит только публичная часть,
  //- приватная живёт до ухода со страницы.
  template(v-if="issued")
    BaseBanner(variant="warn").q-mb-md {{ $t('connectionDashboard.platformKeyCard.saveWarning') }}
    DataRow(:label="$t('connectionDashboard.platformKeyCard.keyLabel')" :value="issued.privateKey" mono copyable)
  template(v-else)
    p.t-sm.t-muted.q-mb-md(v-if="record")
      | {{ $t('connectionDashboard.platformKeyCard.issuedAt', { date: issuedAt }) }}
      |
      | {{ $t('connectionDashboard.platformKeyCard.reissueNote') }}
    BaseButton(
      :variant="record ? 'secondary' : 'primary'"
      size="sm"
      type="button"
      :loading="isIssuing"
      @click="issue"
    ) {{ record ? $t('connectionDashboard.platformKeyCard.reissue') : $t('connectionDashboard.platformKeyCard.issue') }}
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

const session = useSessionStore()
const { loadPlatformKey, issuePlatformKey } = useIssuePlatformKey()

const record = ref<IPlatformKeyRecord | null>(null)
const issued = ref<IIssuedPlatformKey | null>(null)
const isIssuing = ref(false)

const issuedAt = computed(() => (record.value ? moment.utc(record.value.issued_at).local().format('DD.MM.YYYY HH:mm') : ''))

const load = async () => {
  record.value = await loadPlatformKey(session.username)
}

onMounted(load)
useLiveReload([liveTable(RegistratorContract, RegistratorContract.Tables.Platforms)], load)

const issue = async () => {
  isIssuing.value = true
  try {
    issued.value = await issuePlatformKey()
    await load()
  } catch (error: any) {
    FailAlert(t('connectionDashboard.platformKeyCard.issueError', { errorMessage: error?.message ?? '' }))
  } finally {
    isIssuing.value = false
  }
}
</script>
