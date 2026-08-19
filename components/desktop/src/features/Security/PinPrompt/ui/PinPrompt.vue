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
    //- Запереться кошелёк мог и сам по простою, и по нажатию замка — для
    //- вводящего это одно и то же: ключа в памяти нет, вернуть его нечем, кроме
    //- PIN-кода. Поэтому причину не называем, называем состояние.
    p.pin-prompt__hint(v-else)
      | Кошелёк заперт: ключ убран из памяти. Введите PIN-код, чтобы им воспользоваться.

    //- Ввод — ячейками с экранной клавиатурой: с телефона PIN набирают пальцем,
    //- за столом привычнее клавиши, и работает то и другое. Полный набор (шесть
    //- цифр) отправляется сам — тянуться к кнопке после последней цифры незачем.
    PinPad(
      v-model='pin',
      :error='session.pinError',
      :disabled='submitting',
      autofocus,
      @complete='onSubmit'
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
      :disabled='!canSubmit',
      @click='onSubmit'
    ) Подтвердить
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { PinPad } from 'src/shared/ui/domain';
import { useSessionStore } from 'src/entities/Session';
import { useInitWalletProcess } from 'src/processes/init-wallet';
import { useSystemStore } from 'src/entities/System/model';

const session = useSessionStore();
const system = useSystemStore();

const pin = ref('');
const submitting = ref(false);

// Кнопка ждёт четырёх цифр: PIN-коды бывают от четырёх до шести, и коротким
// тоже надо давать подтвердить — сам по себе набор отправляется только на шести.
const canSubmit = computed(() => /^\d{4,6}$/.test(pin.value));

const isUnlock = computed(() => session.pinUnlockPending);
// Диалог виден при любом из двух триггеров; закрытие — только через действия.
const visible = computed({
  get: () => session.pinPrompt || session.pinUnlockPending,
  set: () => undefined,
});

async function onSubmit(): Promise<void> {
  if (!canSubmit.value || submitting.value) return;
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
    //
    // Именно на страницу входа, а не на корень кооператива: с корня пайщика ещё
    // надо провести до формы, а он сюда попал как раз потому, что войти не смог.
    // Перезагрузка обязательна — она же и очищает состояние закрытой сессии.
    await session.close();
    const coopname = system.info.coopname;
    pin.value = '';
    window.location.hash = `#/${coopname}/auth/signin`;
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
