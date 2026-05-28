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
  .command-palette(role='dialog', aria-label='Поиск рабочих столов и страниц')
    header.command-palette__search
      q-icon.command-palette__search-icon(name='search', size='18px')
      input.command-palette__input(
        ref='inputRef',
        v-model='query',
        type='text',
        :placeholder='placeholder ?? "Поиск рабочих столов и страниц…"',
        autocomplete='off',
        spellcheck='false',
        @keydown.down.prevent='moveSelection(1)',
        @keydown.up.prevent='moveSelection(-1)',
        @keydown.enter.prevent='executeActive'
      )
      button.command-palette__close(
        type='button',
        aria-label='Закрыть',
        @click='close'
      )
        q-icon(name='close', size='18px')

    .command-palette__results(ref='resultsRef')
      //- режим без query — иерархия с sticky активным workspace
      template(v-if='!isSearchMode')
        template(v-for='ws in workspaces', :key='ws.name')
          .command-palette__workspace(
            :class='{ "is-active": ws.isActive, "is-sticky": ws.isActive }'
          )
            button.command-palette__workspace-row(
              type='button',
              :class='{ "is-selected": activeKey === workspaceKey(ws) }',
              @click='selectWorkspace(ws)',
              @mouseenter='activeKey = workspaceKey(ws)'
            )
              q-icon.command-palette__workspace-icon(:name='ws.icon', size='20px')
              span.command-palette__workspace-title {{ ws.title }}
              span.command-palette__workspace-badge(v-if='ws.isActive') {{ activeLabel ?? 'Активный' }}
          ul.command-palette__pages(v-if='ws.pages.length')
            li(v-for='page in ws.pages', :key='page.name')
              button.command-palette__page(
                type='button',
                :class='{ "is-selected": activeKey === pageKey(ws, page) }',
                @click='selectPage(ws, page)',
                @mouseenter='activeKey = pageKey(ws, page)'
              )
                q-icon.command-palette__page-icon(:name='page.icon ?? "circle"', size='18px')
                span.command-palette__page-title {{ page.title }}
                kbd.command-palette__page-shortcut(v-if='page.shortcut') {{ page.shortcut }}

      //- режим поиска — плоский список (workspace + page с префиксом стола)
      template(v-else-if='flatSearchResults.length')
        ul.command-palette__flat(role='listbox')
          li.command-palette__flat-item(
            v-for='entry in flatSearchResults',
            :key='entry.key',
            :class='{ "is-selected": activeKey === entry.key, "is-workspace": entry.kind === "workspace" }',
            role='option',
            :aria-selected='activeKey === entry.key',
            @click='executeEntry(entry)',
            @mouseenter='activeKey = entry.key'
          )
            q-icon.command-palette__flat-icon(
              :name='entry.kind === "workspace" ? entry.workspace.icon : entry.page.icon ?? entry.workspace.icon',
              size='18px'
            )
            .command-palette__flat-text
              .command-palette__flat-workspace(v-if='entry.kind === "page"') {{ entry.workspace.title }}
              .command-palette__flat-title
                | {{ entry.kind === 'workspace' ? entry.workspace.title : entry.page.title }}
                span.command-palette__workspace-badge(
                  v-if='entry.kind === "workspace" && entry.workspace.isActive'
                ) {{ activeLabel ?? 'Активный' }}
            kbd.command-palette__page-shortcut(v-if='entry.kind === "page" && entry.page.shortcut') {{ entry.page.shortcut }}

      .command-palette__empty(v-else)
        EmptyState(title='Ничего не найдено', body='Попробуйте другой запрос')

    footer.command-palette__footer
      span.command-palette__hint
        kbd ↑
        kbd ↓
        | для навигации
      span.command-palette__hint
        kbd ↵ Enter
        | для выбора
      span.command-palette__hint
        kbd Esc
        | для закрытия
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
const inputRef = ref<HTMLInputElement | null>(null);
const resultsRef = ref<HTMLElement | null>(null);

const isSearchMode = computed<boolean>(() => query.value.trim().length > 0);

