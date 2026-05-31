<template lang="pug">
q-step(
  :name="0"
  title="Членство в союзе"
  icon="group"
  :done="isDone"
)
  .union-membership-container.q-pa-md

    //- Основная информационная карточка
    .membership-info-card.q-mb-xl
      .card-header
        .text-h6.membership-title Членство в Союзе Потребительских Обществ
        .subtitle.text-body2.text-grey-7.q-mt-sm
          | Необходимый шаг для полноценной работы на платформе Кооперативной Экономики

      //- Что будет сделано
      .membership-benefits.q-mb-lg
        .benefit-section
          .section-title
            q-icon(name="check_circle" size="20px" color="positive").q-mr-sm
            span.text-subtitle1.text-weight-medium Подключение к платформе

          .benefit-description.text-body2.q-mt-sm.q-ml-lg
            | Ваш кооператив будет подключен к платформе. Вы получите полный доступ ко всем сервисам цифрового кооператива.

        .benefit-section.q-mt-md
          .section-title
            q-icon(name="group_add" size="20px" color="primary").q-mr-sm
            span.text-subtitle1.text-weight-medium Импорт участников и цифровые подписи

          .benefit-description.text-body2.q-mt-sm.q-ml-lg
            | Вы сможете импортировать пайщиков и пригласите их для выпуска цифровых подписей.

        .benefit-section.q-mt-md
          .section-title
            q-icon(name="event_available" size="20px" color="secondary").q-mr-sm
            span.text-subtitle1.text-weight-medium 30 дней на организацию

          .benefit-description.text-body2.q-mt-sm.q-ml-lg
            | После подключения у вас будет 30 дней для проведения необходимых решений совета и общего собрания пайщиков в соответствии с требованиями союза.

      //- Требование членства
      .membership-requirement.q-mt-lg
        .requirement-card
          .requirement-header
            q-icon(name="verified_user" size="24px" color="warning").q-mr-sm
            .text-subtitle1.text-weight-medium Членство в союзе

          .requirement-description.text-body2.q-mt-sm
            | Членство в Союзе Потребительских Обществ является обязательным условием для работы на платформе. Союз обеспечивает стандартизацию вашего документооборота и приводит его в соответствие с требованиями законодательства, исключая проблемы с проверками и регуляторами.
            | Для связи с представителем союза и координации процесса подключения вам потребуется аккаунт в кооперативном мессенджере.

    //- Информационная карточка если аккаунт уже есть
    .matrix-account-info-card.q-mb-xl(v-if="hasMatrixAccount")
      .card-header
        .text-h6.account-title У вас есть аккаунт
        .subtitle.text-body2.text-grey-7.q-mt-sm
          | Ваш аккаунт в кооперативном мессенджере активен

      .account-info.q-mb-lg
        .info-section
          .section-title
            q-icon(name="message" size="20px" color="primary").q-mr-sm
            span.text-subtitle1.text-weight-medium Связь с представителем союза

          .info-description.text-body2.q-mt-sm.q-ml-lg
            | Для связи с представителем союза перейдите на страницу
            q-btn.q-pa-none.q-ma-none.text-primary.text-weight-medium(
              flat
              dense
              no-caps
              label="Быстрый клиент"
              @click="goToQuickClient"
            ).q-ml-sm
            |  .

          .info-description.text-body2.q-mt-sm.q-ml-lg
            | Там вы сможете начать общение и получить всю необходимую помощь в процессе подключения.

    //- Регистрация в мессенджере (показываем только если аккаунта нет)
    .q-mt-xl(v-if="!hasMatrixAccount")
      div(@accountCreated="handleAccountCreated")
        slot(name="registration")

  q-stepper-navigation.q-gutter-sm.q-pa-md
    .text-body2.text-grey-7(v-if="isActive")
      span(v-if="hasMatrixAccount") Отлично, связь установлена — можем продолжить подключение.
      span(v-else) Создайте аккаунт в кооперативном мессенджере, чтобы продолжить.
    q-btn(
      v-if="isActive"
      color="primary"
      label="Продолжить"
      :disable="!hasMatrixAccount"
      @click="handleContinue"
    )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useDesktopStore } from 'src/entities/Desktop'
import type { IStepProps } from '../model/types'
import { useConnectionAgreementStore } from 'src/entities/ConnectionAgreement'

const props = withDefaults(defineProps<IStepProps>(), {})

const connectionAgreement = useConnectionAgreementStore()
const router = useRouter()
const desktopStore = useDesktopStore()

const isActive = computed(() => props.isActive)
const isDone = computed(() => props.isDone)
const hasMatrixAccount = computed(() => connectionAgreement.hasMatrixAccount)

const handleContinue = () => {
  if (!hasMatrixAccount.value) {
    return
  }
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
  // После создания аккаунта обновляем флаг
  connectionAgreement.setHasMatrixAccount(true)
}
</script>

