<template lang="pug">
BaseCard(variant="default" title="Кошелёк программы")
  DataRow(label="Остаток" :value="formatAsset2Digits(balance?.available ?? '')" align="spread")
  .t-sm.t-muted.q-mt-sm
    | Остаток засчитывается при следующей подписке. В паевой взнос членский взнос программы
    | возвращается с прекращением участия в программе: подписки закрываются с возвратом по Положению,
    | и весь остаток переходит в Цифровой Кошелёк после согласования кооперативом.
  .row.justify-end.q-mt-md
    BaseButton(variant="secondary" size="sm" :disabled="!canRequest" @click="dialogOpen = true") Прекратить участие в программе
  .t-meta.t-muted.q-mt-sm(v-if="balance?.has_pending") Заявление о прекращении участия ждёт согласования кооперативом.

  BaseTable.q-mt-md(v-if="requests.length" :columns="columns" :rows="requests" row-key="id" min-width="480px")
    template(#cell-created_at="{ row }") {{ formatDate(row.created_at) }}
    template(#cell-amount="{ row }") {{ formatAsset2Digits(row.amount) }}
    template(#cell-status="{ row }")
      BaseBadge(:variant="statusOf(row.status).variant") {{ statusOf(row.status).label }}
      .t-meta.t-muted(v-if="row.decline_reason") {{ row.decline_reason }}

  BaseDialog(v-model="dialogOpen" title="Прекратить участие в программе" size="sm")
    BaseForm(:loading="busy" @submit="onSubmit")
      DataRow(label="Остаток кошелька программы" :value="formatAsset2Digits(balance?.available ?? '')" align="spread")
      DataRow(
        v-if="(balance?.subscriptions ?? 0) > 0"
        :label="`Возврат по подпискам (${balance?.subscriptions})`"
        :value="formatAsset2Digits(balance?.refunds ?? '')"
        align="spread"
      )
      DataRow(label="В паевой взнос, оценка на сегодня" :value="formatAsset2Digits(balance?.total ?? '')" align="spread")
      .t-sm.t-muted.q-mt-sm
        | Вы подпишете заявление об аннулировании соглашения об участии в программе «Образование». После согласования
        | кооперативом подписки закроются с возвратом по Положению, весь остаток перейдёт в паевой взнос.
        | Точная сумма считается в день согласования. Чтобы снова учиться, понадобится подписать оферту программы заново.
      template(#footer)
        .row.justify-end.q-gutter-sm
          BaseButton(variant="ghost" type="button" :disabled="busy" @click="dialogOpen = false") Отменить
          BaseButton(variant="primary" type="submit" :loading="busy") Подписать заявление
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseForm, BaseTable, type BaseTableColumn } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { buildProgramAnnulment, fetchMyReturnRequests, fetchReturnBalance, requestReturn } from '../api';
import { RETURN_STATUS_LABELS, type IReturnBalance, type IReturnRequest } from '../model';

/**
 * Остаток кошелька программы и прекращение участия в программе. Членский взнос
 * программы возвращается в паевой только с прекращением участия, по заявлению
 * и согласованию кооператива, — поэтому кнопка подаёт заявление, а не переводит средства.
 */
const balance = ref<IReturnBalance | null>(null);
const requests = ref<IReturnRequest[]>([]);
const dialogOpen = ref(false);
const busy = ref(false);

const columns: BaseTableColumn<IReturnRequest>[] = [
  { key: 'created_at', label: 'Подано', width: '120px', nowrap: true },
  { key: 'amount', label: 'В паевой', numeric: true, width: '140px', nowrap: true },
  { key: 'status', label: 'Состояние' },
];

const canRequest = computed(() => Boolean(balance.value) && !balance.value?.has_pending);

const statusOf = (s: string) => RETURN_STATUS_LABELS[s] ?? { label: s, variant: 'neutral' as const };
const formatDate = (v: unknown) => new Date(String(v)).toLocaleDateString('ru-RU');

async function load(): Promise<void> {
  try {
    const [b, r] = await Promise.all([fetchReturnBalance(), fetchMyReturnRequests()]);
    balance.value = b;
    requests.value = r;
  } catch (e) {
    FailAlert(e);
  }
}

async function onSubmit(): Promise<void> {
  busy.value = true;
  try {
    const document = await buildProgramAnnulment();
    const created = await requestReturn(document);
    requests.value = [created, ...requests.value];
    balance.value = await fetchReturnBalance();
    dialogOpen.value = false;
    SuccessAlert('Заявление подано — кооператив согласует прекращение участия');
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

onMounted(load);
</script>
