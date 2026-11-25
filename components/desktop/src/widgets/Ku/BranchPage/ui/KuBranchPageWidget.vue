<template lang="pug">
//- Страница кооперативного участка. Зоны: строка роли — «кто я этому участку»;
//- вкладки — «что показать»; содержимое вкладки.
div
  .ku-branch-page__role(v-if='roleLabel')
    BaseChip(variant='pos')
      q-icon(name='verified_user', size='14px')
      span.q-ml-xs {{ roleLabel }}

  //- Полоса видна, только когда участок вовлечён хотя бы в одно приложение:
  //- одинокая вкладка «Участок» ничего не переключает.
  PageTabs(
    v-if='appTabs.length',
    :tabs='tabs',
    :active-key='activeKey',
    @select='onSelectTab'
  )

  component(
    :is='activeAppTab.component',
    v-if='activeAppTab',
    :key='activeAppTab.id',
    :braname='braname'
  )
  template(v-else)
    KuBranchDetailsWidget(:braname='braname')
    //- дополнение вкладки «Участок» от страницы: документы председателя на «Моём участке»
    slot
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBranchStore } from 'src/entities/Branch/model';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { KU_LIVE_TABLES } from 'src/entities/Ku/model';
import { useSessionStore } from 'src/entities/Session';
import { getBranchTabs, type BranchTabEntry } from 'src/shared/lib/branch-tabs';
import { useLiveReload, type ChainTableRef } from 'src/shared/lib/realtime';
import { BaseChip } from 'src/shared/ui/base';
import { PageTabs } from 'src/shared/ui/layout';
import type { PageTab } from 'src/shared/ui/layout';
import { KuBranchDetailsWidget } from 'src/widgets/Ku/BranchDetails';
import { t } from 'src/shared/i18n';

/**
 * Страница кооперативного участка: строка роли, вкладка «Участок» со сведениями
 * стола «Кооперативный участок» и вкладки приложений, в которые участок вовлечён.
 *
 * Границы. Вкладки приложений берутся из общего реестра (`shared/lib/branch-tabs`):
 * о Столе заказов и других приложениях страница ничего не знает. Вкладка
 * показывается при двух условиях: приложение установлено в кооперативе и само
 * подтвердило, что участок в нём участвует. Сведения участка, заявки и
 * документы рисует прежний `KuBranchDetailsWidget` без изменений.
 */
const props = defineProps<{ braname: string }>();

/** Ключ собственной вкладки стола; у вкладки приложения ключ — её `id` из реестра. */
const BRANCH_TAB = 'branch';

const route = useRoute();
const router = useRouter();
const branchStore = useBranchStore();
const desktop = useDesktopStore();
const session = useSessionStore();

interface BranchRoleSource {
  braname?: string;
  trustee_certificate?: { username?: string } | null;
  trusted_certificates?: Array<{ username?: string } | null> | null;
}

const branch = computed(
  () => (branchStore.publicBranches as BranchRoleSource[]).find((item) => item.braname === props.braname),
);

// Роль называется одна — старшая: председатель участка состоит и в его пайщиках.
const roleLabel = computed(() => {
  const username = session.username;
  if (!branch.value || !username) return '';
  if (branch.value.trustee_certificate?.username === username) return t('ku.kuBranchPageWidget.roleChairman');
  if ((branch.value.trusted_certificates ?? []).some((person) => person?.username === username)) {
    return t('ku.kuBranchPageWidget.roleTrusted');
  }
  if (session.currentUserAccount?.participant_account?.braname === props.braname) {
    return t('ku.kuBranchPageWidget.roleMember');
  }
  return '';
});

// Приложение установлено в кооперативе, если сервер отдал хотя бы один его стол.
const installedExtensions = computed(() => new Set(desktop.workspaceMenus.map((menu) => menu.extensionName)));
const candidateTabs = computed(() => getBranchTabs().filter((tab) => installedExtensions.value.has(tab.extension)));

/** Ответы приложений «участок вовлечён» по ключу вкладки. */
const involved = ref<Record<string, boolean>>({});
const appTabs = computed(() => candidateTabs.value.filter((tab) => involved.value[tab.id]));

async function resolveTabs(): Promise<void> {
  const braname = props.braname;
  if (!braname) return;
  const answers = await Promise.all(
    candidateTabs.value.map(async (tab): Promise<[string, boolean]> => {
      try {
        return [tab.id, await tab.isInvolved(braname)];
      } catch (e) {
        // Отказ приложения (нет права, приложение не подключено пайщику) — вкладки нет, страница участка цела.
        console.warn(`[ku] вкладка участка «${tab.id}» не подтвердила участие`, e);
        return [tab.id, false];
      }
    }),
  );
  // Ответ по прежнему участку после перехода на другой не применяется.
  if (braname === props.braname) involved.value = Object.fromEntries(answers);
}

const tabs = computed<PageTab[]>(() => [
  { key: BRANCH_TAB, label: t('ku.kuBranchPageWidget.branchTabLabel'), icon: 'home_work' },
  ...appTabs.value.map((tab) => ({ key: tab.id, label: tab.label, icon: tab.icon })),
]);

// Вкладка — в адресе (?tab=): ссылка открывает ту же вкладку. Незнакомый ключ
// и вкладка невовлечённого участка открывают «Участок».
const activeAppTab = computed<BranchTabEntry | undefined>(() =>
  appTabs.value.find((tab) => tab.id === String(route.query.tab ?? '')),
);
const activeKey = computed(() => activeAppTab.value?.id ?? BRANCH_TAB);

function onSelectTab(tab: PageTab): void {
  const query = { ...route.query };
  if (tab.key === BRANCH_TAB) delete query.tab;
  else query.tab = tab.key;
  void router.replace({ query });
}

// Таблицы ленты: участки стола и то, что объявили вкладки приложений, — без повторов.
function liveTables(): ChainTableRef[] {
  const refs = new Map<string, ChainTableRef>();
  [...KU_LIVE_TABLES, ...candidateTabs.value.flatMap((tab) => tab.liveTables ?? [])].forEach((ref) =>
    refs.set(`${ref.code}:${ref.table}`, ref),
  );
  return [...refs.values()];
}

// Вовлечённость живёт по ленте: участок подключили как пункт выдачи — вкладка показывается без перезагрузки.
useLiveReload(liveTables(), resolveTabs);

watch(() => props.braname, resolveTabs);
// Столы сервер отдаёт после входа: набор приложений мог измениться с момента открытия страницы.
// Сравнение — по составу кандидатов: пересчёт списка столов без смены состава запросов не даёт.
watch(() => candidateTabs.value.map((tab) => tab.id).join(','), resolveTabs);

onMounted(resolveTabs);
</script>

<style scoped>
.ku-branch-page__role {
  margin-bottom: var(--p-3);
}
</style>
