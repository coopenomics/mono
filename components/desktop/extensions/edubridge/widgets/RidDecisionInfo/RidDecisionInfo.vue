<template lang="pug">
//- Сведения о взносе преподавателя для вопроса совета: что передаётся
//- кооперативу, по какому курсу, группе и занятию, на какую сумму. Совет
//- читает их рядом с заявлением, прежде чем голосовать.
.edu-rid-info
  CardListSkeleton(v-if="firstLoad" :count="1")

  BaseBanner(v-else-if="!brief" variant="info")
    template(#icon)
      q-icon(name="info")
    | {{ $t('edubridge.ridDecisionInfo.missing') }}

  template(v-else)
    DataRow(:label="$t('edubridge.ridDecisionInfo.course')" :value="brief.course_title || '______'")
    DataRow(v-if="brief.group_title" :label="$t('edubridge.ridDecisionInfo.group')" :value="brief.group_title")
    DataRow(v-if="lessonLine" :label="$t('edubridge.ridDecisionInfo.lesson')" :value="lessonLine" :hint="brief.lesson_topic ? $t('edubridge.ridDecisionInfo.lessonTopic', { topic: brief.lesson_topic }) : undefined")
    DataRow(:label="$t('edubridge.ridDecisionInfo.teacher')" :value="brief.teacher_name || brief.teacher_username")
    DataRow(:label="$t('edubridge.ridDecisionInfo.kind')" :value="ridType")
    DataRow(v-if="brief.learners_count" :label="$t('edubridge.ridDecisionInfo.learners')" :value="String(brief.learners_count)")
    DataRow(v-if="brief.hourly_rate" :label="$t('edubridge.ridDecisionInfo.hourlyRate')" :value="formatAsset2Digits(brief.hourly_rate)")
    DataRow(:label="$t('edubridge.ridDecisionInfo.amount')" :value="formatAsset2Digits(brief.amount)" :hint="$t('edubridge.ridDecisionInfo.amountHint')")
    DataRow(v-if="brief.hold_until" :label="$t('edubridge.ridDecisionInfo.holdUntil')" :value="formatDate(brief.hold_until)" :hint="$t('edubridge.ridDecisionInfo.holdHint')")

    //- Что именно передаётся кооперативу: ссылки на запись, конспект, задания.
    DataRow(:label="$t('edubridge.ridDecisionInfo.materials')")
      template(#value-override)
        .edu-rid-info__files(v-if="brief.links.length")
          template(v-for="link in brief.links" :key="link")
            a.edu-rid-info__link(v-if="isUrl(link)" :href="link" target="_blank" rel="noopener")
              q-icon(name="link" size="14px")
              span {{ link }}
            span(v-else) {{ link }}
        span(v-else) ______
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { IAgenda } from 'src/entities/Agenda/model';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { BaseBanner, CardListSkeleton } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { formatLessonMoment } from '../../entities/Lesson';
import { fetchContributionBrief, RID_TYPE_LABELS, type IContributionBrief } from '../../entities/Teacher';
import { EduLive } from '../../shared/lib/live';
import { t } from '../../i18n';

/**
 * Дополнение к вопросу совета о приёме паевого взноса результатом работы.
 * Подключается обработчиком решения `eduacptrid`: стол совета показывает его
 * над документами вопроса. Ключ взноса берётся из заявления преподавателя.
 */
const props = defineProps<{ agenda: IAgenda }>();

const brief = ref<IContributionBrief | null>(null);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);

/** Ключ взноса из метаданных заявления: строка JSON либо объект. */
const ridHash = computed(() => {
  const meta = props.agenda.table?.statement?.meta as unknown;
  if (!meta) return '';
  try {
    const parsed = (typeof meta === 'string' ? JSON.parse(meta) : meta) as { rid_hash?: string };
    return String(parsed.rid_hash ?? '');
  } catch {
    return '';
  }
});

async function load(): Promise<void> {
  loading.value = true;
  try {
    brief.value = ridHash.value ? await fetchContributionBrief(ridHash.value) : null;
  } catch {
    // Сведения — дополнение к заявлению: сбой их загрузки вопрос не закрывает.
    brief.value = null;
  } finally {
    loading.value = false;
  }
}

const ridType = computed(() => (brief.value ? RID_TYPE_LABELS[brief.value.rid_type] ?? String(brief.value.rid_type) : ''));
const formatDate = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString('ru-RU') : '______');
const isUrl = (v: string) => /^https?:\/\//i.test(v);

/** Занятие одной строкой: номер, момент и длительность. */
const lessonLine = computed(() => {
  const b = brief.value;
  if (!b || b.lesson_number == null) return '';
  return t('edubridge.ridDecisionInfo.lessonLine', { number: b.lesson_number, moment: formatLessonMoment(b.held_at), minutes: b.duration_minutes ?? 0 });
});

watch(ridHash, () => void load(), { immediate: true });
// Взнос меняется решением совета и расчётом занятия — сведения обновляются сами.
useLiveReload([EduLive.contributions, EduLive.lessons], load);
</script>

<style scoped>
.edu-rid-info__files {
  display: flex;
  flex-direction: column;
  gap: var(--p-1);
  min-width: 0;
}
.edu-rid-info__link {
  display: inline-flex;
  align-items: center;
  gap: var(--p-1);
  color: var(--p-primary);
  overflow-wrap: anywhere;
}
</style>
