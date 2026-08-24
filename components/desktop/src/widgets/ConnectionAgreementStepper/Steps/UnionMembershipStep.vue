<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BaseChip } from 'src/shared/ui/base'
import { useDesktopStore } from 'src/entities/Desktop'
import { useConnectionAgreementStore, FIRST_ONBOARDING_STEP } from 'src/entities/ConnectionAgreement'
import StepFrame from '../ui/StepFrame.vue'

const connectionAgreement = useConnectionAgreementStore()
const router = useRouter()
const desktopStore = useDesktopStore()

const hasMatrixAccount = computed(() => connectionAgreement.hasMatrixAccount)

const handleContinue = () => {
  if (hasMatrixAccount.value) connectionAgreement.setCurrentStep(FIRST_ONBOARDING_STEP)
}

const goToQuickClient = () => {
  // Сначала переключаем рабочий стол на chatcoop (ставит isWorkspaceChanging=true),
  // затем переходим в «Быстрый клиент» и снимаем лоадер после навигации.
  desktopStore.selectWorkspace('chatcoop')
  void router.push({ name: 'chatcoop-chat' }).finally(() => {
    desktopStore.setWorkspaceChanging(false)
  })
}
</script>

<template lang="pug">
StepFrame(
  title="Членство в союзе"
  lead="Работа на платформе возможна только для кооперативов — членов Союза Потребительских Обществ. Союз приводит документооборот кооператива к единому стандарту и следит, чтобы он соответствовал закону. Для связи с представителем союза нужен аккаунт в кооперативном мессенджере — создайте его здесь."
  :can-back="false"
  :next-disabled="!hasMatrixAccount"
  @next="handleContinue"
)
  ul.union-step__list
    li
      strong Подключение к платформе.
      |  Полный доступ ко всем сервисам Цифрового Кооператива.
    li
      strong Импорт пайщиков.
      |  Пригласите участников и выпустите им электронные подписи.
    li
      strong 30 дней на организацию.
      |  Время на решения совета и общего собрания после подключения.

  .union-step__matrix(v-if="hasMatrixAccount")
    BaseChip(variant="pos")
      q-icon(name="check" size="12px").q-mr-xs
      span Аккаунт в мессенджере создан
    p.t-sm.t-muted.union-step__matrix-body
      | Написать представителю союза можно в
      |
      a.union-step__link(href="#" @click.prevent="goToQuickClient") Быстром клиенте
      | .

  .union-step__matrix(v-else)
    slot(name="registration")
</template>

<style scoped>
.union-step__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.union-step__list strong {
  color: var(--p-ink);
  font-weight: 600;
}
.union-step__matrix {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  align-items: flex-start;
}
.union-step__matrix-body {
  margin: 0;
}
.union-step__link {
  color: var(--p-primary);
  text-decoration: none;
}
.union-step__link:hover {
  text-decoration: underline;
}
</style>