<style scoped>
.union-membership-container {
  max-width: 900px;
  margin: 0 auto;
  position: relative;
}

/* Основная информационная карточка */
.membership-info-card {
  border-radius: 20px;
  padding: 2.5rem;
  border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.membership-info-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--q-primary) 0%, var(--q-secondary) 50%, var(--q-accent) 100%);
  background-size: 200% 100%;
  animation: shimmer 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

@keyframes shimmer {
  0% { background-position: 100% 0; }
  100% { background-position: -100% 0; }
}

.card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.membership-title {
  font-weight: 700;
  letter-spacing: -0.5px;
}

/* Секции преимуществ */
.membership-benefits {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.benefit-section {
  padding: 1.5rem;
  border-radius: 16px;
  background: rgba(25, 118, 210, 0.02);
  border: 1px solid rgba(25, 118, 210, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.benefit-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(25, 118, 210, 0.1);
  background: rgba(25, 118, 210, 0.05);
}

.section-title {
  display: flex;
  align-items: center;
  margin-bottom: 0.5rem;
}

.benefit-description {
  line-height: 1.6;
  padding-left: 24px;
  position: relative;
}

.benefit-description::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--q-primary) 0%, rgba(25, 118, 210, 0.3) 100%);
  border-radius: 1px;
}

/* Требование членства */
.membership-requirement {
  border-top: 1px solid rgba(0, 0, 0, 0.08);
  padding-top: 2rem;
}

.requirement-card {
  padding: 2rem;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.02) 0%, rgba(255, 193, 7, 0.02) 100%);
  border: 1px solid rgba(255, 152, 0, 0.1);
  position: relative;
}

.requirement-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, #FF9800 0%, #FFC107 50%, #FF9800 100%);
  border-radius: 16px 16px 0 0;
}

.requirement-header {
  display: flex;
  align-items: center;
  margin-bottom: 1rem;
}

.requirement-description {
  line-height: 1.6;
}

/* Секция ссылки на союз */
.union-link-section {
  padding: 1rem;
  border-radius: 12px;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.union-link-btn {
  width: 100%;
  justify-content: center;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.union-link-btn:hover {
  transform: translateY(-1px);
}

/* Адаптивность */
@media (max-width: 768px) {
  .membership-info-card {
    padding: 2rem;
  }

  .benefit-section {
    padding: 1.25rem;
  }

  .requirement-card {
    padding: 1.5rem;
  }

  .benefit-description {
    padding-left: 20px;
  }

  .benefit-description::before {
    width: 1.5px;
  }
}

@media (max-width: 480px) {
  .union-membership-container {
    padding: 1rem;
  }

  .membership-info-card {
    padding: 1.5rem;
  }

  .benefit-section {
    padding: 1rem;
  }

  .requirement-card {
    padding: 1.25rem;
  }

  .section-title {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
  }

  .benefit-description {
    padding-left: 0;
    text-align: center;
  }

  .benefit-description::before {
    display: none;
  }
}

/* Карточка информации об аккаунте в мессенджере */
.matrix-account-info-card {
  border-radius: 20px;
  padding: 2.5rem;
  border: 1px solid rgba(25, 118, 210, 0.1);
  background: linear-gradient(135deg, rgba(25, 118, 210, 0.02) 0%, rgba(66, 165, 245, 0.02) 100%);
  box-shadow:
    0 8px 32px rgba(25, 118, 210, 0.08),
    0 2px 8px rgba(25, 118, 210, 0.04);
  position: relative;
  overflow: hidden;
}

.matrix-account-info-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #2196F3 0%, #42A5F5 50%, #2196F3 100%);
  background-size: 200% 100%;
  animation: shimmer 4s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

.account-title {
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--q-primary);
}

.account-info {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-section {
  padding: 1.5rem;
  border-radius: 16px;
  background: rgba(25, 118, 210, 0.02);
  border: 1px solid rgba(25, 118, 210, 0.1);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.info-section:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(25, 118, 210, 0.1);
  background: rgba(25, 118, 210, 0.05);
}

.info-description {
  line-height: 1.6;
  padding-left: 24px;
  position: relative;
}

.info-description::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, var(--q-primary) 0%, rgba(25, 118, 210, 0.3) 100%);
  border-radius: 1px;
}

/* Адаптивность для карточки аккаунта */
@media (max-width: 768px) {
  .matrix-account-info-card {
    padding: 2rem;
  }

  .info-section {
    padding: 1.25rem;
  }
}

@media (max-width: 480px) {
  .matrix-account-info-card {
    padding: 1.5rem;
  }

  .info-section {
    padding: 1rem;
  }

  .info-description {
    padding-left: 0;
    text-align: center;
  }

  .info-description::before {
    display: none;
  }
}
</style>
