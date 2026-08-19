<template lang="pug">
BaseCard(
  title='PIN-код устройства',
  subtitle='Дополнительный барьер от посторонних на этом устройстве.'
)
  //- PIN применим только к входу по паролю (ключ хранится в keystore CoopID).
  template(v-if='session.isCoopIdSession')
    .pin-card__status
      q-icon.pin-card__ico(
        :name='session.hasCustomPin ? "lock" : "lock_open"',
        size='22px'
      )
      .pin-card__text
        .pin-card__title(v-if='session.hasCustomPin') PIN-код установлен
        .pin-card__title(v-else) PIN-код не установлен
        .pin-card__hint(v-if='session.hasCustomPin')
          | Запрашивается при подписи после 30 минут бездействия и при перезагрузке.
        .pin-card__hint(v-else)
          | Вход на этом устройстве сейчас прозрачный (без запроса PIN).

    .pin-card__actions
      template(v-if='session.hasCustomPin')
        BaseButton(variant='secondary', @click='openSet') Сменить PIN
        BaseButton(variant='ghost', :loading='removing', @click='onRemove') Снять PIN
      BaseButton(v-else, variant='primary', @click='openSet')
        template(#icon-left)
          q-icon(name='lock', size='18px')
        | Установить PIN

  BaseBanner(v-else, variant='info')
    | PIN-код станет доступен после перехода на вход по паролю.

  BaseDialog(
    v-model='setOpen',
    :title='session.hasCustomPin ? "Смена PIN-кода" : "Установка PIN-кода"',
    size='sm'
  )
    //- Два шага одной клавиатурой, а не два поля рядом: PIN набирают вслепую, и
    //- второй набор нужен как проверка, а не как копия видимого сверху.
    .pin-card__form
      p.pin-card__step
        template(v-if='step === "first"') Придумайте PIN-код: от 4 до 6 цифр.
        template(v-else) Повторите PIN-код, чтобы не ошибиться в наборе.
      PinPad(
        v-model='entry',
        :error='entryError',
        :disabled='saving',
        autofocus,
        @complete='onNext'
      )
    template(#footer)
      BaseButton(
        variant='secondary',
        :disabled='saving',
        @click='onBack'
      ) {{ step === 'first' ? 'Отмена' : 'Назад' }}
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!canGoNext',
        @click='onNext'
      ) {{ step === 'first' ? 'Далее' : 'Сохранить' }}
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog } from 'src/shared/ui/base';
import { PinPad } from 'src/shared/ui/domain';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';

const session = useSessionStore();

const setOpen = ref(false);
/** Набранное на текущем шаге; первый шаг откладывается в `pin`. */
const entry = ref('');
const pin = ref('');
const step = ref<'first' | 'repeat'>('first');
const mismatch = ref(false);
const saving = ref(false);
const removing = ref(false);

const isValidPin = computed(() => /^\d{4,6}$/.test(entry.value));
const canGoNext = computed(() => isValidPin.value);

const entryError = computed(() => {
  if (mismatch.value) return 'PIN-коды не совпадают — наберите заново';
  return entry.value && !isValidPin.value ? 'PIN — от 4 до 6 цифр' : '';
});

function openSet(): void {
  entry.value = '';
  pin.value = '';
  step.value = 'first';
  mismatch.value = false;
  setOpen.value = true;
}

/** Отмена на первом шаге закрывает диалог, на втором — возвращает к набору. */
function onBack(): void {
  if (step.value === 'first') {
    setOpen.value = false;
    return;
  }
  step.value = 'first';
  entry.value = '';
  mismatch.value = false;
}

async function onNext(): Promise<void> {
  if (!canGoNext.value || saving.value) return;

  if (step.value === 'first') {
    pin.value = entry.value;
    entry.value = '';
    mismatch.value = false;
    step.value = 'repeat';
    return;
  }

  if (entry.value !== pin.value) {
    // Не совпало — начинаем с чистого листа: подсказывать, какой из двух наборов
    // ошибочен, нечем, а угадывать пайщику вслепую утомительно.
    mismatch.value = true;
    entry.value = '';
    pin.value = '';
    step.value = 'first';
    return;
  }

  saving.value = true;
  try {
    await session.setCustomPin(pin.value);
    SuccessAlert('PIN-код сохранён');
    setOpen.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    saving.value = false;
  }
}

async function onRemove(): Promise<void> {
  removing.value = true;
  try {
    await session.removeCustomPin();
    SuccessAlert('PIN-код снят');
  } catch (e) {
    FailAlert(e);
  } finally {
    removing.value = false;
  }
}
</script>

<style scoped>
.pin-card__status {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}
.pin-card__ico {
  color: var(--p-ink-3);
  margin-top: 2px;
}
.pin-card__title {
  font-weight: 600;
  color: var(--p-ink);
}
.pin-card__hint {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
  margin-top: 2px;
}
.pin-card__actions {
  display: flex;
  gap: var(--p-2);
  margin-top: var(--p-4);
  flex-wrap: wrap;
}
.pin-card__form {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.pin-card__step {
  margin: 0;
  text-align: center;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
</style>
