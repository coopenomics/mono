<template lang="pug">
q-dialog(
  :model-value='modelValue',
  position='top',
  transition-show='slide-down',
  transition-hide='slide-up',
  @update:model-value='(v) => emit("update:modelValue", v)',
  @show='onShow',
  @hide='onHide'
)
  .command-palette(role='dialog', :aria-label='$t("ui.commandPalette.searchAriaLabel")')
    header.command-palette__search
      q-icon.command-palette__search-icon(name='search', size='18px')
      input.command-palette__input(
        ref='inputRef',
        v-model='query',
        type='text',
        :placeholder='placeholder ?? $t("ui.commandPalette.searchPlaceholder")',
        autocomplete='off',
        spellcheck='false',
        @keydown.down.prevent='moveSelection(1)',
        @keydown.up.prevent='moveSelection(-1)',
        @keydown.right='onArrowRight',
        @keydown.left='onArrowLeft',
        @keydown.enter.prevent='executeActive'
      )
      button.command-palette__close(
        type='button',
        :aria-label='$t("common.action.close")',
        @click='close'
      )
        q-icon(name='close', size='18px')

    .command-palette__columns(ref='resultsRef', :class='{ "is-search": isSearchMode }')
      //- слева — столы: сначала столы приложений с одним столом, ниже
      //- приложения с несколькими столами под своим заголовком
      nav.command-palette__desks
        template(v-for='group in deskGroups', :key='group.key')
          .command-palette__group-title(v-if='group.title') {{ group.title }}
          button.command-palette__desk(
            v-for='ws in group.workspaces',
            :key='ws.name',
            type='button',
            :class='{ "is-active": ws.isActive, "is-focused": focusedName === ws.name, "is-selected": !isSearchMode && column === "desks" && focusedName === ws.name }',
            @click='selectWorkspace(ws)',
            @mouseenter='onDeskHover(ws)'
          )
            q-icon.command-palette__desk-icon(:name='ws.icon', size='18px')
            span.command-palette__desk-title {{ ws.title }}
            span.command-palette__desk-app(v-if='!group.title && appLabel(ws)') {{ appLabel(ws) }}
            q-icon.command-palette__desk-check(v-if='ws.isActive', name='check', size='18px')

      .command-palette__pane
        //- без запроса — страницы стола, выбранного слева
        template(v-if='!isSearchMode && focusedWorkspace')
          .command-palette__pane-head
            q-icon.command-palette__pane-icon(:name='focusedWorkspace.icon', size='20px')
            span.command-palette__pane-title {{ focusedWorkspace.title }}
            span.command-palette__app-badge(v-if='appLabel(focusedWorkspace)') {{ appLabel(focusedWorkspace) }}
            span.command-palette__workspace-badge(v-if='focusedWorkspace.isActive') {{ activeLabel ?? $t('ui.commandPalette.activeLabel') }}
            button.command-palette__go(
              v-if='!focusedWorkspace.isActive',
              type='button',
              @click='selectWorkspace(focusedWorkspace)'
            ) {{ $t('ui.commandPalette.goToWorkspace') }}
          ul.command-palette__pages(v-if='focusedWorkspace.pages.length')
            li(v-for='page in focusedWorkspace.pages', :key='page.name')
              button.command-palette__page(
                type='button',
                :class='{ "is-selected": column === "pages" && activeKey === pageKey(focusedWorkspace, page) }',
                @click='selectPage(focusedWorkspace, page)',
                @mouseenter='onPageHover(focusedWorkspace, page)'
              )
                q-icon.command-palette__page-icon(:name='page.icon ?? "circle"', size='18px')
                span.command-palette__page-title {{ page.title }}
                kbd.command-palette__page-shortcut(v-if='page.shortcut') {{ page.shortcut }}
          .command-palette__empty(v-else)
            EmptyState(:title='$t("ui.commandPalette.noPagesTitle")')

        //- с запросом — столы и страницы, у каждой строки подписаны стол и приложение
        template(v-else-if='searchResults.length')
          ul.command-palette__flat(role='listbox')
            template(v-for='(entry, index) in searchResults', :key='entry.key')
              li.command-palette__group-title(v-if='isSectionStart(index)')
                | {{ entry.kind === 'workspace' ? $t('ui.commandPalette.workspacesSection') : $t('ui.commandPalette.pagesSection') }}
              li.command-palette__flat-item(
                :class='{ "is-selected": activeKey === entry.key }',
                role='option',
                :aria-selected='activeKey === entry.key',
                @click='executeEntry(entry)',
                @mouseenter='activeKey = entry.key'
              )
                q-icon.command-palette__flat-icon(
                  :name='entry.kind === "workspace" ? entry.workspace.icon : entry.page.icon ?? entry.workspace.icon',
                  size='18px'
                )
                span.command-palette__flat-title {{ entry.kind === 'workspace' ? entry.workspace.title : entry.page.title }}
                span.command-palette__flat-crumb {{ crumb(entry) }}

        .command-palette__empty(v-else)
          EmptyState(:title='$t("ui.commandPalette.emptyTitle")', :body='$t("ui.commandPalette.emptyBody")')

    footer.command-palette__footer
      span.command-palette__hint
        kbd ↑
        kbd ↓
        | {{ $t('ui.commandPalette.navigateHint') }}
      span.command-palette__hint
        kbd →
        | {{ $t('ui.commandPalette.pagesHint') }}
      span.command-palette__hint
        kbd ↵ Enter
        | {{ $t('ui.commandPalette.selectHint') }}
      span.command-palette__hint
        kbd Esc
        | {{ $t('ui.commandPalette.closeHint') }}
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import { EmptyState } from 'src/shared/ui/base/EmptyState';
import type {
  CommandPalettePage,
  CommandPaletteProps,
  CommandPaletteWorkspace,
} from './CommandPalette.types';

