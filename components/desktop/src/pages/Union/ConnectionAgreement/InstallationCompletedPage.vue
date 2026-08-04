<template lang="pug">
div.row.q-pa-md
  div.col-md-12.col-xs-12
    .completion-container
      .completion-card
        .completion-header
          .celebration-icon
            q-icon(name="celebration" color="positive" size="80px")
            .sparkle.sparkle-1
            .sparkle.sparkle-2
            .sparkle.sparkle-3
          .completion-title.text-h5.text-positive.q-mt-lg Поставка завершена!
          .completion-subtitle.text-body1.text-grey-7.q-mt-sm
          | Ваш Цифровой Кооператив успешно развернут и подключен к платформе

        .completion-details.q-mt-xl
          .detail-item
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium Серверная инфраструктура
              .text-caption.text-grey-6 Полностью настроена

          .detail-item.q-mt-md
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium Блокчейн-узел
              .text-caption.text-grey-6 Развернут, синхронизирован и подключен к сети

          .detail-item.q-mt-md
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium База данных
              .text-caption.text-grey-6 Инициализирована и готова к работе

          .detail-item.q-mt-md
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium Мониторинг кооператива
              .text-caption.text-grey-6 Запущен и функционирует

        .next-steps.q-mt-xl
          .text-subtitle2.text-weight-medium.q-mb-md Что дальше?

          .next-step-item.q-mb-lg
            .text-body2.text-grey-8.q-mb-md
              | Завершите начальную настройку вашего Цифрового Кооператива на сайте.
            q-btn(
              color="primary"
              label="Перейти на сайт кооператива"
              @click="goToCooperativeSite"
              size="lg"
              unelevated
              no-caps
              target="_blank"
              :href="cooperativeDomain"
            )

          .next-step-item
            .text-body2.text-grey-8.q-mb-md
              | Перейдите к управлению подключением, где сможете просматривать статус подключения, управлять подписками и настраивать параметры платформы.
            q-btn(
              color="primary"
              label="Перейти к управлению подключением"
              @click="goToDashboard"
              size="lg"
              unelevated
              no-caps
            )
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useCooperativeStore } from 'src/entities/Cooperative'
import { useSessionStore } from 'src/entities/Session'

const router = useRouter()
const coop = useCooperativeStore()
const session = useSessionStore()

// Загружаем данные кооператива при монтировании
coop.loadPublicCooperativeData(session.username)

const cooperativeDomain = computed(() => {
  const domain = coop?.publicCooperativeData?.announce
  return domain ? `https://${domain}` : '#'
})

const goToDashboard = () => {
  router.push({ name: 'connect' })
}

const goToCooperativeSite = () => {
  const domain = cooperativeDomain.value

  if (domain && domain !== '#') {
    window.open(domain, '_blank')
  }
}
</script>

<style scoped>
.completion-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 2rem 0;
}

.completion-card {
  max-width: 600px;
  width: 100%;
  text-align: center;
  padding: 3rem;
  border-radius: 24px;
  border: 1px solid rgba(76, 175, 80, 0.1);
  box-shadow:
    0 12px 40px rgba(0, 0, 0, 0.08),
    0 4px 16px rgba(0, 0, 0, 0.04);
  position: relative;
  overflow: hidden;
}

.completion-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, var(--q-positive) 0%, #4CAF50 50%, var(--q-positive) 100%);
  background-size: 200% 100%;
  animation: completion-shimmer 3s cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
}

@keyframes completion-shimmer {
  0%, 100% { background-position: -100% 0; }
  50% { background-position: 100% 0; }
}

.completion-header {
  position: relative;
}

.celebration-icon {
  position: relative;
  display: inline-block;
  margin-bottom: 1rem;
}

.sparkle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: var(--q-positive);
  border-radius: 50%;
  animation: sparkle 2s infinite ease-in-out;
}

.sparkle-1 {
  top: -10px;
  right: -10px;
  animation-delay: 0s;
}

.sparkle-2 {
  top: 20px;
  left: -15px;
  animation-delay: 0.5s;
}

.sparkle-3 {
  bottom: -5px;
  right: 15px;
  animation-delay: 1s;
}

@keyframes sparkle {
  0%, 100% {
    opacity: 0;
    transform: scale(0);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.completion-title {
  font-weight: 700;
  letter-spacing: -0.5px;
  margin-bottom: 0.5rem;
  background: linear-gradient(135deg, var(--q-positive) 0%, #4CAF50 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  text-shadow: 0 2px 4px rgba(76, 175, 80, 0.3);
}

.completion-details {
  margin-top: 2rem;
  text-align: left;
}

.detail-item {
  display: flex;
  align-items: center;
  padding: 1rem;
  background: rgba(76, 175, 80, 0.02);
  border-radius: 12px;
  border: 1px solid rgba(76, 175, 80, 0.1);
  transition: all 0.3s ease;
}

.detail-item:hover {
  transform: translateX(4px);
  background: rgba(76, 175, 80, 0.05);
  box-shadow: 0 4px 12px rgba(76, 175, 80, 0.1);
}

.detail-text {
  margin-left: 1rem;
}

.next-steps {
  margin-top: 2rem;
  text-align: left;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.02);
  border-radius: 12px;
}

.next-step-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border-radius: 8px;
}

/* Адаптивность */
@media (max-width: 768px) {
  .completion-card {
    padding: 2rem;
  }

  .detail-item {
    flex-direction: column;
    text-align: center;
    gap: 0.5rem;
  }

  .next-step-item {
    padding: 0.75rem;
  }

  .completion-container {
    min-height: 70vh;
    padding: 1rem 0;
  }
}

@media (max-width: 480px) {
  .completion-card {
    padding: 1.5rem;
  }
}
</style>
