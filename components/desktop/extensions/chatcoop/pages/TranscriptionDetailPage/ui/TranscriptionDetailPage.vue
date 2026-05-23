<template lang="pug">
div.transcription-detail-page
  nav.detail-nav
    q-btn(
      flat
      dense
      no-caps
      icon="fa-solid fa-arrow-left"
      label="К списку"
      @click="goBack"
      color="grey-7"
    )

  WindowLoader(v-if="transcriptionStore.isLoadingDetail" text="Загрузка транскрипции...")

  div.tr-panel(v-else-if="transcriptionStore.error")
    p.tr-panel__error {{ transcriptionStore.error }}
    q-btn(flat dense no-caps color="primary" @click="loadData") Повторить

  div.tr-panel.tr-panel--empty(v-else-if="!transcription")
    q-icon.tr-empty__icon(name="fa-solid fa-file-lines" size="40px")
    p.tr-empty__title Запись не найдена

  template(v-else)
    header.detail-head
      div.detail-head__top
        h1.detail-head__title {{ transcription.transcription.roomName || 'Звонок' }}
        q-badge.tr-badge(
          :color="getStatusColor(transcription.transcription.status)"
          :label="getStatusLabel(transcription.transcription.status)"
          outline
        )
      dl.detail-meta
        div.detail-meta__item
          dt Начало
          dd {{ formatDateTime(transcription.transcription.startedAt) }}
        div.detail-meta__item(v-if="transcription.transcription.endedAt")
          dt Окончание
          dd {{ formatDateTime(transcription.transcription.endedAt) }}
        div.detail-meta__item(v-if="transcription.transcription.endedAt")
          dt Длительность
          dd {{ formatDuration(transcription.transcription.startedAt, transcription.transcription.endedAt) }}
        div.detail-meta__item.detail-meta__item--people
          dt
            q-icon.detail-meta__icon(name="fa-solid fa-users" size="12px")
            | Участники
          dd.detail-meta__value-num {{ transcription.transcription.participants?.length ?? 0 }}

    section.tr-section.tr-section--memo
      h2.tr-section__label Заметка о звонке
      TranscriptionMemoEditor(
        :transcription-id="transcription.transcription.id"
        :memo="transcription.transcription.memo ?? ''"
      )

    section.tr-section(v-if="transcription.transcription.participants?.length")
      h2.tr-section__label Участники
      div.tr-chips
        span.tr-chip(
          v-for="(participant, pIdx) in transcription.transcription.participants"
          :key="'p-' + pIdx + '-' + participant"
        ) {{ participant }}

    section.tr-section.tr-section--segments
      h2.tr-section__label Текст
      div.tr-segments(v-if="!transcription.segments?.length")
        p.tr-segments__empty Транскрипция пока пуста
      div(v-else)
        article.tr-seg(
          v-for="segment in sortedSegments"
          :key="segment.id"
        )
          div.tr-seg__rail
            span.tr-seg__initial {{ getSpeakerInitials(segment.speakerName || segment.speakerIdentity) }}
          div.tr-seg__body
            div.tr-seg__head
              span.tr-seg__speaker {{ segment.speakerName || segment.speakerIdentity }}
              span.tr-seg__time {{ formatOffset(segment.startOffset) }} — {{ formatOffset(segment.endOffset) }}
            p.tr-seg__text {{ segment.text }}
</template>

<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { WindowLoader } from 'src/shared/ui/Loader';
import {
  formatDateTime,
  formatDuration,
  formatOffset,
  getSpeakerInitials,
  getStatusColor,
  getStatusLabel
} from '../../../shared/lib/transcriptionUtils';
import { useTranscriptionStore } from '../../../entities/Transcription/model';
import { TranscriptionMemoEditor } from '../../../features/Transcription/EditMemo';

const router = useRouter();
const route = useRoute();
const transcriptionStore = useTranscriptionStore();

const transcription = computed(() => transcriptionStore.currentTranscription);

const sortedSegments = computed(() => {
  if (!transcription.value?.segments) return [];
  return [...transcription.value.segments].sort((a, b) => a.startOffset - b.startOffset);
});

function goBack(): void {
  router.push({ name: 'chatcoop-transcriptions' });
}

async function loadData(): Promise<void> {
  const id = route.params.id as string;
  if (id) {
    await transcriptionStore.loadTranscription(id);
  }
}

