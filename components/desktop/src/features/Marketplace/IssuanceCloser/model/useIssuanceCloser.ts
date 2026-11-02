import { computed, ref } from 'vue';
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import { FailAlert, SuccessAlert, hasErrorCode } from 'src/shared/api';
import { useGlobalStore } from 'src/shared/store';
import { signDocument } from 'src/shared/lib/document';
import { t } from 'src/shared/i18n';

/**
 * Закрывающая подпись оператора участка (99D-18, решение владельца 02.11.2026).
 *
 * Когда пайщик подписал акт выдачи, выдачу закрывает подпись оператора. Её
 * ставит стол сам, в фоне, на любом столе приложения — оператор не обязан
 * заходить на страницу выдачи. Состояние общее на всё приложение: хост в
 * макете и страница выдачи видят одни и те же выдачи и не закрывают одну
 * дважды.
 *
 * Открытых столов бывает несколько: два оператора участка, один человек на
 * телефоне и компьютере. Шаг выдачи на сервере берёт один стол; остальные
 * получают «шаг выполняется» и молча ждут обновления. Ручная кнопка
 * перехватывает шаг, захваченный больше двадцати секунд назад.
 */

type IssuanceSaga = Queries.Marketplace.ListIssuanceSagas.IOutput['marketplaceListIssuanceSagas'][number];

/** Шаг держит другой стол — не ошибка: экран обновится, когда тот закончит. */
const STEP_IN_PROGRESS = 'MARKETPLACE_ISSUANCE_STEP_IN_PROGRESS';

const pending = ref<IssuanceSaga[]>([]);
const closing = ref<Set<string>>(new Set());
let refreshing: Promise<void> | null = null;

async function listAwaiting(braname: string): Promise<IssuanceSaga[]> {
  const { [Queries.Marketplace.ListIssuanceSagas.name]: sagas } = await client.Query(
    Queries.Marketplace.ListIssuanceSagas.query,
    { variables: { data: { braname, active_only: true } } },
  );
  // Закрывает только тот оператор, кто начал выдачу у стойки (слово
  // владельца 02.11.2026): чужие выдачи участка этот стол не трогает.
  const me = useGlobalStore().username;
  return (sagas as IssuanceSaga[]).filter((s) => s.awaits_operator_close && s.operator_account === me);
}

/** Выдачи этого оператора, ждущие его закрывающей подписи, по всем его участкам. */
async function refresh(branames: string[]): Promise<void> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const lists = await Promise.all(branames.map((b) => listAwaiting(b).catch(() => [] as IssuanceSaga[])));
      pending.value = lists.flat();
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

/**
 * Закрыть одну выдачу: собрать акт с подписью пайщика, поставить вторую
 * подпись и отправить. `true` — выдача закрыта этим столом.
 */
async function closeOne(saga: IssuanceSaga, opts: { manual: boolean }): Promise<boolean> {
  if (closing.value.has(saga.order_id)) return false;
  closing.value = new Set([...closing.value, saga.order_id]);
  const globalStore = useGlobalStore();
  try {
    const { [Queries.Marketplace.IssuanceClosePayload.name]: payload } = await client.Query(
      Queries.Marketplace.IssuanceClosePayload.query,
      { variables: { data: { order_id: saga.order_id } } },
    );
    const raw = payload.act_aggregate.rawDocument;
    if (!raw) throw new Error(t('marketplace.error.issuanceSourceActNotFound'));
    const signed_act = (await signDocument(raw, globalStore.username, 2, [payload.act_aggregate.document])) as Mutations.Marketplace.CloseIssuance.IInput['data']['signed_act'];
    await client.Mutation(Mutations.Marketplace.CloseIssuance.mutation, {
      variables: { data: { order_id: saga.order_id, signed_act, manual: opts.manual } },
    });
    pending.value = pending.value.filter((s) => s.order_id !== saga.order_id);
    return true;
  } catch (e) {
    if (!hasErrorCode(e, STEP_IN_PROGRESS) || opts.manual) FailAlert(e, t('marketplace.operatorIssuance.closeError'));
    return false;
  } finally {
    const next = new Set(closing.value);
    next.delete(saga.order_id);
    closing.value = next;
  }
}

/** Закрыть все ждущие выдачи; уведомление — одно на серию. */
async function closeAll(opts: { manual: boolean }): Promise<number> {
  let closed = 0;
  for (const saga of [...pending.value]) {
    if (await closeOne(saga, opts)) closed++;
  }
  if (closed) SuccessAlert(t('marketplace.issuanceCloser.closedMessage', { count: closed }));
  return closed;
}

export function useIssuanceCloser() {
  const globalStore = useGlobalStore();
  return {
    pending,
    closing,
    /** Ключ подписи отперт: подпись встанет без окна PIN-кода. */
    keyReady: computed(() => !!globalStore.wif),
    refresh,
    closeOne,
    closeAll,
  };
}
