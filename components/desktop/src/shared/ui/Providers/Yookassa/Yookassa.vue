<script lang="ts" setup>
import type {
  IPaymentOrder,
  IInitialPaymentOrder,
} from 'src/shared/lib/types/payments';
import { onBeforeUnmount, onMounted } from 'vue';

const props = defineProps<{
  paymentOrder: IPaymentOrder | IInitialPaymentOrder;
}>();

const emit = defineEmits(['paymentSuccess', 'paymentFail']);

/**
 * Токен формы ЮKassa: сервер отдаёт объект с токеном и номером платежа,
 * платежи, заведённые раньше, хранят только строку-токен.
 */
function widgetToken(): string {
  const data = props.paymentOrder.payment_details?.data as unknown;
  if (typeof data === 'string') return data;
  return ((data ?? {}) as { confirmation_token?: string }).confirmation_token ?? '';
}

let checkout: { destroy: () => void } | null = null;

onMounted(() => {
  const script = document.createElement('script');
  script.src = 'https://yookassa.ru/checkout-widget/v1/checkout-widget.js';
  script.async = true;
  document.head.appendChild(script);

  script.onload = () => {
    // Форма показывает способы, включённые в магазине ЮKassa: набор способов
    // кооператив согласует с менеджером ЮKassa, в форму он не передаётся.
    const widget = new window.YooMoneyCheckoutWidget({
      confirmation_token: widgetToken(),

      error_callback: function (error: any) {
        console.error(error);
        emit('paymentFail');
      },
    });
    checkout = widget;

    widget.render('paymentForm');

    // Виджет присылает исход только после своего экрана успеха. Окно оплаты
    // закрывает сигнал о статусе платежа от кооператива, обычно раньше.
    widget.on('success', () => {
      emit('paymentSuccess');
    });

    widget.on('fail', () => {
      emit('paymentFail');
    });
  };
  script.onerror = () => {
    console.error('Ошибка при загрузке скрипта ЮKassa');
  };
});

// Окно закрыто — форму ЮKassa вместе с её экраном успеха убираем сразу.
onBeforeUnmount(() => {
  checkout?.destroy();
  checkout = null;
});
</script>

<template lang="pug">
#paymentForm.Yookassa.full-width
</template>
