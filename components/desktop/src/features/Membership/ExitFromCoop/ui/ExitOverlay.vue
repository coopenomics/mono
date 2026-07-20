<template lang="pug">
BaseDialog(
  :model-value='isExitActive',
  title='Выход из кооператива',
  :maximized='true',
  :hide-close-button='true',
  :close-on-backdrop='false',
  :close-on-escape='false'
)
  div.exit-overlay
    AuthCard(v-if='exitStatus', :max-width='440')
      //- Шапка карточки: иконка статуса в soft-плитке + заголовок + пояснение.
      template(#head)
        div.exit-head__icon(:class='`exit-head__icon--${view.tone}`')
          q-icon(:name='view.icon', size='28px')
        h2.exit-head__title {{ view.title }}
        p.exit-head__text {{ view.body }}

      //- Тело: сумма к возврату + сопутствующие подписи.
      div.exit-amount(v-if='plannedAmount')
        span.exit-amount__label.t-eyebrow.t-faint {{ view.amountLabel }}
        span.exit-amount__value {{ formatAsset2Digits(plannedAmount) }}
        BaseChip.exit-amount__chip(
          v-if='paymentChip',
          :variant='paymentChip.variant',
          size='sm'
        ) {{ paymentChip.label }}
      p.exit-note.t-sm.t-muted(v-if='view.canCancel') Пока вы не перешли по ссылке, заявление можно отменить.

      //- Футер: действия (отделён бордером внутри AuthCard).
      template(#footer)
        div.exit-actions
          BaseButton(
            v-if='view.canCancel',
            variant='secondary',
            :block='true',
            :loading='cancelling',
            @click='onCancel'
          )
            | Отменить выход
          BaseButton(
            variant='ghost',
            :block='true',
            :loading='loggingOut',
            @click='onLogout'
          )
            template(#icon-left)
              q-icon(name='logout', size='18px')
            | Выйти из личного кабинета
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseChip } from 'src/shared/ui/base/BaseChip';
import type { BaseChipVariant } from 'src/shared/ui/base/BaseChip/BaseChip.types';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useLogoutUser } from 'src/features/User/Logout/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useExitGate } from '../model';

const route = useRoute();
const router = useRouter();
const { exitStatus, isExitActive, isAwaitingConfirmation, paymentStatus, plannedAmount, cancelExit, loadExitStatus } =
  useExitGate();
const { logout } = useLogoutUser();

const isAuthorized = computed(
  () => exitStatus.value?.status === Zeus.MembershipExitStatus.AUTHORIZED,
);

// Терминал: выход завершён, возврат оплачен, аккаунт заблокирован. Этот экран —
// и есть защита от повторного выхода: пока он показан, кабинет перекрыт и кнопку
// «выход из кооператива» не достать (бэкенд и контракт повтор тоже отклоняют).
const isCompleted = computed(
  () => exitStatus.value?.status === Zeus.MembershipExitStatus.COMPLETED,
);

// Статус исходящего платежа возврата → чип у суммы (виден кассиру и пайщику).
const PAYMENT_CHIPS: Record<string, { label: string; variant: BaseChipVariant }> = {
  [Zeus.PaymentStatus.PENDING]: { label: 'Ожидает оплаты', variant: 'warn' },
  [Zeus.PaymentStatus.PROCESSING]: { label: 'Оплачивается', variant: 'info' },
  [Zeus.PaymentStatus.PAID]: { label: 'Оплачивается', variant: 'info' },
  [Zeus.PaymentStatus.COMPLETED]: { label: 'Оплачено', variant: 'pos' },
  [Zeus.PaymentStatus.FAILED]: { label: 'Ошибка выплаты', variant: 'neg' },
  [Zeus.PaymentStatus.EXPIRED]: { label: 'Истёк', variant: 'neg' },
  [Zeus.PaymentStatus.CANCELLED]: { label: 'Отменён', variant: 'neutral' },
  [Zeus.PaymentStatus.REFUNDED]: { label: 'Отклонён', variant: 'neutral' },
  [Zeus.PaymentStatus.AWAITING_AUTHORIZATION]: { label: 'Ожидает решения Совета', variant: 'neutral' },
};

const paymentChip = computed(() =>
  paymentStatus.value ? PAYMENT_CHIPS[paymentStatus.value] ?? null : null,
);

// Содержимое экрана по фазе выхода: ожидание письма → рассмотрение → одобрено → завершено.
const view = computed(() => {
  if (isCompleted.value) {
    return {
      icon: 'check_circle',
      tone: 'pos',
      title: 'Вы вышли из кооператива',
      body: 'Возврат паевого взноса оплачен — дождитесь поступления средств на указанные реквизиты. Аккаунт заблокирован. Благодарим за участие в кооперативе.',
      amountLabel: 'Сумма возврата',
      canCancel: false,
    };
  }
  if (isAwaitingConfirmation.value) {
    return {
      icon: 'mark_email_unread',
      tone: 'primary',
      title: 'Подтвердите выход по ссылке из письма',
      body: 'Мы отправили письмо на вашу электронную почту — перейдите по ссылке в нём, чтобы подтвердить выход и запустить возврат паевого взноса. Письмо могло попасть в папку «Спам».',
      amountLabel: 'Сумма к возврату',
      canCancel: true,
    };
  }
  if (isAuthorized.value) {
    return {
      icon: 'payments',
      tone: 'pos',
      title: 'Совет одобрил выход',
      body: 'Возврат паевого взноса будет совершён в срок, установленный Уставом кооператива. Аккаунт заблокирован — дождитесь поступления средств.',
      amountLabel: 'Сумма к возврату',
      canCancel: false,
    };
  }
  return {
    icon: 'hourglass_top',
    tone: 'primary',
    title: 'Заявление на рассмотрении Совета',
    body: 'Ваше заявление о выходе передано в Совет кооператива. Кабинет заблокирован на время процедуры — дождитесь решения Совета.',
    amountLabel: 'Сумма к возврату',
    canCancel: false,
  };
});

const cancelling = ref(false);
const loggingOut = ref(false);

const onCancel = async (): Promise<void> => {
  cancelling.value = true;
  try {
    await cancelExit();
    SuccessAlert('Заявление на выход отменено.');
  } catch (e: any) {
    FailAlert(e);
  } finally {
    cancelling.value = false;
  }
};

// Выход из личного кабинета (logout). При активном выходе аккаунт заблокирован,
// иначе из сессии не выйти. После logout gate обнуляется и редирект на вход;
// при повторном входе экран выхода снова покажется (статус живёт on-chain).
const onLogout = async (): Promise<void> => {
  loggingOut.value = true;
  try {
    await logout();
    await loadExitStatus();
    await router.push({ name: 'signin', params: { coopname: route.params.coopname } });
  } catch (e: any) {
    FailAlert('Ошибка при выходе: ' + (e?.message ?? e));
  } finally {
    loggingOut.value = false;
  }
};
</script>

<style scoped lang="scss">
.exit-overlay {
  min-height: 70vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--p-4);
}

.exit-head__icon {
  width: 56px;
  height: 56px;
  border-radius: var(--p-r-lg);
  display: grid;
  place-items: center;
  margin: 0 auto var(--p-3);
}
.exit-head__icon--primary {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.exit-head__icon--pos {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}

.exit-head__title {
  margin: 0;
  font-size: var(--p-fs-h2);
  line-height: var(--p-lh-h2);
  letter-spacing: var(--p-ls-h2);
  font-weight: 600;
  color: var(--p-ink);
}
.exit-head__text {
  margin: var(--p-2) 0 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  color: var(--p-ink-2);
}

.exit-amount {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-1);
  padding: var(--p-4) var(--p-5);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
  text-align: center;
}
.exit-amount__value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-h1);
  line-height: var(--p-lh-h1);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'ss01', 'ss02';
}
.exit-amount__chip {
  margin-top: var(--p-2);
}

.exit-note {
  margin: var(--p-3) 0 0;
  text-align: center;
}

.exit-actions {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  width: 100%;
}
</style>