onMounted(async () => {
  await loadData();
});

watch(
  () => route.params.id,
  async (id) => {
    if (typeof id === 'string' && id.length > 0) {
      await transcriptionStore.loadTranscription(id);
    }
  }
);
</script>

<style scoped>
.transcription-detail-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 16px 32px 40px;
  --tr-text: rgba(0, 0, 0, 0.87);
  --tr-muted: rgba(0, 0, 0, 0.52);
  --tr-border: rgba(0, 0, 0, 0.08);
  --tr-hover: rgba(0, 0, 0, 0.03);
  --tr-rail: rgba(0, 0, 0, 0.06);
}

.body--dark .transcription-detail-page {
  --tr-text: rgba(255, 255, 255, 0.9);
  --tr-muted: rgba(255, 255, 255, 0.45);
  --tr-border: rgba(255, 255, 255, 0.1);
  --tr-hover: rgba(255, 255, 255, 0.04);
  --tr-rail: rgba(255, 255, 255, 0.08);
}

.detail-nav {
  margin-bottom: 20px;
}

.detail-head {
  margin-bottom: 24px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--tr-border);
}

.detail-head__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.detail-head__title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  line-height: 1.3;
  color: var(--tr-text);
  min-width: 0;
}

.tr-badge {
  flex-shrink: 0;
  font-weight: 500;
  font-size: 0.7rem;
}

.detail-meta {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 14px 20px;
  margin: 0;
}

.detail-meta__item {
  margin: 0;
}

.detail-meta__item dt {
  margin: 0 0 4px;
  font-size: 0.7rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--tr-muted);
}

.detail-meta__item dd {
  margin: 0;
  font-size: 0.875rem;
  color: var(--tr-text);
  line-height: 1.35;
}

.detail-meta__item--people dt {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.detail-meta__icon {
  opacity: 0.7;
  flex-shrink: 0;
}

.detail-meta__value-num {
  font-variant-numeric: tabular-nums;
}

.tr-section {
  margin-bottom: 24px;
}

.tr-section--memo {
  margin-bottom: 20px;
}

.tr-section__label {
  margin: 0 0 10px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--tr-muted);
}

.tr-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tr-chip {
  display: inline-block;
  padding: 6px 12px;
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--tr-text);
  background: var(--tr-hover);
  border: 1px solid var(--tr-border);
  border-radius: 6px;
}

.tr-section--segments {
  border: 1px solid var(--tr-border);
  border-radius: 10px;
  padding: 16px 0 4px;
  margin-bottom: 0;
}

.tr-section--segments .tr-section__label {
  padding: 0 18px 12px;
  margin-bottom: 0;
  border-bottom: 1px solid var(--tr-border);
}

.tr-segments {
  padding: 28px 18px;
}

.tr-segments__empty {
  margin: 0;
  text-align: center;
  font-size: 0.875rem;
  color: var(--tr-muted);
}

.tr-seg {
  display: flex;
  gap: 14px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--tr-border);
}

.tr-seg:last-child {
  border-bottom: none;
}

.tr-seg__rail {
  flex-shrink: 0;
  width: 36px;
  display: flex;
  justify-content: center;
  padding-top: 2px;
}

.tr-seg__initial {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--tr-muted);
  background: var(--tr-rail);
  border: 1px solid var(--tr-border);
}

.tr-seg__body {
  min-width: 0;
  flex: 1;
}

.tr-seg__head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 12px;
  margin-bottom: 6px;
}

.tr-seg__speaker {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--tr-text);
}

.tr-seg__time {
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  color: var(--tr-muted);
}

.tr-seg__text {
  margin: 0;
  font-size: 0.9375rem;
  line-height: 1.55;
  color: var(--tr-text);
  white-space: pre-wrap;
}

.tr-panel,
.tr-panel--empty {
  border: 1px solid var(--tr-border);
  border-radius: 10px;
  padding: 24px 20px;
  text-align: center;
}

.tr-panel__error {
  margin: 0 0 12px;
  color: var(--q-negative, #c10015);
  font-size: 0.9rem;
}

.tr-empty__icon {
  color: var(--tr-muted);
  opacity: 0.55;
}

.tr-empty__title {
  margin: 14px 0 0;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--tr-text);
}
</style>
