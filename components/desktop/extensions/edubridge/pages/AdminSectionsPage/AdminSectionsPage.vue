<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(storage-key="edu:admin-sections:banner-dismissed")
    | Разделы и уровни каталога. Курсы ссылаются на них: переименование и порядок сразу меняются у всех курсов
    | и в каталоге. Порядок уровней внутри раздела — их последовательность. Архивное не предлагается новым
    | курсам и в каталоге, у прежних курсов остаётся.

  .row.justify-end.q-mb-md(v-if="hasArchived")
    q-toggle(v-model="showArchived" label="Показывать архив")

  CardListSkeleton(v-if="firstLoad" :count="2")
  EmptyState(v-else-if="!visible.length" title="Разделов пока нет" body="Добавьте раздел кнопкой в правом верхнем углу либо прямо в форме курса — он появится здесь.")
    template(#icon)
      q-icon(name="category" size="32px")

  BaseCard.q-mb-md(v-for="(section, si) in visible" :key="section.id" variant="default")
    .edu-sections__head
      .edu-sections__title
        .t-h3 {{ section.title }}
        BaseBadge(v-if="section.archived" variant="neutral") в архиве
      .edu-sections__actions
        BaseButton(variant="ghost" size="sm" icon-only aria-label="Раздел выше" :disabled="si === 0 || busy" @click="moveSection(si, -1)")
          template(#icon-left)
            q-icon(name="arrow_upward" size="18px")
        BaseButton(variant="ghost" size="sm" icon-only aria-label="Раздел ниже" :disabled="si === visible.length - 1 || busy" @click="moveSection(si, 1)")
          template(#icon-left)
            q-icon(name="arrow_downward" size="18px")
        BaseButton(variant="ghost" size="sm" :disabled="busy" @click="openRename('section', section.id, section.title)") Переименовать
        BaseButton(variant="ghost" size="sm" :disabled="busy" @click="toggleSection(section)") {{ section.archived ? 'Вернуть' : 'В архив' }}

    q-list.q-mt-sm(v-if="levelsOf(section).length" separator)
      q-item(v-for="(level, li) in levelsOf(section)" :key="level.id")
        q-item-section(avatar)
          .t-mono.t-muted {{ li + 1 }}
        q-item-section
          .row.items-center.q-gutter-sm
            span {{ level.title }}
            BaseBadge(v-if="level.archived" variant="neutral") в архиве
        q-item-section(side)
          .edu-sections__actions
            BaseButton(variant="ghost" size="sm" icon-only aria-label="Уровень раньше" :disabled="li === 0 || busy" @click="moveLevel(section, li, -1)")
              template(#icon-left)
                q-icon(name="arrow_upward" size="18px")
            BaseButton(variant="ghost" size="sm" icon-only aria-label="Уровень позже" :disabled="li === levelsOf(section).length - 1 || busy" @click="moveLevel(section, li, 1)")
              template(#icon-left)
                q-icon(name="arrow_downward" size="18px")
            BaseButton(variant="ghost" size="sm" :disabled="busy" @click="openRename('level', level.id, level.title, section.id)") Переименовать
            BaseButton(variant="ghost" size="sm" :disabled="busy" @click="toggleLevel(level)") {{ level.archived ? 'Вернуть' : 'В архив' }}
    .t-muted.t-sm.q-mt-sm(v-else) Уровней нет — курсы раздела видны в нём целиком.

    .edu-sections__add.q-mt-md(v-if="!section.archived")
      BaseInput(v-model="newLevel[section.id]" label="Новый уровень" placeholder="«7 класс», «Ступень 1»" @keyup.enter="addLevel(section)")
      BaseButton(variant="secondary" :disabled="!newLevel[section.id]?.trim() || busy" @click="addLevel(section)") Добавить

  BaseDialog(v-model="dialog.open" :title="dialogTitle" size="sm")
    BaseInput(v-model="dialog.title" :label="dialog.kind === 'level' ? 'Название уровня' : 'Название раздела'" autofocus @keyup.enter="submitDialog")
    template(#footer)
      BaseButton(variant="ghost" :disabled="busy" @click="dialog.open = false") Отменить
      BaseButton(variant="primary" :disabled="!dialog.title.trim()" :loading="busy" @click="submitDialog") Сохранить
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useFirstLoad } from 'src/shared/lib/composables';
import { FailAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { BaseBadge, BaseButton, BaseCard, BaseDialog, BaseInput, CardListSkeleton, EmptyState } from 'src/shared/ui/base';
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
import AddSectionHeaderButton from './AddSectionHeaderButton.vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { EduLive } from '../../shared/lib/live';

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
const newLevel = reactive<Record<string, string>>({});
const dialog = reactive({ open: false, kind: 'section' as 'section' | 'level', id: null as string | null, sectionId: null as string | null, title: '' });

const hasArchived = computed(() => sections.value.some((s) => s.archived || s.levels.some((l) => l.archived)));
const visible = computed(() => sections.value.filter((s) => showArchived.value || !s.archived));
const levelsOf = (s: ISection): ILevel[] => s.levels.filter((l) => showArchived.value || !l.archived);
const dialogTitle = computed(() => {
  if (dialog.kind === 'level') return dialog.id ? 'Переименовать уровень' : 'Новый уровень';
  return dialog.id ? 'Переименовать раздел' : 'Новый раздел';
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

async function addLevel(s: ISection): Promise<void> {
  const title = newLevel[String(s.id)]?.trim();
  if (!title) return;
  if (await act(() => saveLevel({ section_id: String(s.id), title }))) newLevel[String(s.id)] = '';
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
  registerAction({ id: 'edubridge-add-section', component: AddSectionHeaderButton, props: { onClick: openCreateSection } });
  void load();
});
</script>

<style scoped>
.edu-sections__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3);
  flex-wrap: wrap;
}
.edu-sections__title {
  display: flex;
  align-items: center;
  gap: var(--p-2);
}
.edu-sections__actions {
  display: flex;
  align-items: center;
  gap: var(--p-1);
  flex-wrap: wrap;
}
.edu-sections__add {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2);
}
.edu-sections__add > :first-child {
  flex: 1;
}
</style>
