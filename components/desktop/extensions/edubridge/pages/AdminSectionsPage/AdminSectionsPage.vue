<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-sections:banner-dismissed")
    | {{ $t('edubridge.adminSectionsPage.hint.line1') }}

  .row.justify-end.q-mb-md(v-if="hasArchived")
    BaseCheckbox(v-model="showArchived") {{ $t('edubridge.adminSectionsPage.showArchived') }}

  CardListSkeleton(v-if="firstLoad" :count="2")
  EmptyState(v-else-if="!visible.length" :title="$t('edubridge.adminSectionsPage.emptyTitle')" :body="$t('edubridge.adminSectionsPage.emptyBody')")
    template(#icon)
      q-icon(name="category" size="32px")

  //- Раздел — карточка: заголовок с действиями, под ним уровни по порядку и добавление уровня.
  BaseCard.q-mb-md(v-for="(section, si) in visible" :key="String(section.id)" variant="default")
    .edu-sections__row.edu-sections__row--head
      .edu-sections__name
        .t-h3 {{ section.title }}
        BaseBadge(v-if="section.archived" variant="neutral") {{ $t('edubridge.adminSectionsPage.archivedBadge') }}
      SectionRowActions(
        :can-up="si > 0"
        :can-down="si < visible.length - 1"
        :archived="section.archived"
        :busy="busy"
        :up-label="$t('edubridge.adminSectionsPage.sectionUp')"
        :down-label="$t('edubridge.adminSectionsPage.sectionDown')"
        @up="moveSection(si, -1)"
        @down="moveSection(si, 1)"
        @rename="openRename('section', section.id, section.title)"
        @toggle="toggleSection(section)"
      )

    .edu-sections__levels(v-if="levelsOf(section).length")
      .edu-sections__row(v-for="(level, li) in levelsOf(section)" :key="String(level.id)")
        .edu-sections__name
          span.edu-sections__num.t-mono {{ li + 1 }}
          span {{ level.title }}
          BaseBadge(v-if="level.archived" variant="neutral") {{ $t('edubridge.adminSectionsPage.archivedBadge') }}
        SectionRowActions(
          :can-up="li > 0"
          :can-down="li < levelsOf(section).length - 1"
          :archived="level.archived"
          :busy="busy"
          :up-label="$t('edubridge.adminSectionsPage.levelUp')"
          :down-label="$t('edubridge.adminSectionsPage.levelDown')"
          @up="moveLevel(section, li, -1)"
          @down="moveLevel(section, li, 1)"
          @rename="openRename('level', level.id, level.title, section.id)"
          @toggle="toggleLevel(level)"
        )
    .t-muted.t-sm.q-mt-sm(v-else) {{ $t('edubridge.adminSectionsPage.noLevels') }}

    .q-mt-sm(v-if="!section.archived")
      BaseButton(variant="ghost" size="sm" :disabled="busy" @click="openCreateLevel(section)")
        template(#icon-left)
          q-icon(name="add" size="18px")
        | {{ $t('edubridge.adminSectionsPage.addLevel') }}

  BaseDialog(v-model="dialog.open" :title="dialogTitle" size="sm")
    BaseInput(v-model="dialog.title" :label="dialog.kind === 'level' ? $t('edubridge.adminSectionsPage.dialog.levelTitleLabel') : $t('edubridge.adminSectionsPage.dialog.sectionTitleLabel')" autofocus @keyup.enter="submitDialog")
    template(#footer)
      BaseButton(variant="ghost" :disabled="busy" @click="dialog.open = false") {{ $t('edubridge.adminSectionsPage.dialog.cancel') }}
      BaseButton(variant="primary" :disabled="!dialog.title.trim()" :loading="busy" @click="submitDialog") {{ $t('common.action.save') }}
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseCheckbox, BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import {
  archiveLevel,
  archiveSection,
  fetchSections,
  reorderLevels,
  reorderSections,
  saveLevel,
  saveSection,
  type ILevel,
  type ISection,
} from '../../entities/Section';
import { HeaderActionButton } from '../../shared/ui/HeaderActionButton';
import SectionRowActions from './SectionRowActions.vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Справочник разделов и уровней каталога (7DD-23). Разделы — карточками в их
 * порядке, уровни внутри — пронумерованной последовательностью. Всё, что здесь
 * меняется, сразу видно в форме курса и в каталоге.
 */
const sections = ref<ISection[]>([]);
const loading = ref(false);
const firstLoad = useFirstLoad(loading);
const busy = ref(false);
const showArchived = ref(false);
const dialog = reactive({ open: false, kind: 'section' as 'section' | 'level', id: null as string | null, sectionId: null as string | null, title: '' });

const hasArchived = computed(() => sections.value.some((s) => s.archived || s.levels.some((l) => l.archived)));
const visible = computed(() => sections.value.filter((s) => showArchived.value || !s.archived));
const levelsOf = (s: ISection): ILevel[] => s.levels.filter((l) => showArchived.value || !l.archived);
const dialogTitle = computed(() => {
  if (dialog.kind === 'level') return dialog.id ? t('edubridge.adminSectionsPage.dialog.renameLevelTitle') : t('edubridge.adminSectionsPage.dialog.newLevelTitle');
  return dialog.id ? t('edubridge.adminSectionsPage.dialog.renameSectionTitle') : t('edubridge.adminSectionsPage.dialog.newSectionTitle');
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    sections.value = await fetchSections({ include_archived: true });
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

/** Действие над справочником: одно за раз, затем свежий список. */
async function act(action: () => Promise<unknown>): Promise<boolean> {
  busy.value = true;
  try {
    await action();
    await load();
    return true;
  } catch (e) {
    FailAlert(e);
    return false;
  } finally {
    busy.value = false;
  }
}

/** Новый порядок — сдвиг одного элемента по списку всех, включая скрытые архивные. */
function moved<T extends { id: unknown }>(all: T[], shown: T[], index: number, step: number): string[] {
  const a = shown[index];
  const b = shown[index + step];
  if (!a || !b) return all.map((x) => String(x.id));
  const ids = all.map((x) => String(x.id));
  const ia = ids.indexOf(String(a.id));
  const ib = ids.indexOf(String(b.id));
  [ids[ia], ids[ib]] = [ids[ib]!, ids[ia]!];
  return ids;
}

const moveSection = (index: number, step: number) => act(() => reorderSections(moved(sections.value, visible.value, index, step)));
const moveLevel = (s: ISection, index: number, step: number) => act(() => reorderLevels(String(s.id), moved(s.levels, levelsOf(s), index, step)));
const toggleSection = (s: ISection) => act(() => archiveSection(String(s.id), !s.archived));
const toggleLevel = (l: ILevel) => act(() => archiveLevel(String(l.id), !l.archived));

function openCreateLevel(s: ISection): void {
  Object.assign(dialog, { open: true, kind: 'level', id: null, sectionId: String(s.id), title: '' });
}

function openRename(kind: 'section' | 'level', id: unknown, title: string, sectionId?: unknown): void {
  Object.assign(dialog, { open: true, kind, id: String(id), sectionId: sectionId ? String(sectionId) : null, title });
}

function openCreateSection(): void {
  Object.assign(dialog, { open: true, kind: 'section', id: null, sectionId: null, title: '' });
}

async function submitDialog(): Promise<void> {
  const title = dialog.title.trim();
  if (!title) return;
  const ok = await act(() =>
    dialog.kind === 'level'
      ? saveLevel({ id: dialog.id ?? undefined, section_id: dialog.sectionId ?? '', title })
      : saveSection({ id: dialog.id ?? undefined, title }),
  );
  if (ok) dialog.open = false;
}

const { registerAction } = useHeaderActions();

// Живое обновление: справочник правят и из формы курса, и другие администраторы.
useLiveReload([EduLive.sections, EduLive.levels], load);

onMounted(() => {
  registerAction({ id: 'edubridge-add-section', component: HeaderActionButton, props: { label: t('edubridge.addSectionHeaderButton.label'), icon: 'add', onClick: openCreateSection } });
  void load();
});
</script>

<style scoped>
.edu-sections__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-2) 0;
  border-bottom: 1px solid var(--p-line);
}
.edu-sections__row--head {
  padding-top: 0;
}
.edu-sections__levels .edu-sections__row:last-child {
  border-bottom: 0;
}
.edu-sections__name {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  min-width: 0;
}
.edu-sections__num {
  width: var(--p-5);
  color: var(--p-ink-3);
}
</style>
