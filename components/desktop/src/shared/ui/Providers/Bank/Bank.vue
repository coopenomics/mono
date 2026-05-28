<script lang="ts" setup>
import type {
  IPaymentOrder,
  IInitialPaymentOrder,
} from 'src/shared/lib/types/payments';
import { onMounted, onBeforeUnmount, ref, computed } from 'vue';
import QRCode from 'qrcode';
import { copyToClipboard } from 'quasar';
import { SuccessAlert } from 'src/shared/api';
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

interface IOrderData {
  sum?: string;
  name?: string;
  bankname?: string;
  bic?: string;
  kpp?: string;
  correspacc?: string;
  personalacc?: string;
  purpose?: string;
  payeeinn?: string;
}

const props = defineProps<{
  paymentOrder: IPaymentOrder | IInitialPaymentOrder;
}>();

const qrElement = ref<HTMLCanvasElement | null>(null);
const showDetails = ref<boolean>(false);

function toggleDetails(): void {
  showDetails.value = !showDetails.value;
}

const amount = computed(() => {
  return orderData.value.sum
    ? `${(parseFloat(orderData.value.sum) / 100).toFixed(2)} ${
        props.paymentOrder.symbol
      }`
    : `0 ${props.paymentOrder.symbol}`;
});

const orderData = computed(() => {
  const dataString = (props.paymentOrder.payment_details?.data as string) || '';
  const parsedDetails: IOrderData = {};

  const parts = dataString.split('|');

  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key) {
      parsedDetails[key.toLowerCase() as keyof IOrderData] = value;
    }
  }

  return parsedDetails;
});

onMounted(() => {
  qrElement.value = document.getElementById('qr') as HTMLCanvasElement | null;
  generateQRCode();
});

onBeforeUnmount(() => {
  if (qrElement.value) {
    const ctx = qrElement.value.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, qrElement.value.width, qrElement.value.height);
    }
  }
});

const generateQRCode = () => {
  if (qrElement.value && props.paymentOrder.payment_details?.data) {
    QRCode.toCanvas(
      qrElement.value,
      props.paymentOrder.payment_details.data,
      { width: 400 },
      function (error) {
        if (error) console.error(error);
      },
    );
  } else {
    console.error('QR element not found or payment data is missing');
  }
};

const copyAll = () => {
  const data = `
ИНН Получателя: ${orderData.value.payeeinn}
Получатель: ${orderData.value.name}
БИК: ${orderData.value.bic}
Банк получателя: ${orderData.value.bankname}
КПП: ${orderData.value.kpp}
Корреспондентский счёт: ${orderData.value.correspacc}
Номер счёта: ${orderData.value.personalacc}
Сумма платежа: ${amount.value}
Назначение платежа: ${orderData.value.purpose}
  `.trim();

  copy(data);
};

const copy = (data: string | undefined) => {
  if (!data) return;
  copyToClipboard(data)
    .then(() => SuccessAlert('Скопировано в буфер обмена'))
    .catch(console.log);
};

const downloadQR = () => {
  if (qrElement.value) {
    const link = document.createElement('a');
    link.href = qrElement.value.toDataURL('image/png');
    link.download = 'qrcode.png';
    link.click();
  } else {
    console.error('QR element not found');
  }
};
</script>

