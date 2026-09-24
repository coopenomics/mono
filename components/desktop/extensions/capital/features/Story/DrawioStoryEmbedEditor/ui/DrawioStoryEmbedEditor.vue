<template lang="pug">
.drawio-story-embed-editor(:style="rootStyle")
  .drawio-story-embed-editor__inner
    iframe.drawio-story-embed-editor__frame(
      v-if="iframeSrc"
      ref="frameRef"
      :key="iframeKey"
      :src="iframeSrc"
      :class="{ 'drawio-story-embed-editor__frame--hidden': !diagramVisible }"
      :style="frameStyle"
      title="Draw.io"
    )
    .drawio-story-embed-editor__overlay(v-if="!diagramVisible")
      .drawio-story-embed-editor__overlay-inner.column.items-center.q-gutter-sm
        q-spinner(color="primary" size="48px")
        .text-body2.text-grey-7 {{ $t('capital.drawioStoryEmbedEditor.loading') }}
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import {
  EMPTY_DRAWIO_STORY_XML,
  decodeBpmnXmlIfEscaped,
  getDrawioPostMessageOrigin,
  buildDrawioEmbedIframeSrc,
  getDrawioEmbedOrigin,
} from 'app/extensions/capital/shared/lib';

interface DrawioJsonMessage {
  event?: string;
  xml?: string;
}

const props = withDefaults(
  defineProps<{
    modelValue: string;
    readonly?: boolean;
    minHeight?: number;
  }>(),
  {
    readonly: false,
    minHeight: 480,
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const frameRef = ref<HTMLIFrameElement | null>(null);
const internalXml = ref('');
/** Показываем iframe после ответа embed «диаграмма загружена» (событие load), иначе остаётся оверлей. */
const diagramVisible = ref(false);
let editorReady = false;
let suppressXmlEmit = false;
/** В браузере `setTimeout` возвращает `number`; с @types/node иначе часто выводится `NodeJS.Timeout`. */
let safetyRevealTimer: number | null = null;

const iframeKey = computed(() => (props.readonly ? 'ro' : 'rw'));

const iframeSrc = computed((): string => {
  const base = getDrawioEmbedOrigin();
  return buildDrawioEmbedIframeSrc(base, props.readonly);
});

// Как у BpmnStoryEditor: заполняем доступную высоту родителя (q-card-section.col), не фиксируем px.
const rootStyle = computed(() => ({
  minHeight: `${props.minHeight}px`,
  height: '100%',
  width: '100%',
}));

const frameStyle = computed(() => ({
  width: '100%',
  height: '100%',
  border: '0',
  display: 'block',
}));

function parseMessageData(raw: unknown): DrawioJsonMessage | null {
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      return JSON.parse(raw) as DrawioJsonMessage;
    } catch {
      return null;
    }
  }
  if (raw !== null && typeof raw === 'object' && 'event' in raw) {
    return raw as DrawioJsonMessage;
  }
  return null;
}

function postLoadXml(xml: string): void {
  const win = frameRef.value?.contentWindow;
  if (!win) {
    return;
  }
  const targetOrigin = getDrawioPostMessageOrigin();
  const payload: Record<string, string | number> = {
    action: 'load',
    xml,
    noExitBtn: '1',
    noSaveBtn: '1',
    saveAndExit: '0',
  };
  if (!props.readonly) {
    payload.autosave = 1;
  }
  suppressXmlEmit = true;
  internalXml.value = xml;
  win.postMessage(JSON.stringify(payload), targetOrigin);
  // timing: ui — следующий тик: эхо загруженной схемы от редактора не считаем правкой
  window.setTimeout(() => {
    suppressXmlEmit = false;
  }, 0);
}

function onWindowMessage(event: MessageEvent): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (event.origin !== getDrawioPostMessageOrigin()) {
    return;
  }
  const msg = parseMessageData(event.data);
  if (!msg) {
    return;
  }

  if (msg.event === 'init') {
    editorReady = true;
    diagramVisible.value = false;
    const raw = props.modelValue?.trim() ? props.modelValue : EMPTY_DRAWIO_STORY_XML;
    postLoadXml(decodeBpmnXmlIfEscaped(raw));
    return;
  }

  // Ответ редактора после успешного load XML (см. diagrams.net embed JSON protocol).
  if (msg.event === 'load') {
    diagramVisible.value = true;
    return;
  }

  if (props.readonly) {
    return;
  }
  if (
    (msg.event === 'autosave' || msg.event === 'save') &&
    typeof msg.xml === 'string'
  ) {
    if (suppressXmlEmit) {
      return;
    }
    if (msg.xml === internalXml.value) {
      return;
    }
    internalXml.value = msg.xml;
    emit('update:modelValue', msg.xml);
  }
}

function clearSafetyTimer(): void {
  if (safetyRevealTimer !== null) {
    window.clearTimeout(safetyRevealTimer);
    safetyRevealTimer = null;
  }
}

function startSafetyRevealTimer(): void {
  clearSafetyTimer();
  // timing: timeout — редактор draw.io мог не прислать сигнал готовности, схему показываем по сроку
  safetyRevealTimer = window.setTimeout(() => {
    if (!diagramVisible.value) {
      diagramVisible.value = true;
    }
    safetyRevealTimer = null;
  }, 45000);
}

onMounted(() => {
  window.addEventListener('message', onWindowMessage);
  startSafetyRevealTimer();
});

onBeforeUnmount(() => {
  clearSafetyTimer();
  window.removeEventListener('message', onWindowMessage);
  editorReady = false;
});

watch(
  () => props.modelValue,
  (next) => {
    if (!editorReady) {
      return;
    }
    const raw = next?.trim() ? next : EMPTY_DRAWIO_STORY_XML;
    const normalized = decodeBpmnXmlIfEscaped(raw);
    if (normalized === internalXml.value) {
      return;
    }
    postLoadXml(normalized);
  },
);

watch(iframeKey, () => {
  editorReady = false;
  diagramVisible.value = false;
  startSafetyRevealTimer();
});
</script>

<style lang="scss" scoped>
.drawio-story-embed-editor {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 4px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
}

.drawio-story-embed-editor__inner {
  position: relative;
  width: 100%;
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.drawio-story-embed-editor__overlay {
  position: absolute;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drawio-story-embed-editor__overlay-inner {
  padding: 1rem;
  text-align: center;
}

.drawio-story-embed-editor__frame {
  position: relative;
  z-index: 1;
  flex: 1 1 auto;
  min-height: 0;
  transition: opacity 0.25s ease-out;
}

.drawio-story-embed-editor__frame--hidden {
  opacity: 0;
  pointer-events: none;
}

</style>
