<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { useSystemStore } from 'src/entities/System/model';
import { useOperatorBranchStore } from 'src/entities/OperatorBranch';
import {
  resolveScan,
  type MarketplaceScanMatterView,
  type MarketplaceScanVisitView,
} from 'src/entities/MarketplaceHandoff';
import { useActionsStore } from 'src/shared/lib/stores/actions.store';
import { FailAlert } from 'src/shared/api';
import { BaseButton, BaseDialog } from 'src/shared/ui/base';
import { BARCODE_FORMATS } from 'src/widgets/Marketplace/CodeScanner';
import { ScannerDialog } from 'src/widgets/Marketplace/ScannerDialog';
import {
  useMarketplaceHandoffSignal,
  type MarketplaceHandoffMatter,
} from 'src/shared/lib/marketplace';
import { useUniversalScanner } from './useUniversalScanner';
import { t } from 'src/shared/i18n';

/**
 * Один сканер на весь стол ПВЗ (598-62). Смонтирован один раз в layout,
 * открывается кнопкой «Сканировать» с любой страницы стола, пунктом меню и
 * сочетанием клавиш. Оператор сканирует ЛЮБОЙ код: сервер отвечает визитом —
 * кто пришёл и какие дела у него на участке. Одно дело открывается сразу,
 * несколько — лист выбора, ни одного — стол выдачи предложит докладку.
 */

const ACTION = 'marketplaceUniversalScan';

const router = useRouter();
const system = useSystemStore();
const branches = useOperatorBranchStore();
const actions = useActionsStore();
const handoffSignal = useMarketplaceHandoffSignal();
const { isOpen, open, close } = useUniversalScanner();

const coopname = computed(() => system.info.coopname ?? '');
const resolving = ref(false);

/** Визит с несколькими делами — оператор выбирает, с чего начать. */
const choiceOpen = ref(false);
const visit = ref<MarketplaceScanVisitView | null>(null);

const MATTER_ROUTE: Record<MarketplaceHandoffMatter['kind'], string> = {
  issuance: 'marketplace-issuance',
  reception: 'marketplace-pvz-reception',
  shipment: 'marketplace-pvz-reception',
  return: 'marketplace-pvz-returns',
  container: 'marketplace-pvz-warehouse',
};

function matterOf(v: MarketplaceScanVisitView, m: MarketplaceScanMatterView): MarketplaceHandoffMatter {
  const account = v.account ?? '';
  switch (m.kind) {
    case Zeus.MarketplaceScanMatterKind.RECEPTION:
      return { kind: 'reception', account };
    case Zeus.MarketplaceScanMatterKind.RETURN:
      return {
        kind: 'return',
        account,
        claim_id: v.focus_claim_id ?? (m.ids.length === 1 ? m.ids[0] : null),
      };
    default:
      return { kind: 'issuance', account };
  }
}

function matterLabel(m: MarketplaceScanMatterView): string {
  const count = m.ids.length;
  switch (m.kind) {
    case Zeus.MarketplaceScanMatterKind.RECEPTION:
      return t('marketplace.universalScannerHost.matterReception', { count });
    case Zeus.MarketplaceScanMatterKind.RETURN:
      return t('marketplace.universalScannerHost.matterReturn', { count });
    default:
      return t('marketplace.universalScannerHost.matterIssuance', { count });
  }
}

function go(matter: MarketplaceHandoffMatter): void {
  choiceOpen.value = false;
  handoffSignal.post(matter);
  const params: Record<string, string> = { coopname: coopname.value };
  if (matter.kind === 'container') params.section = 'labeling';
  void router.push({ name: MATTER_ROUTE[matter.kind], params });
}

function dispatch(v: MarketplaceScanVisitView): void {
  if (v.target === Zeus.MarketplaceScanTarget.SHIPMENT && v.shipment_id) {
    go({ kind: 'shipment', shipment_id: v.shipment_id });
    return;
  }
  if (v.target === Zeus.MarketplaceScanTarget.CONTAINER && v.container_code) {
    go({ kind: 'container', container_code: v.container_code });
    return;
  }
  // Пайщик без дел на участке — стол выдачи покажет его и предложит докладку.
  if (v.matters.length === 0) {
    go({ kind: 'issuance', account: v.account ?? '' });
    return;
  }
  if (v.matters.length === 1) {
    go(matterOf(v, v.matters[0]));
    return;
  }
  visit.value = v;
  choiceOpen.value = true;
}

function pick(m: MarketplaceScanMatterView): void {
  if (!visit.value) return;
  go(matterOf(visit.value, m));
}

async function onScanned(code: string): Promise<void> {
  if (resolving.value) return;
  resolving.value = true;
  try {
    await branches.ensureLoaded(coopname.value);
    const braname = branches.activeBraname ?? '';
    if (!braname) {
      FailAlert(new Error(t('marketplace.universalScannerHost.noBranchError')));
      return;
    }
    const result = await resolveScan({ braname, code });
    close();
    dispatch(result);
  } catch (e) {
    FailAlert(e);
  } finally {
    resolving.value = false;
  }
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

BaseDialog(v-model='choiceOpen', size='sm', :title='$t("marketplace.universalScannerHost.choiceTitle")')
  .scan-choice(v-if='visit')
    .scan-choice__person {{ visit.display_name || visit.account }}
    .scan-choice__hint {{ $t('marketplace.universalScannerHost.choiceHint') }}
    .scan-choice__list
      BaseButton(
        v-for='m in visit.matters',
        :key='m.kind',
        variant='secondary',
        block,
        @click='pick(m)'
      ) {{ matterLabel(m) }}
</template>

<style scoped lang="scss">
.scan-choice {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);

  &__person {
    font-size: var(--p-fs-h3);
    font-weight: 600;
    color: var(--p-ink);
  }

  &__hint {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }

  &__list {
    display: flex;
    flex-direction: column;
    gap: var(--p-2);
    margin-top: var(--p-2);
  }
}
</style>