<template lang="pug">
.bank-pay
  //- Плоский layout. Сводка вверху всегда видна.
  //- Дальше — переключаемая зона: QR или реквизиты для ручного перевода.
  dl.bank-pay__summary
    .bank-pay__summary-row
      dt.bank-pay__summary-label Получатель
      dd.bank-pay__summary-value {{ orderData.name }}
    .bank-pay__summary-row
      dt.bank-pay__summary-label Сумма
      dd.bank-pay__summary-value.bank-pay__summary-amount {{ amount }}
    .bank-pay__summary-row(v-if='orderData.purpose')
      dt.bank-pay__summary-label Назначение
      dd.bank-pay__summary-value {{ orderData.purpose }}

  //- QR-canvas. v-show, чтобы canvas сохранил состояние при toggle назад.
  //- Сам canvas белый+чёрный — функциональное требование сканирования.
  canvas#qr.bank-pay__qr(v-show='!showDetails')

  //- Альтернативная панель: список реквизитов для ручного перевода.
  //- v-if чтобы не держать тяжёлые BaseInput в DOM пока не нужны.
  .bank-pay__details(v-if='showDetails')
    .bank-pay__field
      BaseInput(label='ИНН получателя', :model-value='orderData.payeeinn', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.payeeinn)')

    .bank-pay__field
      BaseInput(label='Получатель', :model-value='orderData.name', readonly)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.name)')

    .bank-pay__field
      BaseInput(label='БИК', :model-value='orderData.bic', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.bic)')

    .bank-pay__field
      BaseInput(label='Банк получателя', :model-value='orderData.bankname', readonly)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.bankname)')

    .bank-pay__field
      BaseInput(label='КПП', :model-value='orderData.kpp', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.kpp)')

    .bank-pay__field
      BaseInput(label='Корреспондентский счёт', :model-value='orderData.correspacc', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.correspacc)')

    .bank-pay__field
      BaseInput(label='Номер счёта', :model-value='orderData.personalacc', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.personalacc)')

    .bank-pay__field
      BaseInput(label='Сумма платежа', :model-value='amount', readonly, mono)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(amount)')

    .bank-pay__field
      BaseInput(label='Назначение платежа', :model-value='orderData.purpose', readonly)
        template(#append)
          q-btn(flat, dense, round, icon='content_copy', size='sm', @click='copy(orderData.purpose)')

  //- Действия в одной строке. Состав зависит от showDetails.
  .bank-pay__actions
    template(v-if='!showDetails')
      BaseButton(variant='primary', @click='downloadQR')
        q-icon.q-mr-xs(name='download', size='16px')
        | Скачать QR
      BaseButton(variant='secondary', @click='toggleDetails')
        q-icon.q-mr-xs(name='receipt_long', size='16px')
        | Показать реквизиты
    template(v-else)
      BaseButton(variant='primary', @click='copyAll')
        q-icon.q-mr-xs(name='content_copy', size='16px')
        | Скопировать всё
      BaseButton(variant='secondary', @click='toggleDetails')
        q-icon.q-mr-xs(name='qr_code', size='16px')
        | Показать QR
</template>

<style scoped>
/* Плоский layout: между секциями — canon-gap, никаких вложенных surface-блоков. */
.bank-pay {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
  margin-top: var(--p-4, 16px);
  /* Ограничиваем ширину панели: иначе длинное «Назначение» в shrink-to-fit
     диалоге раздувает форму до max-content и она выглядит непропорционально
     широкой. С max-width значение переносится по строкам внутри панели. */
  width: 100%;
  max-width: 380px;
  margin-left: auto;
  margin-right: auto;
}

/* Сводка ключевых полей в виде definition list — плоско, без отдельного
   подкрашенного контейнера. Просто строки label / value, дополнительно
   разделённые тонкой линией снизу. */
.bank-pay__summary {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
  margin: 0;
  padding: 0 0 var(--p-4, 16px);
  border-bottom: 1px solid var(--p-line);
}
.bank-pay__summary-row {
  display: flex;
  gap: var(--p-3, 12px);
  align-items: baseline;
  font-size: var(--p-fs-body-sm, 13px);
}
.bank-pay__summary-label {
  color: var(--p-ink-2);
  flex: 0 0 110px;
  font-weight: 400;
}
.bank-pay__summary-value {
  color: var(--p-ink);
  font-weight: 500;
  min-width: 0;
  overflow-wrap: anywhere;
  margin: 0;
}
.bank-pay__summary-amount {
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  color: var(--p-ink);
}

/* QR — просто центрированный canvas без обёртки/фона/рамки.
   Сам canvas белый+чёрный, как и требуется для сканирования. */
.bank-pay__qr {
  display: block;
  margin: 0 auto;
  width: 220px !important;
  height: 220px !important;
}

.bank-pay__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--p-3, 12px);
}

/* Список реквизитов вместо QR при toggle. Плоский, без своего surface. */
.bank-pay__details {
  display: flex;
  flex-direction: column;
  gap: var(--p-2, 8px);
}
.bank-pay__field {
  width: 100%;
}
</style>
