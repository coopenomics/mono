<template lang="pug">
BaseDialog(
  v-model='visible',
  :title='isUnlock ? "Введите PIN-код" : "Подтвердите PIN-код"',
  size='sm',
  :close-on-backdrop='false',
  :close-on-escape='false',
  hide-close-button
)
  .pin-prompt
    p.pin-prompt__hint(v-if='isUnlock')
      | Кабинет защищён PIN-кодом. Введите его, чтобы продолжить работу на этом устройстве.
    p.pin-prompt__hint(v-else)
      | Сессия была заблокирована по бездействию. Введите PIN-код, чтобы подписать операцию.

    BaseInput(
      v-model='pin',
      label='PIN-код',
      type='password',
      autocomplete='off',
      :error='session.pinError',
      @keyup.enter='onSubmit'
    )

  template(#footer)
    BaseButton(
      variant='secondary',
      :disabled='submitting',
      @click='onSecondary'
    ) {{ isUnlock ? 'Войти заново' : 'Отмена' }}
    BaseButton(
      variant='primary',
      :loading='submitting',
      :disabled='!pin',
      @click='onSubmit'
    ) Подтвердить
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseButton, BaseDialog, BaseInput } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import { useSystemStore } from 'src/entities/System/model';

const session = useSessionStore();
const system = useSystemStore();

const pin = ref('');
const submitting = ref(false);

const isUnlock = computed(() => session.pinUnlockPending);
// Диалог виден при любом из двух триггеров; закрытие — только через действия.
const visible = computed({
  get: () => session.pinPrompt || session.pinUnlockPending,
  set: () => undefined,
});

async function onSubmit(): Promise<void> {
  if (!pin.value) return;
  submitting.value = true;
  try {
    if (isUnlock.value) {
      // reload-гейт: разблокировать keystore и до-инициализировать кабинет.
      const ok = await session.completePinUnlock(pin.value);
      if (ok) {
        pin.value = '';
        await useInitWalletProcess().run(true);
      }
    } else {
      // запрос перед подписью: отдать PIN в ожидающий промис ensureWalletUnlocked.
      session.submitSignPin(pin.value);
      pin.value = '';
    }
  } finally {
    submitting.value = false;
  }
}

async function onSecondary(): Promise<void> {
  if (isUnlock.value) {
    // «Войти заново»: забыть устройство и вернуться на вход.
    await session.close();
    const coopname = system.info.coopname;
    pin.value = '';
    window.location.hash = `#/${coopname}`;
    window.location.reload();
  } else {
    // «Отмена»: подпись не состоится (ensureWalletUnlocked бросит).
    session.cancelPin();
    pin.value = '';
  }
}
</script>

<style scoped>
.pin-prompt {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.pin-prompt__hint {
  margin: 0;
  color: var(--p-ink-2);
  font-size: var(--p-fs-body-sm);
}
</style>
