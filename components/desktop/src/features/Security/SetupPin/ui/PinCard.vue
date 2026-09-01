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
          | Запрашивается при снятии замка с кошелька, при подписи после 30 минут
          | бездействия и при перезагрузке.
        .pin-card__hint(v-else)
          | Вход на этом устройстве сейчас прозрачный (без запроса PIN), и запереть
          | кошелёк замком тоже не выйдет — отпереть его смог бы любой.

    .pin-card__actions
      template(v-if='session.hasCustomPin')
        BaseButton(variant='secondary', @click='askCurrentPin("change")') Сменить PIN
        BaseButton(
          variant='ghost',
          :loading='removing',
          @click='askCurrentPin("remove")'
        ) Снять PIN
      BaseButton(v-else, variant='primary', @click='openSet')
        template(#icon-left)
          q-icon(name='lock', size='18px')
        | Установить PIN

  BaseBanner(v-else, variant='info')
    | PIN-код станет доступен после перехода на вход по паролю.

  SetPinDialog(v-model='setOpen')

  //- Сменить или снять PIN, не зная текущего, — то же самое, что обойти защиту:
  //- любой, кто сел за незапертое устройство, снимал бы его одним нажатием.
  ConfirmPinDialog(
    v-model='confirmOpen',
    :title='pending === "remove" ? "Снятие PIN-кода" : "Смена PIN-кода"',
    :lead='pending === "remove" ? "Введите текущий PIN-код, чтобы снять защиту." : "Введите текущий PIN-код, чтобы задать новый."',
    @confirmed='onConfirmed'
  )
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import SetPinDialog from './SetPinDialog.vue';
import ConfirmPinDialog from './ConfirmPinDialog.vue';

const session = useSessionStore();

const setOpen = ref(false);
const confirmOpen = ref(false);
const pending = ref<'change' | 'remove' | null>(null);
const removing = ref(false);

function openSet(): void {
  setOpen.value = true;
}

/** Спросить текущий PIN, прежде чем менять или снимать его. */
function askCurrentPin(action: 'change' | 'remove'): void {
  pending.value = action;
  confirmOpen.value = true;
}

async function onConfirmed(): Promise<void> {
  const action = pending.value;
  pending.value = null;
  if (action === 'change') {
    openSet();
    return;
  }
  await removePin();
}

async function removePin(): Promise<void> {
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
</style>
