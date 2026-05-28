<template lang="pug">
.install-page
  .install-shell
    //- ===== Шаг за шагом =====
    .install-card(v-if='!installStore.is_finish')
      header.install-card__head
        h1.install-card__title Установка Цифрового Кооператива
        p.install-card__sub Пошаговая настройка вашего кооператива

      VerticalStepper.install-card__stepper(
        :steps='steps',
        :active-key='installStore.current_step',
        :completed='completedKeys',
        @change='goToStep'
      )
        template(#active='{ step }')
          //- ---------- Шаг 1: ключ установки ----------
          .install-step(v-if='step.key === "key"')
            p.install-step__intro
              | Введите ключ, который был выдан вам при регистрации в качестве пайщика.
            RequestKeyForm

          //- ---------- Шаг 2: данные организации ----------
          .install-step(v-else-if='step.key === "init"')
            SetInitForm

          //- ---------- Шаг 3: члены совета ----------
          .install-step(v-else-if='step.key === "soviet"')
            p.install-step__intro
              | Введите данные председателя и членов совета. Каждому будет создан
              | аккаунт пайщика и отправлено приглашение на электронную почту.
            SetSovietForm

          //- ---------- Шаг 4: переменные документов ----------
          .install-step(v-else-if='step.key === "vars"')
            p.install-step__intro
              | Задайте постоянные параметры, по которым фабрика генерирует
              | документы кооператива.
            SetVariablesForm

    //- ===== Завершение =====
    .install-done(v-else)
      .install-done__icon
        q-icon(name='fa-solid fa-circle-check', size='44px')
      h2.install-done__title Установка завершена
      p.install-done__sub Ваш Цифровой Кооператив готов к работе
      p.install-done__hint
        | Всем членам совета отправлены приглашения на электронные почты со
        | ссылками для получения цифровых подписей. Перейдите по своей ссылке из
        | письма, получите ключ председателя и используйте его для входа в систему.
      BaseButton.install-done__btn(variant='primary', @click='goToSignin') Войти в систему
</template>

<script setup lang="ts">
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { RequestKeyForm, SetInitForm, SetSovietForm, SetVariablesForm } from 'src/features/Installer';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const router = useRouter();
const systemStore = useSystemStore();
const installStore = useInstallCooperativeStore();

const steps: StepperStep[] = [
  { key: 'key', label: 'Ключ установки', description: 'Ключ, выданный при регистрации пайщиком' },
  { key: 'init', label: 'Данные организации', description: 'Реквизиты для документооборота с пайщиками' },
  { key: 'soviet', label: 'Члены совета', description: 'Председатель и члены совета — им создадутся аккаунты' },
  { key: 'vars', label: 'Настройка фабрики документов', description: 'Постоянные параметры для генерации документов' },
];

const stepOrder = ['key', 'init', 'soviet', 'vars'] as const;

// Завершёнными считаем все шаги до текущего — на них можно вернуться кликом.
const completedKeys = computed(() => {
  const currentIndex = stepOrder.indexOf(installStore.current_step);
  return stepOrder.slice(0, Math.max(0, currentIndex)) as unknown as string[];
});

// Переход по клику в степпере разрешён только назад, на пройденный шаг.
const goToStep = (key: string) => {
  if (completedKeys.value.includes(key)) {
    installStore.current_step = key as typeof stepOrder[number];
  }
};

const goToSignin = () => {
  router.push({
    name: 'signin',
    params: { coopname: systemStore.info.coopname },
  });
};
</script>

<style scoped lang="scss">
.install-page {
  display: flex;
  justify-content: center;
  padding: var(--p-6, 24px);
  min-height: 100%;
  @media (max-width: 600px) {
    padding: var(--p-4, 16px);
  }
}

.install-shell {
  width: 100%;
  max-width: 720px;
}

/* ===== Карточка визарда ===== */
.install-card {
  position: relative;
  overflow: hidden;
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  padding: var(--p-6, 24px);
  box-shadow:
    0 1px 2px rgba(9, 9, 11, 0.04),
    0 8px 24px rgba(9, 9, 11, 0.06);
  @media (max-width: 600px) {
    padding: var(--p-5, 20px);
  }
}
/* Статичный accent-стрип сверху — визуальный якорь без анимации. */
.install-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: var(--p-primary);
}

.install-card__head {
  margin-bottom: var(--p-5, 20px);
}
.install-card__title {
  font-size: var(--p-fs-h1, 24px);
  line-height: var(--p-lh-h1, 1.25);
  letter-spacing: var(--p-ls-h1);
  font-weight: 700;
  color: var(--p-ink);
  margin: 0;
}
.install-card__sub {
  margin: var(--p-1, 4px) 0 0;
  font-size: var(--p-fs-body-sm, 13px);
  color: var(--p-ink-2);
}

/* ===== Содержимое шага ===== */
.install-step {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}
.install-step__intro {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}

/* ===== Экран завершения ===== */
.install-done {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  background: var(--p-surface, #fff);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 14px);
  padding: var(--p-8, 40px) var(--p-6, 24px);
  box-shadow:
    0 1px 2px rgba(9, 9, 11, 0.04),
    0 8px 24px rgba(9, 9, 11, 0.06);
}
.install-done__icon {
  color: var(--p-pos);
  margin-bottom: var(--p-4, 16px);
}
.install-done__title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 700;
  color: var(--p-ink);
  margin: 0;
}
.install-done__sub {
  margin: var(--p-1, 4px) 0 0;
  font-size: var(--p-fs-body, 14px);
  color: var(--p-ink-2);
}
.install-done__hint {
  margin: var(--p-5, 20px) 0 0;
  max-width: 460px;
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}
.install-done__btn {
  margin-top: var(--p-6, 24px);
}
</style>
