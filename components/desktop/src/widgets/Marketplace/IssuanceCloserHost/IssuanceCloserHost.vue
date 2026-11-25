<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, watch } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { useOperatorBranchStore } from 'src/entities/OperatorBranch';
import { useIssuanceCloser } from 'src/features/Marketplace/IssuanceCloser';
import { useLiveReload } from 'src/shared/lib/realtime';
import { marketLiveTables } from 'src/shared/lib/marketplace';
import { ensureSigningUnlocked } from 'src/shared/lib/document';
import { BaseButton } from 'src/shared/ui/base';
import { t } from 'src/shared/i18n';

/**
 * Фоновая закрывающая подпись оператора (99D-18, решение владельца
 * 02.11.2026). Смонтирован один раз в макете: оператор участка с любого
 * стола приложения закрывает выдачи, где пайщик уже подписал акт, — заходить
 * на страницу выдачи не нужно.
 *
 * Ключ отперт — подпись встаёт молча, приходит одно уведомление «Выдача
 * закрыта». Ключ заперт PIN-кодом — окно PIN не всплывает посреди работы:
 * в шапке горит кнопка со счётчиком, по нажатию PIN спрашивается один раз.
 */

const system = useSystemStore();
const branches = useOperatorBranchStore();
const closer = useIssuanceCloser();
const coopname = computed(() => system.info.coopname ?? '');

const waiting = computed(() => closer.pending.value.length);
/** Кнопка в шапке — только когда подпись сама встать не может. */
const showButton = computed(() => waiting.value > 0 && !closer.keyReady.value);
const busy = computed(() => closer.closing.value.size > 0);

async function tick(): Promise<void> {
  if (!coopname.value) return;
  await branches.ensureLoaded(coopname.value);
  if (!branches.isOperator) return;
  await closer.refresh(branches.operatorBranames);
  if (closer.keyReady.value && waiting.value > 0) await closer.closeAll({ manual: false });
}

async function closeWithPin(): Promise<void> {
  if (!(await ensureSigningUnlocked(t('marketplace.operatorIssuance.missingOperatorKeyError')))) return;
  await closer.closeAll({ manual: true });
}

// realtime: лента изменений Стола заказов — акт пайщика меняет ход выдачи
useLiveReload(marketLiveTables('order'), () => void tick());
// Ключ отперли где-то ещё (подпись другого документа) — закрываем ждущие сразу.
watch(closer.keyReady, (ready) => {
  if (ready && waiting.value > 0) void closer.closeAll({ manual: false });
});

let timer: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  void tick();
  // timing: schedule — страховка на случай пропущенного события ленты, раз в минуту
  timer = setInterval(() => void tick(), 60_000);
});
onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});
</script>

<template lang="pug">
Teleport(to='#header-actions-host', defer)
  BaseButton(
    v-if='showButton',
    variant='secondary',
    size='sm',
    :loading='busy',
    @click='closeWithPin'
  )
    template(#icon-left)
      q-icon(name='draw', size='18px')
    | {{ $t('marketplace.issuanceCloser.awaitingButton', { count: waiting }) }}
    q-tooltip {{ $t('marketplace.issuanceCloser.awaitingHint') }}
</template>