function workspaceKey(ws: CommandPaletteWorkspace): string {
  return `ws:${ws.name}`;
}
function pageKey(ws: CommandPaletteWorkspace, page: CommandPalettePage): string {
  return `page:${ws.name}:${page.name}`;
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

/** Иерархический flat-список (для управления клавишами в режиме без поиска) */
const hierarchyFlat = computed<FlatEntry[]>(() => {
  const result: FlatEntry[] = [];
  for (const ws of props.workspaces) {
    result.push({ kind: 'workspace', key: workspaceKey(ws), workspace: ws });
    for (const page of ws.pages) {
      result.push({ kind: 'page', key: pageKey(ws, page), workspace: ws, page });
    }
  }
  return result;
});

/** Плоский поиск: workspace показываем только если query явно ищет стол */
const flatSearchResults = computed<FlatEntry[]>(() => {
  const q = query.value.toLowerCase().trim();
  if (!q) return [];

  const isSearchingWorkspaces =
    q.includes('стол') ||
    q.includes('workspace') ||
    props.workspaces.some(
      (ws) =>
        ws.title.toLowerCase().startsWith(q) ||
        ws.name.toLowerCase().startsWith(q),
    );

  const result: FlatEntry[] = [];
  for (const ws of props.workspaces) {
    if (isSearchingWorkspaces) {
      const wsMatches =
        ws.title.toLowerCase().startsWith(q) || ws.name.toLowerCase().startsWith(q);
      if (wsMatches) {
        result.push({ kind: 'workspace', key: workspaceKey(ws), workspace: ws });
      }
    }
    for (const page of ws.pages) {
      if (
        page.title.toLowerCase().includes(q) ||
        page.name.toLowerCase().includes(q)
      ) {
        result.push({ kind: 'page', key: pageKey(ws, page), workspace: ws, page });
      }
    }
  }
  return result;
});

const activeList = computed<FlatEntry[]>(() =>
  isSearchMode.value ? flatSearchResults.value : hierarchyFlat.value,
);

watch(query, () => {
  const list = activeList.value;
  activeKey.value = list[0]?.key ?? '';
});

watch(
  () => props.modelValue,
  (next) => {
    if (next) {
      query.value = '';
      activeKey.value = '';
    }
  },
);

watch(activeList, (list) => {
  if (!list.find((e) => e.key === activeKey.value)) {
    activeKey.value = list[0]?.key ?? '';
  }
}, { immediate: true });

function moveSelection(delta: number): void {
  const list = activeList.value;
  if (!list.length) return;
  const currentIdx = list.findIndex((e) => e.key === activeKey.value);
  const safe = currentIdx === -1 ? 0 : currentIdx;
  const next = (safe + delta + list.length) % list.length;
  activeKey.value = list[next].key;
  nextTick(() => scrollActiveIntoView());
}

function scrollActiveIntoView(): void {
  if (!resultsRef.value) return;
  const el = resultsRef.value.querySelector('.is-selected');
  if (el && 'scrollIntoView' in el) {
    (el as HTMLElement).scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function executeActive(): void {
  const list = activeList.value;
  const entry = list.find((e) => e.key === activeKey.value) ?? list[0];
  if (!entry) return;
  executeEntry(entry);
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
    activeKey.value = activeList.value[0]?.key ?? '';
  });
}

function onHide(): void {
  query.value = '';
  activeKey.value = '';
}
</script>

<style scoped>
.command-palette {
  display: flex;
  flex-direction: column;
  width: min(640px, 92vw);
  margin-top: 64px;
  max-height: calc(100vh - 128px);
  background: var(--p-surface);
  color: var(--p-ink);
  border-radius: var(--p-r-md, 12px);
  box-shadow: var(--p-elev-3);
  overflow: hidden;
}

.command-palette__search {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-bottom: 1px solid var(--p-line);
  flex: 0 0 auto;
}

.command-palette__search-icon {
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__input {
  flex: 1 1 auto;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--p-ink);
  font-size: var(--p-fs-h6, 16px);
  line-height: var(--p-lh-h6, 1.4);
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
  border-radius: var(--p-r-sm, 8px);
  background: transparent;
  color: var(--p-ink-3);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.command-palette__close:hover {
  background: var(--p-surface-2);
  color: var(--p-ink);
}

.command-palette__results {
  flex: 1 1 auto;
  overflow-y: auto;
  padding-bottom: var(--p-2, 8px);
}

/* ===== Hierarchy ===== */
.command-palette__workspace {
  background: var(--p-surface);
}
.command-palette__workspace.is-sticky {
  position: sticky;
  top: 0;
  z-index: 1;
}

.command-palette__workspace-row {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  width: 100%;
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border: 0;
  background: var(--p-surface);
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--p-fs-body, 14px);
  font-weight: 500;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.command-palette__workspace.is-active .command-palette__workspace-row {
  background: var(--p-accent-soft, var(--p-primary-soft));
}
.command-palette__workspace-row:hover,
.command-palette__workspace-row.is-selected {
  background: var(--p-surface-2);
}
.command-palette__workspace.is-active .command-palette__workspace-row.is-selected {
  background: var(--p-accent-soft, var(--p-primary-soft));
  outline: 2px solid var(--p-accent, var(--p-primary));
  outline-offset: -2px;
}

.command-palette__workspace-icon {
  color: var(--p-accent, var(--p-primary));
  flex: 0 0 auto;
}

.command-palette__workspace-title {
  flex: 1 1 auto;
  font-weight: 600;
  color: var(--p-ink);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__workspace-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--p-accent, var(--p-primary));
  color: var(--p-ink-on-accent, var(--p-ink-on-primary, #fff));
  font-size: var(--p-fs-caption, 11px);
  font-weight: 600;
  flex: 0 0 auto;
}

.command-palette__pages {
  list-style: none;
  margin: 0;
  padding: 0;
  background: var(--p-surface);
}

.command-palette__page {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  width: 100%;
  padding: var(--p-2, 8px) var(--p-4, 16px) var(--p-2, 8px) calc(var(--p-4, 16px) + 28px);
  border: 0;
  background: transparent;
  color: var(--p-ink-2);
  cursor: pointer;
  text-align: left;
  font-family: inherit;
  font-size: var(--p-fs-body, 14px);
  line-height: var(--p-lh-body, 1.5);
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard), color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.command-palette__page:hover,
.command-palette__page.is-selected {
  background: var(--p-surface-2);
  color: var(--p-ink);
}
.command-palette__page.is-selected {
  outline: 2px solid var(--p-accent, var(--p-primary));
  outline-offset: -2px;
}

.command-palette__page-icon {
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__page-title {
  flex: 1 1 auto;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__page-shortcut {
  padding: 2px 6px;
  border: 1px solid var(--p-line);
  border-radius: 4px;
  background: var(--p-surface-2);
  color: var(--p-ink-2);
  font-family: var(--p-mono);
  font-size: var(--p-fs-caption, 11px);
  font-weight: 500;
}

/* ===== Flat search ===== */
.command-palette__flat {
  list-style: none;
  margin: 0;
  padding: var(--p-2, 8px) 0;
}

.command-palette__flat-item {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: var(--p-2, 8px) var(--p-4, 16px);
  cursor: pointer;
  transition: background var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.command-palette__flat-item.is-workspace {
  background: var(--p-surface-2);
}
.command-palette__flat-item:hover,
.command-palette__flat-item.is-selected {
  background: var(--p-accent-soft, var(--p-primary-soft));
}
.command-palette__flat-item.is-selected {
  outline: 2px solid var(--p-accent, var(--p-primary));
  outline-offset: -2px;
}

.command-palette__flat-icon {
  color: var(--p-accent, var(--p-primary));
  flex: 0 0 auto;
}

.command-palette__flat-text {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-width: 0;
}

.command-palette__flat-workspace {
  font-size: var(--p-fs-caption, 11px);
  color: var(--p-ink-3);
  text-transform: none;
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.command-palette__flat-title {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
  font-size: var(--p-fs-body, 14px);
  color: var(--p-ink);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ===== Empty / footer ===== */
.command-palette__empty {
  padding: var(--p-6, 24px) var(--p-4, 16px);
}

.command-palette__footer {
  display: flex;
  align-items: center;
  gap: var(--p-4, 16px);
  padding: var(--p-2, 8px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface);
  font-size: var(--p-fs-caption, 12px);
  color: var(--p-ink-3);
  flex: 0 0 auto;
}

.command-palette__hint {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1, 4px);
}
.command-palette__hint kbd {
  padding: 2px 6px;
  border: 1px solid var(--p-line);
  border-radius: 4px;
  background: var(--p-surface-2);
  color: var(--p-ink-2);
  font-family: var(--p-mono);
  font-size: var(--p-fs-caption, 11px);
  font-weight: 500;
}
</style>
