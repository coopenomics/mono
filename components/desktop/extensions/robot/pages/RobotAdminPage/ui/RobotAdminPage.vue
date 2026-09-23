<template lang="pug">
.q-pa-md
  .banner.banner--info.q-mb-md(v-if='!dismissed')
    q-icon.banner__icon(name='info', size='20px')
    .banner__body
      | {{ $t('robot.robotAdminPage.bannerLine1') }}
      | {{ $t('robot.robotAdminPage.bannerLine2') }}
      | {{ $t('robot.robotAdminPage.bannerLine3') }}
    button.icon-btn(type='button', :aria-label='$t("robot.robotAdminPage.hideAriaLabel")', @click='dismiss')
      q-icon(name='close')

  BaseCard.q-mb-md(
    :title='$t("robot.robotAdminPage.delegatedCardTitle")',
    :subtitle='$t("robot.robotAdminPage.delegatedCardSubtitle")'
  )
    BaseTable(:columns='keyColumns', :rows='keys', row-key='member', :loading='loadingKeys && !keys.length', min-width='760px')
      template(#cell-member='{ row }')
        .doc-primary {{ robotStore.memberName(row.member) }}
      template(#cell-voting='{ row }')
        template(v-if='delegationOf(row.member).length')
          .q-mb-xs(v-for='line in delegationOf(row.member)', :key='line.label')
            .doc-primary {{ line.label }}
            .t-sm.t-muted {{ line.what }}
        span.t-muted(v-else) {{ $t('robot.robotAdminPage.nothingDelegatedText') }}
      template(#cell-state='{ row }')
        BaseBadge(:variant='keyVariant(row)') {{ keyLabel(row) }}
        .q-mt-xs(v-if='isMe(row.member) && !keyReady(row)')
          BaseButton(variant='ghost', size='sm', @click='goToMyDecisions') {{ $t('robot.robotAdminPage.transferKeyButton') }}
        .t-sm.t-muted(v-else-if='!keyReady(row) && row.chain_has_permission') {{ $t('robot.robotAdminPage.selfTransferText') }}
      template(#cell-updated='{ row }')
        span(v-if='row.updated_at') {{ formatWhen(row.updated_at) }}
        span.t-muted(v-else) —

  BaseCard(:title='$t("robot.robotAdminPage.failedCardTitle")', :subtitle='$t("robot.robotAdminPage.failedCardSubtitle")')
    BaseTable(:columns='failedColumns', :rows='failed', row-key='id', :loading='loadingJournal && !failed.length')
      template(#cell-decision='{ row }')
        .doc-primary №{{ row.decision_id }} · {{ typeTitle(row.decision_type) }}
        .t-sm.t-muted {{ $t('robot.robotAdminPage.attemptsCountText', { attempts: row.attempts }) }}
      template(#cell-error='{ row }')
        span.text-negative {{ row.last_error || '—' }}
      template(#cell-actions='{ row }')
        BaseButton(variant='secondary', size='sm', :loading='retrying === row.decision_id', @click='retry(row.decision_id)') {{ $t('common.action.retry') }}
    EmptyState(v-if='!loadingJournal && !failed.length', :title='$t("robot.robotAdminPage.noFailedTitle")', :body='$t("robot.robotAdminPage.noFailedBody")')
      template(#icon)
        q-icon(name='task_alt', size='48px')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { uiLocale } from 'src/shared/i18n';
import { useRoute, useRouter } from 'vue-router';
import { useSessionStore } from 'src/entities/Session';
import { useDismissibleBanner } from 'src/shared/hooks/useDismissibleBanner';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseBadge, BaseButton, BaseCard, BaseTable, EmptyState } from 'src/shared/ui/base';
import type { BaseTableColumn } from 'src/shared/ui/base';
import { robotApi, useRobotStore } from '../../../entities/robot';
import type { IRobotDecision, IRobotKeyStatus } from '../../../entities/robot';
import { t } from '../../../i18n';

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const robotStore = useRobotStore();
const { dismissed, dismiss } = useDismissibleBanner('robot:admin:banner-dismissed');

const loadingKeys = ref(true);
const loadingJournal = ref(true);
const retrying = ref<number | null>(null);

const keys = computed<IRobotKeyStatus[]>(() => robotStore.keys);
const failed = computed<IRobotDecision[]>(() => (robotStore.journal?.items ?? []).filter((item) => String(item.stage).toLowerCase() === 'failed'));

const keyColumns: BaseTableColumn<IRobotKeyStatus>[] = [
  { key: 'member', label: t('robot.robotAdminPage.memberColumn'), width: '220px' },
  { key: 'voting', label: t('robot.robotAdminPage.votingColumn') },
  { key: 'state', label: t('robot.robotAdminPage.stateColumn'), width: '200px' },
  { key: 'updated', label: t('robot.robotAdminPage.updatedColumn'), width: '160px', nowrap: true },
];

/** Что член совета доверил роботу: «Сразу», «Как ‹имя›», подпись протоколов. */
interface DelegationLine {
  label: string;
  what: string;
}

/** Названия решений строкой: длинный список схлопываем, чтобы не разносило таблицу. */
function listTitles(titles: string[]): string {
  const shown = titles.slice(0, 3).join(', ');
  return titles.length > 3 ? t('robot.robotAdminPage.moreTitlesText', { shown, restCount: titles.length - 3 }) : shown;
}

/** Голоса, доверенные роботу: член совета → режим → названия решений. */
function collectVotes(): Record<string, Record<string, string[]>> {
  const votes: Record<string, Record<string, string[]>> = {};
  for (const row of robotStore.registry)
    for (const voter of row.voters) {
      const label = voter.follow ? t('robot.robotAdminPage.followVoteText', { memberName: robotStore.shortMemberName(voter.follow) }) : t('robot.robotAdminPage.immediateVoteText');
      ((votes[voter.member] ??= {})[label] ??= []).push(row.title);
    }
  return votes;
}

/** Протоколы, которые робот подписывает за председателя. */
function collectProtocols(): Record<string, string[]> {
  const protocols: Record<string, string[]> = {};
  for (const row of robotStore.registry)
    if (row.chairman.delegated && row.chairman.username) (protocols[row.chairman.username] ??= []).push(row.title);
  return protocols;
}

/**
 * Кто что доверил роботу — из общего реестра действий автоматизации: он уже
 * несёт по каждому решению список делегировавших с их режимом.
 */
const delegationByMember = computed<Record<string, DelegationLine[]>>(() => {
  const result: Record<string, DelegationLine[]> = {};
  for (const [member, byLabel] of Object.entries(collectVotes()))
    result[member] = Object.entries(byLabel).map(([label, titles]) => ({ label, what: listTitles(titles) }));
  for (const [member, titles] of Object.entries(collectProtocols()))
    (result[member] ??= []).push({ label: t('robot.robotAdminPage.signsProtocolsText'), what: listTitles(titles) });
  return result;
});

function delegationOf(member: string): DelegationLine[] {
  return delegationByMember.value[member] ?? [];
}

function isMe(member: string): boolean {
  return member === session.username;
}

function keyReady(row: IRobotKeyStatus): boolean {
  return row.has_key && row.chain_key_matches;
}

/** Когда робот получил ключ — датой и временем, без секунд. */
function formatWhen(value: string | Date): string {
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? '—' : at.toLocaleString(uiLocale(), { dateStyle: 'short', timeStyle: 'short' });
}

const failedColumns: BaseTableColumn<IRobotDecision>[] = [
  { key: 'decision', label: t('robot.robotAdminPage.decisionColumn') },
  { key: 'error', label: t('robot.robotAdminPage.errorColumn') },
  { key: 'actions', label: '', width: '140px', align: 'right' },
];

function keyVariant(row: IRobotKeyStatus): 'pos' | 'warn' | 'neutral' | 'neg' {
  if (keyReady(row)) return 'pos';
  if (row.has_key) return 'neg';
  if (row.chain_has_permission) return 'warn';
  return 'neutral';
}

function keyLabel(row: IRobotKeyStatus): string {
  if (keyReady(row)) return t('robot.robotAdminPage.keyVotingLabel');
  if (row.has_key) return t('robot.robotAdminPage.keyStaleLabel');
  if (row.chain_has_permission) return t('robot.robotAdminPage.keyMissingLabel');
  return t('robot.robotAdminPage.keyNotDelegatedLabel');
}

function typeTitle(type: string): string {
  return robotStore.titleByType[type] ?? type;
}

/** Свой ключ председатель передаёт там же, где и все, — на странице действий автоматизации. */
function goToMyDecisions() {
  router.push({ name: 'robot-registry', params: { coopname: route.params.coopname } });
}

async function retry(decisionId: number) {
  retrying.value = decisionId;
  try {
    await robotApi.retryDecision({ decision_id: decisionId });
    await robotStore.loadJournal({ options: { page: 1, limit: 100, sortBy: 'decision_id', sortOrder: 'DESC' } });
    SuccessAlert(t('robot.robotAdminPage.retrySuccessText'));
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    retrying.value = null;
  }
}

onMounted(async () => {
  try {
    // Состав совета — источник ФИО; реестр автоматизаций — кто что доверил роботу.
    if (!robotStore.council) await robotStore.loadCouncil();
    if (!robotStore.registry.length) await robotStore.loadRegistry();
  } catch {
    // имена и названия решений — украшение, без них страница всё равно работает
  }
  try {
    await robotStore.loadKeys();
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loadingKeys.value = false;
  }
  try {
    await robotStore.loadJournal({ options: { page: 1, limit: 100, sortBy: 'decision_id', sortOrder: 'DESC' } });
  } catch (e: unknown) {
    FailAlert(e);
  } finally {
    loadingJournal.value = false;
  }
});
</script>
