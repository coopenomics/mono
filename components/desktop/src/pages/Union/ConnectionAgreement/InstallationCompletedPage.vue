<template lang="pug">
//- Экран сразу после установки: что сделать, чтобы начать работу. Одна
//- карточка: шапка и путь из трёх шагов на общей оси. Порядок жёсткий —
//- мастер установки на сайте спросит ключ первым шагом, поэтому без ключа
//- следующие шаги приглушены и их кнопки заблокированы. Ключ и переход на
//- сайт есть и на панели управления подключением: сюда человек попадает
//- один раз.
.done-page
  BaseCard.done-page__card
    .done-page__head
      .done-page__icon
        q-icon(name="check" size="24px")
      div
        .done-page__title {{ $t('union.installationCompletedPage.title') }}
        .done-page__lead {{ $t('union.installationCompletedPage.subtitle', { domain: announce }) }}

    ol.done-page__steps
      li.done-page__step(:class="hasKey ? 'done-page__step--done' : 'done-page__step--current'")
        .done-page__mark
          q-icon(v-if="hasKey" name="check" size="16px")
          template(v-else) 1
        .done-page__body
          .done-page__step-title
            | {{ hasKey ? $t('union.installationCompletedPage.keyStepDoneTitle') : $t('union.installationCompletedPage.keyStepTitle') }}
          .done-page__step-text {{ keyStepText }}
          PlatformKeyCard.done-page__action(bare button-size="md" @state="keyState = $event")

      li.done-page__step(:class="hasKey ? 'done-page__step--current' : 'done-page__step--locked'")
        .done-page__mark 2
        .done-page__body
          .done-page__step-title {{ $t('union.installationCompletedPage.siteStepTitle') }}
          .done-page__step-text {{ $t('union.installationCompletedPage.setupStepText') }}
          BaseButton.done-page__action(
            variant="primary"
            type="button"
            :disabled="!hasKey"
            @click="goToCooperativeSite"
          )
            | {{ $t('union.installationCompletedPage.goToSiteLabel') }}
            q-icon(name="open_in_new" size="16px").q-ml-xs

      li.done-page__step(:class="{ 'done-page__step--locked': !hasKey }")
        .done-page__mark 3
        .done-page__body
          .done-page__step-title {{ $t('union.installationCompletedPage.dashboardStepTitle') }}
          .done-page__step-text {{ $t('union.installationCompletedPage.dashboardStepText') }}
          BaseButton.done-page__action(
            variant="secondary"
            type="button"
            :disabled="!hasKey"
            @click="goToDashboard"
          ) {{ $t('union.installationCompletedPage.goToDashboardLabel') }}
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { PlatformKeyCard, type PlatformKeyState } from 'src/widgets/ConnectionDashboard';
import { t } from 'src/shared/i18n'
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
// следующие действия. Подпись шага зависит от того, показан ли ключ сейчас.
const keyState = ref<PlatformKeyState>('none')
const hasKey = computed(() => keyState.value !== 'none')
const keyStepText = computed(() => {
  if (keyState.value === 'shown') return t('union.installationCompletedPage.keyStepShownText')
  if (keyState.value === 'exists') return t('union.installationCompletedPage.keyStepExistsText')
  return t('union.installationCompletedPage.keyStepText')
})

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
  display: flex;
  justify-content: center;
  padding: var(--p-6) var(--p-4);
}
.done-page__card {
  width: 100%;
  max-width: 880px;
}
.done-page__head {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: var(--p-4);
  align-items: center;
  padding-bottom: var(--p-5);
  border-bottom: 1px solid var(--p-line);
}
.done-page__icon {
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
  padding: var(--p-5) 0 0;
}
/* Номера шагов стоят на одной оси со значком шапки (колонка 48px),
   линия между ними показывает путь. */
.done-page__step {
  position: relative;
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: var(--p-4);
  padding-bottom: var(--p-6);
}
.done-page__step:last-child {
  padding-bottom: 0;
}
.done-page__step:not(:last-child)::before {
  content: '';
  position: absolute;
  left: 23px;
  top: 36px;
  bottom: 4px;
  width: 2px;
  background: var(--p-line);
}
.done-page__step--done:not(:last-child)::before {
  background: var(--p-primary);
}
.done-page__mark {
  justify-self: center;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 2px solid var(--p-line-2);
  color: var(--p-ink-3);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  background: var(--p-surface);
}
.done-page__step--current .done-page__mark {
  border-color: var(--p-primary);
  color: var(--p-primary);
}
.done-page__step--done .done-page__mark {
  border-color: var(--p-primary);
  background: var(--p-primary);
  color: var(--p-ink-on-primary);
}
.done-page__body {
  min-width: 0;
  padding-top: 4px;
}
.done-page__step-title {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
}
.done-page__step-text {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.done-page__step--locked .done-page__step-title,
.done-page__step--locked .done-page__step-text {
  color: var(--p-ink-3);
}
.done-page__action {
  margin-top: var(--p-3);
}
</style>
