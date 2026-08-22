<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { BaseButton } from 'src/shared/ui/base/BaseButton'
import { BaseChip } from 'src/shared/ui/base/BaseChip'
import { useDesktopStore } from 'src/entities/Desktop'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const connectionAgreement = useConnectionAgreementStore()
const router = useRouter()
const desktopStore = useDesktopStore()

const hasMatrixAccount = computed(() => connectionAgreement.hasMatrixAccount)

const handleContinue = () => {
  if (!hasMatrixAccount.value) return
  if (connectionAgreement.currentStep === 0) {
    connectionAgreement.setCurrentStep(1)
  }
}

const goToQuickClient = () => {
  // Сначала переключаем рабочий стол на chatcoop (ставит isWorkspaceChanging=true)
  desktopStore.selectWorkspace('chatcoop')
  // Затем переходим на страницу "Быстрый клиент" и снимаем лоадер после навигации
  void router
    .push({ name: 'chatcoop-chat' })
    .finally(() => {
      desktopStore.setWorkspaceChanging(false)
    })
}

const handleAccountCreated = () => {
  connectionAgreement.setHasMatrixAccount(true)
}
</script>

<template lang="pug">
.union-step
  p.t-body.union-step__lead
    | Членство в Союзе Потребительских Обществ — обязательное условие работы на платформе.
    | Союз стандартизирует документооборот вашего кооператива и приводит его в соответствие
    | с требованиями законодательства.

  ul.union-step__list
    li
      strong Подключение к платформе.
      |  Полный доступ ко всем сервисам Цифрового Кооператива.
    li
      strong Импорт пайщиков.
      |  Пригласите участников и выпустите электронные подписи.
    li
      strong 30 дней на организацию.
      |  Время для решений совета и общего собрания после подключения.

  .union-step__matrix(v-if="hasMatrixAccount")
    BaseChip(variant="pos")
      span Аккаунт в кооперативном мессенджере создан
    p.t-sm.t-muted.union-step__matrix-body
      | Для связи с представителем союза откройте
      |
      a.union-step__link(href="#" @click.prevent="goToQuickClient") Быстрый клиент
      | . Там можно начать общение и получить помощь по подключению.

  .union-step__matrix(v-else)
    p.t-sm.t-muted.union-step__matrix-body
      | Создайте аккаунт в кооперативном мессенджере — нужен для связи с представителем союза.
    div(@accountCreated="handleAccountCreated")
      slot(name="registration")

  .union-step__actions
    BaseButton(
      variant="primary"
      size="sm"
      :disabled="!hasMatrixAccount"
      @click="handleContinue"
    ) Продолжить
</template>

<style scoped>
.union-step {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 640px;
}
.union-step__lead {
  margin: 0;
  color: var(--p-ink-1);
}
.union-step__list {
  margin: 0;
  padding: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-1);
  list-style: none;
}
.union-step__list li + li {
  margin-top: var(--p-3);
  padding-top: var(--p-3);
  border-top: 1px solid var(--p-line);
}
.union-step__list strong {
  color: var(--p-ink);
  font-weight: 600;
}
.union-step__matrix {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding: var(--p-4);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
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
.union-step__actions {
  display: flex;
}
</style>
