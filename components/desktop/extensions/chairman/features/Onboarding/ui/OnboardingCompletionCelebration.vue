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
          .completion-title.text-h5.text-positive.q-mt-lg {{ $t('chairman.onboardingCelebration.title') }}
          .completion-subtitle.text-body1.text-grey-7.q-mt-sm
          | {{ $t('chairman.onboardingCelebration.subtitle') }}

        .completion-details.q-mt-xl
          .detail-item
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium {{ $t('chairman.onboardingCelebration.decisionsTitle') }}
              .text-caption.text-grey-6 {{ $t('chairman.onboardingCelebration.decisionsSubtitle') }}

          .detail-item.q-mt-md
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium {{ $t('chairman.onboardingCelebration.meetingTitle') }}
              .text-caption.text-grey-6 {{ $t('chairman.onboardingCelebration.meetingSubtitle') }}

          .detail-item.q-mt-md
            q-icon(name="check_circle" color="positive" size="24px").q-mr-md
            .detail-text
              .text-body2.text-weight-medium {{ $t('chairman.onboardingCelebration.readyTitle') }}
              .text-caption.text-grey-6 {{ $t('chairman.onboardingCelebration.readySubtitle') }}

        .q-mt-xl

          q-btn(
            color="primary"
            size="lg"
            :label="$t('chairman.onboardingCelebration.hideLabel')"
            @click="hideOnboarding"
          )
</template>

<script setup lang="ts">
import { onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';

const router = useRouter();
const desktop = useDesktopStore();

const hideOnboarding = () => {
  // Сохраняем в localStorage что онбординг скрыт
  localStorage.setItem('chairman-onboarding-hidden', 'true');

  // Меняем рабочий стол на стол пайщика и переходим на его дефолтный маршрут
  desktop.selectWorkspace('participant');

  // Стол переключается синхронно — переходим на следующем тике, когда
  // вычисляемые маршруты стола уже пересчитаны.
  void nextTick(() => desktop.goToDefaultPage(router));
};

// Анимация для блеска
onMounted(() => {
  // Можно добавить дополнительную логику анимации если нужно
});
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