const props = defineProps<CommandPaletteProps>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'select-workspace': [workspaceName: string];
  'select-page': [workspaceName: string, pageName: string];
}>();

const query = ref('');
const activeKey = ref<string>('');
// Стол, выбранный в левой колонке: его страницы показаны справа.
const focusedName = ref<string>('');
// Колонка, по которой ходят стрелки, пока запрос пуст.
const column = ref<'desks' | 'pages'>('desks');
const inputRef = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);

const isSearchMode = computed<boolean>(() => query.value.trim().length > 0);

function workspaceKey(ws: CommandPaletteWorkspace): string {
  return `ws:${ws.name}`;
}
function pageKey(ws: CommandPaletteWorkspace, page: CommandPalettePage): string {
  return `page:${ws.name}:${page.name}`;
}

interface DeskGroup {
  key: string;
  /** Заголовок группы — название приложения; у общего списка заголовка нет */
  title: string;
  workspaces: CommandPaletteWorkspace[];
}

/**
 * Свой заголовок получает приложение с несколькими столами. Столы остальных
 * приложений идут первым общим списком: у них название приложения обычно
 * совпадает с названием стола, и заголовок над одной строкой его бы повторял.
 */
const deskGroups = computed<DeskGroup[]>(() => {
  const byApp = new Map<string, CommandPaletteWorkspace[]>();
  for (const ws of props.workspaces) {
    const key = ws.appName ?? workspaceKey(ws);
    byApp.set(key, [...(byApp.get(key) ?? []), ws]);
  }
  const common: DeskGroup = { key: 'common', title: '', workspaces: [] };
  const apps: DeskGroup[] = [];
  for (const [key, list] of byApp) {
    if (list.length > 1) {
      apps.push({ key, title: list[0].appTitle ?? key, workspaces: list });
    } else {
      common.workspaces.push(list[0]);
    }
  }
  return [common, ...apps].filter((g) => g.workspaces.length);
});

/** Столы в том порядке, в каком они стоят в левой колонке */
const deskList = computed<CommandPaletteWorkspace[]>(() =>
  deskGroups.value.flatMap((g) => g.workspaces),
);

const focusedWorkspace = computed<CommandPaletteWorkspace | undefined>(
  () => deskList.value.find((ws) => ws.name === focusedName.value) ?? deskList.value[0],
);

/** Название приложения показываем, когда оно отличается от названия стола */
function appLabel(ws: CommandPaletteWorkspace): string {
  const app = ws.appTitle?.trim() ?? '';
  return app && app.toLowerCase() !== ws.title.trim().toLowerCase() ? app : '';
}

