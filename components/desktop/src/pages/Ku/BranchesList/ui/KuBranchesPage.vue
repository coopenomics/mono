<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Кооперативные участки объединяют пайщиков по месту. Откройте участок,
      | чтобы увидеть его председателя, адрес, контакты и доверенных лиц.
      | Новый участок учреждается собранием пайщиков на вкладке «Собрания».
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  //- Состояние системы управления кооперативом (флаг is_branched из контракта branch):
  //- при 3+ кооперативных участках общее собрание проходит через участки (мажоритарная модель).
  //- Индикатор только для информации — флаг выставляется контрактом автоматически.
  BaseCard.q-mb-md(title='Мажоритарная система управления')
    template(#actions)
      BaseChip(:variant="isBranched ? 'pos' : 'neutral'")
        q-icon(:name="isBranched ? 'check_circle' : 'do_not_disturb_on'", size='14px')
        span.q-ml-xs {{ isBranched ? 'Включена' : 'Не включена' }}
    .t-sm.t-muted {{ branchModeText }}

  TableSkeleton(v-if='loading && !branches.length', :columns='skeletonColumns', :rows='4')
  .table-wrap(v-else-if='branches.length')
    .table-scroll
      table.table
        thead
          tr
            th.col-expand(v-if='isChairman')
            th Участок
            th Председатель
            th Доверенные
            th.col-count Пайщики
            th.col-action
        tbody
          template(v-for='branch in branches', :key='branch.braname')
            tr.data-row(@click='openDetails(branch.braname)')
              td.col-expand(v-if='isChairman', @click.stop)
                ExpandToggleButton(
                  variant='card',
                  :expanded='isExpanded(branch.braname)',
                  @click='toggleExpand(branch.braname)'
                )
              td
                .doc-primary
                  span {{ branchTitle(branch) }}
                  BaseChip.q-ml-sm(v-if='branch.is_private', variant='warn')
                    q-icon(name='lock', size='12px')
                    span.q-ml-xs Приватный
                .t-sm.t-muted(v-if='branch.fact_address') {{ branch.fact_address }}
              td {{ chairmanName(branch) }}
              td
                template(v-if='trustedNames(branch).length')
                  div(v-for='name in trustedNames(branch)', :key='name') {{ name }}
                span(v-else) —
              td.col-count {{ branch.participants_count ?? 0 }}
              td.col-action
                button.icon-btn(
                  type='button',
                  aria-label='Открыть участок',
                  @click.stop='openDetails(branch.braname)'
                )
                  q-icon(name='chevron_right')

            //- Панель управления приватностью и белым списком — только председателю совета
            tr.expand-row(v-if='isChairman && isExpanded(branch.braname)')
              td(:colspan='6')
                .branch-admin
                  BaseCheckbox(
                    :model-value='branch.is_private',
                    :disabled='isBusy(branch.braname)',
                    label='Приватный участок — выбрать его при вступлении или смене может только пайщик из белого списка',
                    @update:model-value='onTogglePrivate(branch, $event)'
                  )
                  template(v-if='branch.is_private')
                    .branch-admin__subtitle.t-sm.t-muted Белый список пайщиков
                    .branch-admin__add
                      UserSearchSelector.branch-admin__search(
                        v-model='whitelistInput[branch.braname]',
                        label='Начните ввод ФИО пайщика',
                        dense
                      )
                      BaseButton(
                        variant='primary',
                        :disabled='!whitelistInput[branch.braname]',
                        :loading='isBusy(branch.braname)',
                        @click='onAddWhitelist(branch)'
                      ) Добавить
                    .branch-admin__list(v-if='whitelistOf(branch).length')
                      .branch-admin__member(
                        v-for='member in whitelistOf(branch)',
                        :key='member.username'
                      )
                        span {{ certificateName(member) }}
                        button.icon-btn(
                          type='button',
                          aria-label='Удалить из белого списка',
                          :disabled='isBusy(branch.braname)',
                          @click='onRemoveWhitelist(branch, member.username)'
                        )
                          q-icon(name='close')
                    .t-sm.t-muted(v-else) Белый список пуст — добавьте пайщиков, которым разрешён выбор этого участка.
  EmptyState(
    v-else,
    title='Кооперативных участков пока нет',
    body='Учредите участок собранием пайщиков на вкладке «Собрания».'
  )
    template(#icon)
      q-icon(name='home_work', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useBranchStore, type IBranch, type IPublicBranch } from 'src/entities/Branch/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useBranchPrivacy } from 'src/features/Branch/BranchPrivacy';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseCard, BaseCheckbox, BaseChip, EmptyState, TableSkeleton } from 'src/shared/ui/base';
import type { TableSkeletonColumn } from 'src/shared/ui/base';
import { ExpandToggleButton, UserSearchSelector } from 'src/shared/ui';

type AnyBranch = IBranch | IPublicBranch;

const skeletonColumns: TableSkeletonColumn[] = [
  { label: 'Участок' },
  { label: 'Председатель' },
  { label: 'Доверенные' },
  { label: 'Пайщики', class: 'col-count' },
  { label: '', class: 'col-action', cell: 'icon' },
];

const router = useRouter();
const branchStore = useBranchStore();
const system = useSystemStore();
const session = useSessionStore();
const { setBranchPrivate, addBranchWhitelist, deleteBranchWhitelist } = useBranchPrivacy();
const { dismissed, dismiss } = useDismissibleBanner('ku:branches:banner-dismissed');

const loading = ref(true);

// председателю совета доступно управление приватностью — для него грузим полный список
// участков (с белым списком ФИО); остальным достаточно публичных данных
const isChairman = computed(() => session.isChairman);
const branches = computed<AnyBranch[]>(() =>
  isChairman.value ? branchStore.branches : branchStore.publicBranches,
);

// состояние системы управления из контракта: is_branched отдаётся системным стором
// (system.info.cooperator_account). Контракт включает флаг при 3+ кооперативных участках.
const isBranched = computed(() => !!system.info?.cooperator_account?.is_branched);
const branchModeText = computed(() =>
  isBranched.value
    ? 'В кооперативе три и более кооперативных участков, поэтому общие собрания проходят через них: пайщики участвуют в собраниях своего участка, а участки представляют их на общем собрании пайщиков кооператива.'
    : 'Пока в кооперативе меньше трёх кооперативных участков — все пайщики участвуют в общем собрании напрямую. Когда участков станет три и более, система управления автоматически переключится на мажоритарную: собрания будут проходить через кооперативные участки.',
);

// локальное состояние разворота строк и формы белого списка (per-участок)
const expanded = reactive(new Map<string, boolean>());
const busy = reactive(new Map<string, boolean>());
const whitelistInput = reactive<Record<string, string>>({});

function isExpanded(braname: string): boolean {
  return expanded.get(braname) ?? false;
}
function toggleExpand(braname: string) {
  expanded.set(braname, !isExpanded(braname));
}
function isBusy(braname: string): boolean {
  return busy.get(braname) ?? false;
}

// белый список (ФИО) есть только в полном объекте участка (доступен председателю)
function whitelistOf(branch: AnyBranch) {
  return 'whitelist_certificates' in branch ? branch.whitelist_certificates : [];
}

function branchTitle(branch: AnyBranch): string {
  return branch.short_name || branch.full_name || branch.braname;
}

function certificateName(certificate: any): string {
  if (!certificate) return '—';
  return (
    [certificate.last_name, certificate.first_name, certificate.middle_name].filter(Boolean).join(' ') ||
    certificate.username
  );
}

function chairmanName(branch: AnyBranch): string {
  return certificateName(branch.trustee_certificate);
}

function trustedNames(branch: AnyBranch): string[] {
  return (branch.trusted_certificates ?? []).map((certificate: any) => certificateName(certificate));
}

function openDetails(braname: string) {
  router.push({ name: 'ku-branch-details', params: { coopname: system.info.coopname, braname } });
}

async function onTogglePrivate(branch: AnyBranch, value: boolean) {
  busy.set(branch.braname, true);
  try {
    await setBranchPrivate({ coopname: system.info.coopname, braname: branch.braname, is_private: value });
    SuccessAlert(value ? 'Участок сделан приватным' : 'Участок сделан публичным');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.set(branch.braname, false);
  }
}

async function onAddWhitelist(branch: AnyBranch) {
  const account = whitelistInput[branch.braname];
  if (!account) return;
  busy.set(branch.braname, true);
  try {
    await addBranchWhitelist({ coopname: system.info.coopname, braname: branch.braname, account });
    whitelistInput[branch.braname] = '';
    SuccessAlert('Пайщик добавлен в белый список участка');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.set(branch.braname, false);
  }
}

async function onRemoveWhitelist(branch: AnyBranch, account: string) {
  busy.set(branch.braname, true);
  try {
    await deleteBranchWhitelist({ coopname: system.info.coopname, braname: branch.braname, account });
    SuccessAlert('Пайщик удалён из белого списка участка');
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    busy.set(branch.braname, false);
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    if (isChairman.value) {
      await branchStore.loadBranches({ coopname: system.info.coopname });
    } else {
      await branchStore.loadPublicBranches({ coopname: system.info.coopname });
    }
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* строка ведёт на страницу участка — показываем кликабельность */
.data-row {
  cursor: pointer;
}

/* колонка с числом пайщиков — узкая, не растягивается */
.col-count {
  width: 1%;
  white-space: nowrap;
}

/* колонка со стрелкой разворота — узкая */
.col-expand {
  width: 1%;
  white-space: nowrap;
}

/* строка управления приватностью под участком */
.expand-row > td {
  background: var(--p-surface-2);
  padding: var(--p-4);
}

.branch-admin {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}

.branch-admin__subtitle {
  margin-top: var(--p-2);
}

.branch-admin__add {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
}

.branch-admin__search {
  flex: 1 1 auto;
  max-width: 420px;
}

.branch-admin__list {
  display: flex;
  flex-direction: column;
  gap: var(--p-2);
  max-width: 420px;
}

.branch-admin__member {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2);
  padding: var(--p-2) var(--p-3);
  background: var(--p-surface-1);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
}
</style>
