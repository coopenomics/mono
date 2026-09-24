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
import { t } from 'src/shared/i18n';

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
        t('marketplace.error.scannerUnrecognizedCode'),
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
  :title='$t("marketplace.universalScannerHost.title")',
  :formats='BARCODE_FORMATS',
  :idle-caption='$t("marketplace.universalScannerHost.idleCaption")',
  :frame-hint='$t("marketplace.universalScannerHost.frameHint")',
  :manual-label='$t("marketplace.universalScannerHost.manualLabel")',
  @scanned='onScanned'
)
</template>
