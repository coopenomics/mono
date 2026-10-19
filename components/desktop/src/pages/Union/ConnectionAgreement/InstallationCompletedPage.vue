<template lang="pug">
//- Экран сразу после установки: что сделать, чтобы начать работу. Порядок
//- жёсткий — мастер установки на сайте кооператива спросит ключ установки
//- первым шагом, поэтому без ключа кнопки следующих действий не показываются.
//- Ключ и переход на сайт есть и на панели управления подключением: сюда
//- человек попадает один раз.
.done-page
  BaseCard
    .done-page__head
      .done-page__icon
        q-icon(name="check" size="28px")
      div
        .done-page__title {{ $t('union.installationCompletedPage.title') }}
        .done-page__lead {{ $t('union.installationCompletedPage.subtitle', { domain: announce }) }}

  ol.done-page__steps
    li.done-page__step(:class="{ 'done-page__step--done': hasKey }")
      .done-page__mark
        q-icon(v-if="hasKey" name="check" size="14px")
        template(v-else) 1
      PlatformKeyCard.done-page__body(@state="hasKey = $event")

    li.done-page__step(:class="{ 'done-page__step--locked': !hasKey }")
      .done-page__mark 2
      BaseCard.done-page__body(
        :title="$t('union.installationCompletedPage.siteStepTitle')"
        :subtitle="$t('union.installationCompletedPage.setupStepText')"
      )
        BaseButton(
          v-if="hasKey"
          variant="primary"
          type="button"
          @click="goToCooperativeSite"
        )
          | {{ $t('union.installationCompletedPage.goToSiteLabel') }}
          q-icon(name="open_in_new" size="16px").q-ml-xs
        .t-sm.t-muted(v-else) {{ $t('union.installationCompletedPage.lockedHint') }}

    li.done-page__step(:class="{ 'done-page__step--locked': !hasKey }")
      .done-page__mark 3
      BaseCard.done-page__body(
        :title="$t('union.installationCompletedPage.dashboardStepTitle')"
        :subtitle="$t('union.installationCompletedPage.dashboardStepText')"
      )
        BaseButton(
          v-if="hasKey"
          variant="secondary"
          type="button"
          @click="goToDashboard"
        ) {{ $t('union.installationCompletedPage.goToDashboardLabel') }}
        .t-sm.t-muted(v-else) {{ $t('union.installationCompletedPage.lockedHint') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlatformKeyCard } from 'src/widgets/ConnectionDashboard';
import { RegistratorContract } from 'cooptypes'
import { liveTable, useLiveReload } from 'src/shared/lib/realtime'
import { useRouter } from 'vue-router'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { useSessionStore } from 'src/entities/Session'
import { BaseButton, BaseCard } from 'src/shared/ui/base'

const router = useRouter()
const coop = useCooperativeStore()
const session = useSessionStore()

// Ключ выпущен — сейчас или раньше (запись в цепи): тогда открываются
// следующие действия.
const hasKey = ref(false)

coop.loadPublicCooperativeData(session.username)

// Карточка кооператива в реестре сети живёт по ленте.
useLiveReload([liveTable(RegistratorContract, RegistratorContract.Tables.Cooperatives)], () => coop.loadPublicCooperativeData(session.username))

const announce = computed(() => coop?.publicCooperativeData?.announce || '')

const goToDashboard = () => {
  router.push({ name: 'connect' })
}

const goToCooperativeSite = () => {
  if (announce.value) window.open(`https://${announce.value}`, '_blank')
}
</script>

<style scoped>
.done-page {
  max-width: 760px;
  margin: 0 auto;
  padding: var(--p-6) var(--p-4);
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
.done-page__head {
  display: flex;
  align-items: center;
  gap: var(--p-4);
}
.done-page__icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.done-page__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.done-page__lead {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
  margin-top: 2px;
}
.done-page__steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.done-page__step {
  display: grid;
  grid-template-columns: 28px 1fr;
  gap: var(--p-3);
  align-items: start;
}
.done-page__mark {
  margin-top: var(--p-4);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--p-primary);
  color: var(--p-primary);
  font-size: var(--p-fs-meta);
  font-weight: 600;
}
.done-page__step--done .done-page__mark {
  background: var(--p-primary);
  color: var(--p-ink-on-primary);
}
.done-page__step--locked .done-page__mark {
  border-color: var(--p-line-2);
  color: var(--p-ink-3);
}
.done-page__body {
  min-width: 0;
}
</style>