interface FlatEntryWorkspace {
  kind: 'workspace';
  key: string;
  workspace: CommandPaletteWorkspace;
}
interface FlatEntryPage {
  kind: 'page';
  key: string;
  workspace: CommandPaletteWorkspace;
  page: CommandPalettePage;
}
type FlatEntry = FlatEntryWorkspace | FlatEntryPage;

/** Результаты поиска: сначала столы, затем страницы */
const searchResults = computed<FlatEntry[]>(() => {
  const q = query.value.toLowerCase().trim();
  if (!q) return [];

  const desks: FlatEntry[] = [];
  const pages: FlatEntry[] = [];
  for (const ws of deskList.value) {
    if (
      ws.title.toLowerCase().includes(q) ||
      ws.name.toLowerCase().includes(q) ||
      (ws.appTitle ?? '').toLowerCase().includes(q)
    ) {
      desks.push({ kind: 'workspace', key: workspaceKey(ws), workspace: ws });
    }
    for (const page of ws.pages) {
      if (page.title.toLowerCase().includes(q) || page.name.toLowerCase().includes(q)) {
        pages.push({ kind: 'page', key: pageKey(ws, page), workspace: ws, page });
      }
    }
  }
  return [...desks, ...pages];
});

function isSectionStart(index: number): boolean {
  const list = searchResults.value;
  return index === 0 || list[index - 1].kind !== list[index].kind;
}

/** Подпись справа от найденной строки: чей это стол и чья страница */
function crumb(entry: FlatEntry): string {
  const app = appLabel(entry.workspace);
  if (entry.kind === 'workspace') return app;
  return app ? `${entry.workspace.title} · ${app}` : entry.workspace.title;
}

function resetBrowse(): void {
  column.value = 'desks';
  activeKey.value = '';
  focusedName.value =
    deskList.value.find((ws) => ws.isActive)?.name ?? deskList.value[0]?.name ?? '';
}

watch(query, () => {
  if (isSearchMode.value) {
    activeKey.value = searchResults.value[0]?.key ?? '';
  } else {
    column.value = 'desks';
    activeKey.value = '';
  }
});

watch(
  () => props.modelValue,
  (next) => {
    if (next) {
      query.value = '';
      resetBrowse();
    }
  },
);

function clamp(index: number, length: number): number {
  return Math.max(0, Math.min(length - 1, index));
}

function moveSelection(delta: number): void {
  if (isSearchMode.value) {
    const list = searchResults.value;
    if (!list.length) return;
    const current = list.findIndex((e) => e.key === activeKey.value);
    // На верхней и нижней позиции курсор остаётся на месте, как в нативных списках.
    const next = current === -1 ? (delta > 0 ? 0 : list.length - 1) : clamp(current + delta, list.length);
    activeKey.value = list[next].key;
  } else if (column.value === 'pages' && focusedWorkspace.value) {
    const ws = focusedWorkspace.value;
    if (!ws.pages.length) return;
    const current = ws.pages.findIndex((p) => pageKey(ws, p) === activeKey.value);
    activeKey.value = pageKey(ws, ws.pages[clamp(current + delta, ws.pages.length)]);
  } else {
    const list = deskList.value;
    if (!list.length) return;
    const current = list.findIndex((ws) => ws.name === focusedWorkspace.value?.name);
    focusedName.value = list[clamp(current + delta, list.length)].name;
  }
  nextTick(() => scrollActiveIntoView());
}

// Стрелки вправо и влево переводят курсор между колонками, пока запрос пуст;
// при наборе запроса они двигают каретку в поле, как обычно.
function onArrowRight(event: KeyboardEvent): void {
  if (isSearchMode.value || column.value === 'pages') return;
  const ws = focusedWorkspace.value;
  if (!ws?.pages.length) return;
  event.preventDefault();
  column.value = 'pages';
  activeKey.value = pageKey(ws, ws.pages[0]);
}

function onArrowLeft(event: KeyboardEvent): void {
  if (isSearchMode.value || column.value === 'desks') return;
  event.preventDefault();
  column.value = 'desks';
  activeKey.value = '';
}

