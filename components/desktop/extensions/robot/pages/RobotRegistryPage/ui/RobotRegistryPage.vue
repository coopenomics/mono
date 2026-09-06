<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | Робот принимает типовые решения совета за секунды по правилам, которые совет задал заранее.
      | По каждому решению выберите, как голосует робот за вас: «Сразу» — как только появилась повестка,
      | «Как ‹член совета›» — тем же голосом, что и он, и только после него. Председатель отдельно отмечает,
      | какие протоколы робот подписывает за него. Каждый голос и протокол остаются вашей подписью:
      | их ставит ключ отдельного разрешения вашего аккаунта, выпущенного только для робота.
      | Здесь же видно, как настроились остальные, и хватит ли этого для кворума по каждому типу.
    button.icon-btn(type='button', aria-label='Скрыть', @click='dismiss')
      q-icon(name='close')

  .banner.banner--warn.q-mb-md(v-if='keyProblem')
    q-icon.banner__icon(name='warning', size='20px')
    .banner__body {{ keyProblem.text }}
    BaseButton(v-if='keyProblem.action', variant='primary', size='sm', :loading='busy', @click='resendKey') Передать ключ роботу

  BaseTable(
    :columns='columns',
    :rows='rows',
    row-key='type',
    :loading='loading && !rows.length',
    min-width='760px'
  )
    template(#cell-title='{ row }')
      .doc-primary {{ row.title }}
      .t-sm.t-muted {{ row.description }}
    template(#cell-my_vote='{ row }')
      BaseButton(variant='ghost', size='sm', :disabled='busy')
        | {{ modeLabel(draft.mode[row.type]) }}
        q-icon(name='arrow_drop_down')
        q-menu(anchor='bottom middle', self='top middle')
          q-list(dense)
            q-item(
              v-for='option in modeOptions',
              :key='option.value',
              clickable,
              v-close-popup,
              :active='draft.mode[row.type] === option.value',
              @click='setMode(row.type, option.value)'
            )
              q-item-section {{ option.label }}
    template(#cell-my_authorize='{ row }')
      q-toggle(
        v-if='isChairman',
        :model-value='draft.authorize[row.type] === true',
        :disable='busy',
        dense,
        @update:model-value='(v) => setAuthorize(row.type, v)'
      )
      span.t-muted(v-else) —
    template(#cell-quorum='{ row }')
      BaseBadge(:variant='quorumVariant(row)') {{ quorumLabel(row) }}
      .t-sm.t-muted(v-if='row.vote_quorum.follow_groups.length') {{ followLabel(row) }}
      .t-sm.text-warning(v-for='warning in row.warnings', :key='warning') {{ warning }}
      q-tooltip(v-if='row.voters.length', anchor='top middle', self='bottom middle')
        div(v-for='voter in row.voters', :key='voter.member') {{ voterLabel(voter) }}
    template(#cell-protocol='{ row }')
      BaseBadge(:variant='protocolVariant(row)') {{ protocolLabel(row) }}

  .row.items-center.justify-between.q-mt-md(v-if='keyReady')
    .t-sm.t-muted Робот подписывает голоса ключом, выпущенным только для него. Отзыв удаляет этот ключ и снимает все ваши настройки.
    BaseButton(variant='ghost', size='sm', :loading='busy', @click='revokeAll') Отозвать доступ робота

  .save-bar(v-if='dirty')
    BaseButton(variant='ghost', :disabled='busy', @click='resetDraft') Отменить
    BaseButton(variant='primary', :loading='busy', @click='save') Сохранить настройки
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseTable } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { useRobotStore } from '../../../entities/robot';
import type { IRobotDecisionType } from '../../../entities/robot';
import { useRobotDelegation, type RobotAutomationDraft } from '../../../features/robot/model/useRobotDelegation';

type Row = IRobotDecisionType;

const session = useSessionStore();
const robotStore = useRobotStore();
const { dismissed, dismiss } = useDismissibleBanner('robot:registry:banner-dismissed');
const { busy, pendingWif, issueAndDelegate, saveAutomation, revoke, handOverPendingKey } = useRobotDelegation();

const loading = ref(true);
const isChairman = computed(() => session.isChairman);
const rows = computed<Row[]>(() => robotStore.sortedRegistry);
const keyStatus = computed(() => robotStore.keyStatus);
const boardId = computed(() => robotStore.council?.board_id ?? 0);

const columns = computed<BaseTableColumn<Row>[]>(() => [
  // Ширины подобраны так, чтобы на обычном экране обходиться без прокрутки вбок:
  // первой колонке достаётся весь остаток, а длинное описание переносится.
  { key: 'title', label: 'Решение', field: 'title' },
  { key: 'my_vote', label: 'Мой голос', align: 'center', width: '150px' },
  ...(isChairman.value ? [{ key: 'my_authorize', label: 'Мой протокол', align: 'center' as const, width: '110px' }] : []),
  { key: 'quorum', label: 'Кворум робота', align: 'center', width: '180px' },
  { key: 'protocol', label: 'Кто подписывает', align: 'center', width: '150px' },
]);

// Режим по типу в черновике: «manual», «auto» или «follow:‹имя›».
const MODE_MANUAL = 'manual';
const MODE_AUTO = 'auto';
const FOLLOW_PREFIX = 'follow:';

function modeOf(row: Row): string {
  // GraphQL отдаёт имя перечисления в верхнем регистре
  const mode = String(row.my_mode ?? '').toLowerCase();
  if (mode === MODE_AUTO) return MODE_AUTO;
  if (mode === 'follow' && row.my_follow) return FOLLOW_PREFIX + row.my_follow;
  return MODE_MANUAL;
}

// Черновик настроек: что выбрано в таблице, пока не нажали «Сохранить».
const draft = reactive<{ mode: Record<string, string>; authorize: Record<string, boolean> }>({ mode: {}, authorize: {} });
const serverState = reactive<{ mode: Record<string, string>; authorize: Record<string, boolean> }>({ mode: {}, authorize: {} });

function syncDraft() {
  for (const row of rows.value) {
    serverState.mode[row.type] = modeOf(row);
    serverState.authorize[row.type] = row.my_authorize;
    draft.mode[row.type] = modeOf(row);
    draft.authorize[row.type] = row.my_authorize;
  }
}

function resetDraft() {
  Object.assign(draft.mode, serverState.mode);
  Object.assign(draft.authorize, serverState.authorize);
}

function setMode(type: string, value: string) {
  draft.mode[type] = value;
}
function setAuthorize(type: string, value: boolean) {
  draft.authorize[type] = value;
}

/** Варианты режима: вручную, сразу и «как» каждый другой голосующий член совета. */
const modeOptions = computed(() => {
  const others = (robotStore.council?.members ?? []).filter((m) => m.is_voting && m.username !== session.username);
  return [
    { value: MODE_MANUAL, label: 'Вручную' },
    { value: MODE_AUTO, label: 'Сразу' },
    ...others.map((m) => ({ value: FOLLOW_PREFIX + m.username, label: `Как ${robotStore.shortMemberName(m.username)}` })),
  ];
});

function modeLabel(value: string | undefined): string {
  return modeOptions.value.find((o) => o.value === value)?.label ?? 'Вручную';
}

const dirty = computed(() =>
  rows.value.some((row) => draft.mode[row.type] !== serverState.mode[row.type] || draft.authorize[row.type] !== serverState.authorize[row.type]),
);

const hasRecord = computed(() => rows.value.some((row) => row.my_vote || row.my_authorize));
const keyReady = computed(() => !!keyStatus.value?.has_key && !!keyStatus.value?.chain_key_matches);

/**
 * Про ключ говорим, только когда от человека что-то требуется. Обычное
 * состояние — «всё в порядке» — не показываем: члену совета незачем знать про
 * разрешения аккаунта и публичные ключи, это делает за него рабочий стол.
 */
const keyProblem = computed<{ text: string; action: boolean } | null>(() => {
  if (pendingWif.value)
    return {
      text: 'Ключ выпущен, но не дошёл до робота — голосовать за вас он пока не может. Передайте ключ повторно.',
      action: true,
    };
  if (hasRecord.value && !keyReady.value)
    return {
      text: 'У робота нет вашего ключа, поэтому голоса за вас он не подаёт. Нажмите «Сохранить настройки» — ключ будет выпущен заново.',
      action: false,
    };
  return null;
});

function quorumVariant(row: Row): 'pos' | 'warn' | 'neutral' {
  if (row.vote_quorum.reached) return 'pos';
  return row.vote_quorum.reachable ? 'warn' : 'neutral';
}

/** «2 из 3» — голоса, которые робот подаёт сразу, против порога совета. */
function quorumLabel(row: Row): string {
  return `${row.vote_quorum.delegated_count} из ${row.vote_quorum.required_count}`;
}

/** Голоса, которые придут вслед за другими: «+2 после голоса ant». */
function followLabel(row: Row): string {
  return row.vote_quorum.follow_groups.map((g) => `+${g.count} после голоса ${robotStore.shortMemberName(g.follow)}`).join(', ');
}

function protocolVariant(row: Row): 'pos' | 'warn' | 'neutral' {
  if (row.chairman.delegated && row.chairman.has_key) return 'pos';
  return row.chairman.delegated ? 'warn' : 'neutral';
}

function protocolLabel(row: Row): string {
  if (row.chairman.delegated && row.chairman.has_key) return 'Подписывает робот';
  if (row.chairman.delegated) return 'Нет ключа председателя';
  return 'Вручную';
}

function voterLabel(voter: Row['voters'][number]): string {
  const how = voter.follow ? `как ${robotStore.shortMemberName(voter.follow)}` : 'сразу';
  const name = robotStore.memberName(voter.member);
  return voter.has_key ? `${name} — ${how}` : `${name} — ${how}, ключ не передан`;
}

function draftLists(): RobotAutomationDraft {
  const vote_types = rows.value.filter((row) => draft.mode[row.type] === MODE_AUTO).map((row) => row.type);
  const follow_rules = rows.value
    .filter((row) => (draft.mode[row.type] ?? '').startsWith(FOLLOW_PREFIX))
    .map((row) => ({ decision_type: row.type, follow: draft.mode[row.type].slice(FOLLOW_PREFIX.length) }));
  const authorize_types = rows.value.filter((row) => draft.authorize[row.type]).map((row) => row.type);
  return { vote_types, follow_rules, authorize_types };
}

async function save() {
  try {
    const lists = draftLists();
    if (!keyReady.value) {
      await issueAndDelegate(boardId.value, lists);
      SuccessAlert('Ключ выпущен и передан роботу, настройки сохранены');
    } else {
      await saveAutomation(boardId.value, lists, hasRecord.value);
      SuccessAlert('Настройки автоматизации сохранены');
    }
    syncDraft();
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function resendKey() {
  try {
    await handOverPendingKey();
    await robotStore.loadKeyStatus();
    SuccessAlert('Ключ передан роботу');
  } catch (e: unknown) {
    FailAlert(e);
  }
}

async function revokeAll() {
  try {
    await revoke(boardId.value, hasRecord.value, !!keyStatus.value?.chain_has_permission);
    syncDraft();
    SuccessAlert('Делегирование отозвано: разрешение снято, ключ удалён у робота');
  } catch (e: unknown) {
    FailAlert(e);
  }
}

onMounted(async () => {
  loading.value = true;
  try {
    await Promise.all([robotStore.loadRegistry(), robotStore.loadCouncil(), robotStore.loadKeyStatus()]);
    syncDraft();
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
/* Липкий нижний бар формы: действия всегда на виду, не на дне прокрутки */
.save-bar {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  margin-top: var(--p-4);
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
