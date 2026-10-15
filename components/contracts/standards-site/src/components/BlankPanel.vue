<script setup lang="ts">
/**
 * Панель бланка документа: выезжает справа поверх описания.
 * Бланк собирается движком фабрики из текущей редакции шаблона; поля без
 * данных — прочерком. Для форм с ветвлением по типу пайщика — переключатель.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { SUBJECT_TYPES, branchesBySubject, renderBlank, type SubjectType } from '@/data/blanks';

const props = defineProps<{ registryId: number | null }>();
const emit = defineEmits<{ (e: 'close'): void }>();

const version = __MONO_VERSION__;
const subject = ref<SubjectType>('individual');

watch(
  () => props.registryId,
  () => {
    subject.value = 'individual';
  },
);

const branches = computed(() => (props.registryId != null ? branchesBySubject(props.registryId) : false));

const blank = computed(() => {
  if (props.registryId == null) return null;
  try {
    return { ok: true as const, ...renderBlank(props.registryId, subject.value)! };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : String(e) };
  }
});

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && props.registryId != null) emit('close');
}
onMounted(() => window.addEventListener('keydown', onKey));
onBeforeUnmount(() => window.removeEventListener('keydown', onKey));
</script>

<template>
  <Transition name="blank-fade">
    <div v-if="registryId != null" class="blank__backdrop" title="Закрыть бланк" @click="emit('close')" />
  </Transition>
  <Transition name="blank-slide">
    <aside v-if="registryId != null && blank" class="blank">
      <header class="blank__head">
        <div class="blank__titles">
          <div class="blank__kicker">Бланк документа · № {{ registryId }}</div>
          <h3 class="blank__title">{{ blank.ok ? blank.title : 'Бланк не собран' }}</h3>
        </div>
        <button type="button" class="blank__close" title="Закрыть (Esc)" @click="emit('close')">×</button>
      </header>

      <div class="blank__bar">
        <div v-if="branches" class="blank__subject" role="radiogroup" aria-label="Тип пайщика">
          <button
            v-for="t in SUBJECT_TYPES"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="subject === t.value"
            :class="{ 'blank__subject--on': subject === t.value }"
            @click="subject = t.value"
          >{{ t.label }}</button>
        </div>
        <p class="blank__note">
          Текущая редакция шаблона, v{{ version }}. Поля без данных — прочерком.
          Кооператив работает по редакции, которую утвердил его совет.
        </p>
      </div>

      <iframe
        v-if="blank.ok"
        class="blank__sheet"
        :srcdoc="blank.html"
        sandbox=""
        :title="blank.title"
      />
      <p v-else class="blank__error">{{ blank.error }}</p>
    </aside>
  </Transition>
</template>

<style scoped>
.blank__backdrop {
  position: fixed;
  inset: 0;
  z-index: 44;
  background: rgba(0, 0, 0, 0.18);
  cursor: pointer;
}
.blank {
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  z-index: 45;
  width: min(900px, 76vw);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border-left: 1px solid var(--border);
  box-shadow: -16px 0 40px rgba(0, 0, 0, 0.18);
}
.blank__head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px 18px 10px;
}
.blank__titles { flex: 1; min-width: 0; }
.blank__kicker {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-subtle);
}
.blank__title {
  margin: 4px 0 0;
  font-size: 17px;
  line-height: 1.35;
}
.blank__close {
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text);
  font-size: 18px;
  line-height: 1;
}
.blank__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 0 18px 12px;
  border-bottom: 1px solid var(--border);
}
.blank__subject {
  display: inline-flex;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}
.blank__subject button {
  border: none;
  background: transparent;
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 12.5px;
  color: var(--text-muted);
}
.blank__subject button.blank__subject--on {
  background: var(--bg);
  color: var(--text);
  box-shadow: 0 0 0 1px var(--border);
}
.blank__note {
  margin: 0;
  flex: 1 1 260px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.45;
}
.blank__sheet {
  flex: 1;
  width: 100%;
  border: none;
  background: #f4f4f5;
}
.blank__error {
  padding: 18px;
  color: var(--reject);
}
.blank-fade-enter-active,
.blank-fade-leave-active { transition: opacity 200ms ease; }
.blank-fade-enter-from,
.blank-fade-leave-to { opacity: 0; }
.blank-slide-enter-active,
.blank-slide-leave-active { transition: transform 200ms ease; }
.blank-slide-enter-from,
.blank-slide-leave-to { transform: translateX(100%); }
</style>
