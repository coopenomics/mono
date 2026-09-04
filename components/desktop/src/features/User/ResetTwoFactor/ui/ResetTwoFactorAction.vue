<template lang="pug">
//- Подтверждение входа пайщика в реестре: председатель совета снимает
//- приложение-аутентификатор, если пайщик потерял устройство с кодами.
.reset-2fa(v-if='canManage && security')
  .reset-2fa__title.t-sm.t-muted Подтверждение входа
  .reset-2fa__row
    BaseBadge(:variant='security.totp_enrolled ? "pos" : "neutral"')
      | {{ security.totp_enrolled ? 'Приложение подключено' : 'Приложение не подключено' }}
    span.t-sm.t-muted(v-if='security.totp_enrolled && !security.totp_enabled')
      | Код при входе временно не запрашивается
    BaseButton(
      v-if='security.totp_enrolled',
      variant='ghost',
      size='sm',
      :loading='loading',
      @click='confirmOpen = true'
    )
      template(#icon-left)
        q-icon(name='phonelink_erase', size='16px')
      | Сбросить приложение

  BaseDialog(v-model='confirmOpen', title='Сброс приложения-аутентификатора', size='sm')
    .reset-2fa__confirm
      .reset-2fa__confirm-name(v-if='fullName') {{ fullName }}
      .reset-2fa__confirm-hint
        | Код из приложения перестанет запрашиваться при входе — пайщик войдёт по
        | одному паролю и сможет подключить приложение заново на новом устройстве.
        | Сбрасывайте, когда устройство с кодами утеряно: сам пайщик снять фактор
        | не может, для отключения нужен действующий код.
      .reset-2fa__confirm-hint
        | Пайщик получит уведомление о снятии защиты, а действие попадёт в журнал
        | безопасности с вашим именем.
      .reset-2fa__confirm-actions
        BaseButton(variant='ghost', :disabled='loading', @click='confirmOpen = false') Отмена
        BaseButton(variant='danger', :loading='loading', @click='onReset') Сбросить
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { BaseBadge, BaseButton, BaseDialog } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { getName } from 'src/shared/lib/utils';
import type { IAccount } from 'src/entities/Account/types';
import { useResetTwoFactor } from '../model';

const props = defineProps<{
  participant: IAccount;
}>();

const session = useSessionStore();
const { loading, security, load, reset } = useResetTwoFactor();
const confirmOpen = ref(false);

// Снимать второй фактор вправе только председатель совета; полномочия повторно
// проверяет сервер, здесь — только видимость блока.
const canManage = computed(() => session.isChairman);

const fullName = computed(() => getName(props.participant));

onMounted(() => {
  if (canManage.value) void load(props.participant.username);
});

// Строку реестра переиспользуют под разных пайщиков — состояние обязано ехать
// за участником, иначе председатель увидит чужой статус.
watch(
  () => props.participant.username,
  (username) => {
    if (canManage.value && username) void load(username);
  },
);

async function onReset(): Promise<void> {
  await reset(props.participant.username);
  confirmOpen.value = false;
}
</script>

<style scoped>
.reset-2fa {
  display: flex;
  flex-direction: column;
  gap: var(--p-1, 4px);
}
.reset-2fa__row {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  flex-wrap: wrap;
}
.reset-2fa__confirm {
  display: flex;
  flex-direction: column;
  gap: var(--p-3, 12px);
}
.reset-2fa__confirm-name {
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-weight: 600;
  color: var(--p-ink);
}
.reset-2fa__confirm-hint {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}
.reset-2fa__confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--p-2, 8px);
}
</style>