function onDeskHover(ws: CommandPaletteWorkspace): void {
  if (isSearchMode.value) return;
  focusedName.value = ws.name;
  column.value = 'desks';
  activeKey.value = '';
}

function onPageHover(ws: CommandPaletteWorkspace, page: CommandPalettePage): void {
  column.value = 'pages';
  activeKey.value = pageKey(ws, page);
}

function scrollActiveIntoView(): void {
  if (!resultsRef.value) return;
  const el = resultsRef.value.querySelector('.is-selected');
  if (el && 'scrollIntoView' in el) {
    (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function executeActive(): void {
  if (isSearchMode.value) {
    const list = searchResults.value;
    const entry = list.find((e) => e.key === activeKey.value) ?? list[0];
    if (entry) executeEntry(entry);
    return;
  }
  const ws = focusedWorkspace.value;
  if (!ws) return;
  const page =
    column.value === 'pages' ? ws.pages.find((p) => pageKey(ws, p) === activeKey.value) : undefined;
  if (page) selectPage(ws, page);
  else selectWorkspace(ws);
}

function executeEntry(entry: FlatEntry): void {
  if (entry.kind === 'workspace') {
    selectWorkspace(entry.workspace);
  } else {
    selectPage(entry.workspace, entry.page);
  }
}

function selectWorkspace(ws: CommandPaletteWorkspace): void {
  emit('update:modelValue', false);
  emit('select-workspace', ws.name);
}

function selectPage(ws: CommandPaletteWorkspace, page: CommandPalettePage): void {
  emit('update:modelValue', false);
  emit('select-page', ws.name, page.name);
}

function close(): void {
  emit('update:modelValue', false);
}

function onShow(): void {
  nextTick(() => {
    inputRef.value?.focus();
    resetBrowse();
    nextTick(() => scrollActiveIntoView());
  });
}

function onHide(): void {
  query.value = '';
  activeKey.value = '';
}
</script>

<style scoped>
/* Размер окна постоянный: смена стола слева и набор запроса меняют только
   содержимое колонок, само окно стоит на месте. */
.command-palette {
  display: flex;
  flex-direction: column;
  width: min(820px, 94vw);
  /* Quasar ограничивает содержимое диалога шириной 560px — снимаем предел,
     иначе две колонки ужимаются и название стола обрезается. */
  max-width: none !important;
  height: min(620px, calc(100vh - 128px));
  margin-top: 64px;
  background: var(--p-surface);
  color: var(--p-ink);
  border-radius: var(--p-r-md);
  box-shadow: var(--p-shadow-modal);
  overflow: hidden;
}

.command-palette__search {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-3) var(--p-4);
  border-bottom: 1px solid var(--p-line);
  flex: 0 0 auto;
}

.command-palette__search-icon {
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__input {
  flex: 1 1 auto;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--p-ink);
  font-size: var(--p-fs-h3);
  line-height: var(--p-lh-h3);
  font-family: inherit;
}
.command-palette__input::placeholder {
  color: var(--p-ink-3);
}

.command-palette__close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: var(--p-r-sm);
  background: transparent;
  color: var(--p-ink-3);
  cursor: pointer;
  transition: background var(--p-dur-fast) var(--p-ease-standard);
}
.command-palette__close:hover {
  background: var(--p-surface-2);
  color: var(--p-ink);
}

/* ===== Колонки ===== */
.command-palette__columns {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
}

.command-palette__desks {
  flex: 0 0 300px;
  width: 300px;
  padding: var(--p-2);
  border-right: 1px solid var(--p-line);
  overflow-y: auto;
}

.command-palette__pane {
  flex: 1 1 auto;
  min-width: 0;
  padding: var(--p-3);
  overflow-y: auto;
}

.command-palette__group-title {
  padding: var(--p-3) var(--p-3) var(--p-1);
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 500;
  color: var(--p-ink-3);
  list-style: none;
}

/* ===== Строка стола ===== */
.command-palette__desk {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  width: 100%;
  padding: var(--p-2) var(--p-3);
  border: 0;
  border-radius: var(--p-r-sm);
  background: transparent;
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  transition: background var(--p-dur-fast) var(--p-ease-standard);
}
.command-palette__desk.is-focused {
  background: var(--p-surface-2);
}
.command-palette__desk.is-active {
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-weight: 500;
}
.command-palette__desk.is-selected {
  outline: 2px solid var(--p-primary);
  outline-offset: -2px;
}

.command-palette__desk-icon {
  color: var(--p-ink-2);
  flex: 0 0 auto;
}
.command-palette__desk.is-active .command-palette__desk-icon,
.command-palette__desk-check {
  color: var(--p-primary);
}
.command-palette__desk-check {
  flex: 0 0 auto;
}

.command-palette__desk-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__desk-app {
  flex: 0 0 auto;
  font-size: var(--p-fs-meta);
  font-weight: 400;
  color: var(--p-ink-3);
  white-space: nowrap;
}

/* ===== Шапка правой колонки ===== */
.command-palette__pane-head {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-height: 40px;
  padding: 0 var(--p-2) var(--p-2);
  margin-bottom: var(--p-2);
  border-bottom: 1px solid var(--p-line);
}

.command-palette__pane-icon {
  color: var(--p-primary);
  flex: 0 0 auto;
}

.command-palette__pane-title {
  min-width: 0;
  font-size: var(--p-fs-h3);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__workspace-badge,
.command-palette__app-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--p-2);
  border-radius: var(--p-r-pill);
  font-size: var(--p-fs-eyebrow);
  font-weight: 500;
  white-space: nowrap;
  flex: 0 0 auto;
}
.command-palette__workspace-badge {
  background: var(--p-primary-soft);
  color: var(--p-primary);
}
.command-palette__app-badge {
  background: var(--p-surface-3);
  color: var(--p-ink-2);
}

