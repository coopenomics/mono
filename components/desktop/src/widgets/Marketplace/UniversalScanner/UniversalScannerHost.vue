<script lang="ts" setup>
import { onBeforeUnmount, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useSystemStore } from 'src/entities/System/model';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import { FailAlert } from 'src/shared/api';
import { BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import { resolveHandoffTarget, useMarketplaceHandoffSignal } from 'src/shared/lib/marketplace';
import { useUniversalScanner } from './useUniversalScanner';

/**
 * Невидимый держатель всплывающего УНИВЕРСАЛЬНОГО сканера стола ПВЗ. Смонтирован
 * один раз в layout (default.vue), регистрирует действие `marketplaceUniversalScan`
 * — пункт меню «Сканировать QR» вызывает его, как кнопка «Поддержка».
 *
 * Оператор не выбирает заранее «приёмка» или «выдача»: сканирует ЛЮБОЙ код, а
 * система по виду кода ведёт на нужный стол (поставщик/ТТН → приёмка, заказчик →
 * выдача). Код прилетает на целевую страницу через query `handoff` — она сама
 * открывает приёмку/выдачу.
 */

const ACTION = 'marketplaceUniversalScan';

const router = useRouter();
const system = useSystemStore();
const actions = useActionsStore();
const handoffSignal = useMarketplaceHandoffSignal();
const { isOpen, open, close } = useUniversalScanner();

function onScanned(code: string): void {
  const coopname = system.info.coopname ?? '';
  const target = resolveHandoffTarget(coopname, code);
  if (!target) {
    FailAlert(
      new Error(
        'Нераспознанный код. Отсканируйте код передачи поставщика, QR с ТТН экспедитора или код получения заказчика.',
      ),
    );
    return;
  }
  close();
  handoffSignal.post(code);
  void router.push({
    name: target.routeName,
    params: { coopname },
  });
}

onMounted(() => actions.registerAction(ACTION, open));
onBeforeUnmount(() => actions.removeAction(ACTION));
</script>

<template lang="pug">
ScannerDialog(
  v-model='isOpen',
  title='Сканировать QR',
  :formats='BARCODE_FORMATS',
  idle-caption='Наведите камеру на QR поставщика, ТТН или код получения заказчика',
  frame-hint='Поместите код в рамку',
  manual-label='Или введите код вручную',
  @scanned='onScanned'
)
</template>
