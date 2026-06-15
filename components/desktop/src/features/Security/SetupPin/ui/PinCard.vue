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
    .pin-card__form
      BaseInput(
        v-model='pin',
        label='PIN-код (4–6 цифр)',
        type='password',
        autocomplete='off',
        :error='pinError'
      )
      BaseInput(
        v-model='repeat',
        label='Повторите PIN-код',
        type='password',
        autocomplete='off',
        :error='repeatError'
      )
    template(#footer)
      BaseButton(variant='secondary', @click='setOpen = false') Отмена
      BaseButton(
        variant='primary',
        :loading='saving',
        :disabled='!isValid',
        @click='onSave'
      ) Сохранить
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';

const session = useSessionStore();

const setOpen = ref(false);
const pin = ref('');
const repeat = ref('');
const saving = ref(false);
const removing = ref(false);

const isValidPin = computed(() => /^\d{4,6}$/.test(pin.value));
const pinsMatch = computed(() => !!repeat.value && repeat.value === pin.value);

const pinError = computed(() =>
  pin.value && !isValidPin.value ? 'PIN — от 4 до 6 цифр' : '',
);
const repeatError = computed(() =>
  repeat.value && !pinsMatch.value ? 'PIN-коды не совпадают' : '',
);
const isValid = computed(() => isValidPin.value && pinsMatch.value);

function openSet(): void {
  pin.value = '';
  repeat.value = '';
  setOpen.value = true;
}

async function onSave(): Promise<void> {
  if (!isValid.value) return;
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
  gap: var(--p-3);
}
</style>