.command-palette__go {
  margin-left: auto;
  flex: 0 0 auto;
  height: 28px;
  padding: 0 var(--p-3);
  border: 0;
  border-radius: var(--p-r-xs);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-family: inherit;
  font-size: var(--p-fs-meta);
  font-weight: 500;
  cursor: pointer;
  transition: background var(--p-dur-fast) var(--p-ease-standard);
}
.command-palette__go:hover {
  background: var(--p-primary-line);
}

/* ===== Страницы стола и результаты поиска ===== */
.command-palette__pages,
.command-palette__flat {
  list-style: none;
  margin: 0;
  padding: 0;
}

.command-palette__page,
.command-palette__flat-item {
  display: flex;
  align-items: center;
  gap: var(--p-3);
  width: 100%;
  padding: var(--p-2) var(--p-3);
  border: 0;
  border-radius: var(--p-r-sm);
  background: transparent;
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
  transition: background var(--p-dur-fast) var(--p-ease-standard);
}
.command-palette__page:hover,
.command-palette__page.is-selected,
.command-palette__flat-item:hover,
.command-palette__flat-item.is-selected {
  background: var(--p-surface-2);
}
.command-palette__page.is-selected,
.command-palette__flat-item.is-selected {
  outline: 2px solid var(--p-primary);
  outline-offset: -2px;
}

.command-palette__page-icon,
.command-palette__flat-icon {
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__page-title,
.command-palette__flat-title {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__flat-crumb {
  flex: 0 1 auto;
  min-width: 0;
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__page-shortcut,
.command-palette__hint kbd {
  padding: 2px 6px;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-xs);
  background: var(--p-surface-2);
  color: var(--p-ink-2);
  font-family: var(--p-mono);
  font-size: var(--p-fs-eyebrow);
  font-weight: 500;
}

/* ===== Пусто и подвал ===== */
.command-palette__empty {
  padding: var(--p-6) var(--p-4);
}

.command-palette__footer {
  display: flex;
  align-items: center;
  gap: var(--p-4);
  padding: var(--p-2) var(--p-4);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface-2);
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  white-space: nowrap;
}

/* На узком экране колонка одна: без запроса — столы, с запросом — результаты. */
@media (max-width: 720px) {
  .command-palette__desks {
    flex: 1 1 auto;
    width: auto;
    border-right: 0;
  }
  /* Подсказки про клавиши на телефоне лишние: клавиатуры там нет. */
  .command-palette__pane,
  .command-palette__columns.is-search .command-palette__desks,
  .command-palette__footer {
    display: none;
  }
  .command-palette__columns.is-search .command-palette__pane {
    display: block;
  }
}
</style>
