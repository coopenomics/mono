<template lang="pug">
//- Двухпанельная оболочка экранов входа и вступления (решение владельца 16.09.2026,
//- вариант «Сплит»). Слева тёмная панель: название кооператива, заголовок, шаги или
//- цитата; справа рабочая область с одним заголовком и формой. На узком экране панель
//- сворачивается в компактную шапку с полосой прогресса, форма занимает всю ширину.
.auth-split(:class='`auth-split--${size ?? "sm"}`')
  aside.auth-split__pane
    span.auth-split__mark(v-html='logoSvg', aria-hidden='true')
    //- Прокручивается только содержимое: водяной знак вылезает за низ панели и,
    //- будь он внутри прокрутки, добавлял бы ей лишнюю высоту.
    .auth-split__pane-scroll
      .auth-split__pane-head
        .auth-split__brand
          span.auth-split__brand-logo(v-html='logoSvg', aria-hidden='true')
          span.auth-split__eyebrow(v-if='eyebrow') {{ eyebrow }}
        h1.auth-split__title {{ title }}
        p.auth-split__lead(v-if='lead') {{ lead }}

      //- Шаги: на широком экране — список, на узком — полоса прогресса с текущим шагом.
      template(v-if='steps && steps.length')
        ol.auth-split__steps
          li.auth-split__step(
            v-for='(step, index) in steps',
            :key='step.key',
            :class='stepClass(step.key)'
          )
            span.auth-split__step-n
              q-icon(v-if='isCompleted(step.key)', name='check', size='14px')
              template(v-else) {{ index + 1 }}
            span.auth-split__step-label {{ step.label }}
        .auth-split__progress(role='progressbar', :aria-valuenow='activeIndex + 1', :aria-valuemax='steps.length')
          .auth-split__progress-text
            span Шаг {{ activeIndex + 1 }} из {{ steps.length }}
            span.auth-split__progress-label(v-if='activeStep') {{ activeStep.label }}
          .auth-split__progress-bar
            i(v-for='step in steps', :key='step.key', :class='stepClass(step.key)')

      p.auth-split__quote(v-else-if='quote') {{ quote }}

      slot(name='pane')

      .auth-split__pane-foot(v-if='$slots["pane-foot"]')
        slot(name='pane-foot')

  section.auth-split__work
    //- Действия экрана: кнопка встречного пути (вход ↔ регистрация) из слота и
    //- переключатель темы. Общей шапки на этих экранах нет.
    .auth-split__actions
      slot(name='actions')
      ThemeToggle(as-button)

    .auth-split__work-inner
      header.auth-split__heading(v-if='stepEyebrow || heading || text || $slots.heading')
        slot(name='heading')
          .auth-split__step-eyebrow(v-if='stepEyebrow') {{ stepEyebrow }}
          h2.auth-split__h(v-if='heading') {{ heading }}
          p.auth-split__text(v-if='text') {{ text }}

      .auth-split__body
        slot

      .auth-split__foot(v-if='$slots.foot')
        slot(name='foot')

    //- Реквизиты кооператива — внизу рабочей области вместо общего футера.
    ContactsFooter.auth-split__legal(v-if='legalText', :text='legalText')
</template>

<script setup lang="ts">
import { computed, inject, ref } from 'vue';
import logoSvg from 'src/assets/logo.svg?raw';
import { ThemeToggle } from 'src/shared/ui/base/ThemeToggle';
import { ContactsFooter } from 'src/shared/ui/Footer';
import { AUTH_LEGAL_TEXT, type AuthSplitProps } from './AuthSplit.types';

const props = defineProps<AuthSplitProps>();
const legalText = inject(AUTH_LEGAL_TEXT, ref(''));

const activeIndex = computed(() => {
  const steps = props.steps ?? [];
  const idx = steps.findIndex((s) => s.key === props.activeKey);
  return idx < 0 ? 0 : idx;
});
const activeStep = computed(() => (props.steps ?? [])[activeIndex.value]);

function isCompleted(key: string): boolean {
  return (props.completedKeys ?? []).includes(key);
}
function stepClass(key: string): Record<string, boolean> {
  return {
    'is-active': key === props.activeKey,
    'is-done': isCompleted(key),
  };
}
</script>

<style scoped>
/*
 * Высота наследуется от q-page: у него min-height задан inline вычислением от высоты
 * окна, и `inherit` переносит это же значение сюда, чтобы панель доставала до низа.
 */
.auth-split {
  min-height: inherit;
  display: grid;
  grid-template-columns: 400px minmax(0, 1fr);
  background: var(--p-canvas);
}

/* ── Панель ──
 * Липнет к верху окна и не выше него: при длинном шаге (заявление на проверку)
 * прокручивается только рабочая область, а ссылка внизу панели остаётся на виду,
 * а не уезжает в самый низ страницы (замечание владельца 16.09.2026). Если панель
 * сама выше окна, прокручивается внутри себя.
 */
.auth-split__pane {
  position: sticky;
  top: 0;
  height: 100dvh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--p-8, 40px);
  background: var(--p-pane-bg);
  color: var(--p-pane-ink);
}
.auth-split__mark {
  position: absolute;
  right: -120px;
  bottom: -140px;
  width: 420px;
  color: var(--p-pane-mark);
  pointer-events: none;
}
.auth-split__mark :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.auth-split__pane-scroll {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden auto;
}
.auth-split__pane-head {
  position: relative;
  z-index: 1;
}
.auth-split__brand {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
}
.auth-split__brand-logo {
  width: 32px;
  height: 32px;
  border-radius: var(--p-r-sm);
  background: var(--p-pane-accent-soft);
  color: var(--p-pane-accent);
  display: grid;
  place-items: center;
  flex: none;
}
.auth-split__brand-logo :deep(svg) {
  width: 18px;
  height: 18px;
  display: block;
}
.auth-split__eyebrow {
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--p-pane-ink-2);
}
.auth-split__title {
  margin: var(--p-9, 56px) 0 0;
  font-size: 30px;
  line-height: var(--p-lh-display);
  letter-spacing: var(--p-ls-display);
  font-weight: 600;
  color: var(--p-pane-ink);
}
.auth-split__lead {
  margin: var(--p-3, 12px) 0 0;
  max-width: 300px;
  color: var(--p-pane-ink-2);
}

/* Список шагов */
.auth-split__steps {
  position: relative;
  z-index: 1;
  list-style: none;
  margin: var(--p-8, 40px) 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.auth-split__step {
  display: flex;
  align-items: center;
  gap: var(--p-3, 12px);
  padding: 9px var(--p-3, 12px);
  border-radius: var(--p-r-sm);
  color: var(--p-pane-ink-3);
  font-size: var(--p-fs-body-sm);
  transition: background var(--p-dur-base) var(--p-ease-standard), color var(--p-dur-base) var(--p-ease-standard);
}
.auth-split__step-n {
  width: 24px;
  height: 24px;
  border-radius: var(--p-r-pill);
  border: 1px solid var(--p-pane-line);
  display: grid;
  place-items: center;
  font-size: var(--p-fs-eyebrow);
  font-weight: 600;
  flex: none;
}
.auth-split__step.is-done {
  color: var(--p-pane-ink-2);
}
.auth-split__step.is-done .auth-split__step-n {
  border-color: var(--p-pane-accent);
  color: var(--p-pane-accent);
}
.auth-split__step.is-active {
  background: var(--p-pane-accent-soft);
  color: var(--p-pane-ink);
}
.auth-split__step.is-active .auth-split__step-n {
  background: var(--p-pane-accent);
  border-color: var(--p-pane-accent);
  color: var(--p-pane-accent-ink);
}

/* Полоса прогресса — только на узком экране */
.auth-split__progress {
  display: none;
}

.auth-split__quote {
  position: relative;
  z-index: 1;
  margin: var(--p-8, 40px) 0 0;
  padding-left: var(--p-4, 16px);
  border-left: 2px solid var(--p-pane-accent);
  max-width: 300px;
  color: var(--p-pane-ink-2);
  line-height: 1.6;
}
.auth-split__pane-foot {
  position: relative;
  z-index: 1;
  margin-top: auto;
  padding-top: var(--p-8, 40px);
  font-size: var(--p-fs-meta);
  color: var(--p-pane-ink-3);
}
.auth-split__pane-foot :deep(a),
.auth-split__pane-foot :deep(button) {
  color: var(--p-pane-ink);
}

/* ── Рабочая область ── */
.auth-split__work {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: var(--p-9, 56px) var(--p-10, 72px);
}
.auth-split__actions {
  position: absolute;
  top: var(--p-3, 12px);
  right: var(--p-4, 16px);
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  z-index: 2;
}
.auth-split__legal {
  margin-top: var(--p-8, 40px);
  padding-top: var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
}
.auth-split__work-inner {
  width: 100%;
  max-width: 440px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.auth-split--md .auth-split__work-inner {
  max-width: 560px;
}
.auth-split--lg .auth-split__work-inner {
  max-width: 720px;
}
.auth-split__heading {
  margin-bottom: var(--p-7, 32px);
}
.auth-split__step-eyebrow {
  font-size: var(--p-fs-eyebrow);
  line-height: var(--p-lh-eyebrow);
  letter-spacing: var(--p-ls-eyebrow);
  text-transform: uppercase;
  font-weight: 600;
  color: var(--p-primary);
}
.auth-split__h {
  margin: var(--p-2, 8px) 0 0;
  font-size: var(--p-fs-display);
  line-height: var(--p-lh-display);
  letter-spacing: var(--p-ls-display);
  font-weight: 600;
  color: var(--p-ink);
}
.auth-split__text {
  margin: var(--p-3, 12px) 0 0;
  color: var(--p-ink-2);
}
/*
 * Тело — колонка с ровным зазором: содержимое приходит слотом из чужой области
 * видимости, и отступы между блоками задаёт контейнер, а не они сами.
 */
.auth-split__body {
  display: flex;
  flex-direction: column;
  gap: var(--p-5, 20px);
}
.auth-split__foot {
  margin-top: var(--p-6, 24px);
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-2, 8px) var(--p-5, 20px);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

/* ── Планшет: панель уже, отступы меньше ── */
@media (max-width: 1279px) {
  .auth-split {
    grid-template-columns: 320px minmax(0, 1fr);
  }
  .auth-split__pane {
    padding: var(--p-7, 32px);
  }
  .auth-split__work {
    padding: var(--p-8, 40px);
  }
}

/* ── Телефон и узкий планшет: панель становится шапкой ── */
@media (max-width: 1023px) {
  .auth-split {
    grid-template-columns: minmax(0, 1fr);
  }
  .auth-split__pane {
    position: relative;
    height: auto;
    overflow: hidden;
    padding: var(--p-5, 20px);
  }
  .auth-split__pane-scroll {
    flex: none;
    overflow: visible;
    gap: var(--p-4, 16px);
  }
  .auth-split__mark {
    right: -160px;
    bottom: -220px;
    width: 360px;
  }
  .auth-split__title {
    margin-top: var(--p-4, 16px);
    font-size: var(--p-fs-h1);
    line-height: var(--p-lh-h1);
    letter-spacing: var(--p-ls-h1);
  }
  .auth-split__lead,
  .auth-split__quote,
  .auth-split__steps {
    display: none;
  }
  .auth-split__progress {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: var(--p-2, 8px);
  }
  .auth-split__progress-text {
    display: flex;
    justify-content: space-between;
    gap: var(--p-3, 12px);
    font-size: var(--p-fs-meta);
    color: var(--p-pane-ink-2);
  }
  .auth-split__progress-label {
    color: var(--p-pane-ink);
    font-weight: 500;
    text-align: right;
  }
  .auth-split__progress-bar {
    display: flex;
    gap: 4px;
  }
  .auth-split__progress-bar i {
    flex: 1;
    height: 4px;
    border-radius: var(--p-r-pill);
    background: var(--p-pane-line);
  }
  .auth-split__progress-bar i.is-done {
    background: var(--p-pane-accent);
  }
  .auth-split__progress-bar i.is-active {
    background: var(--p-pane-accent);
    opacity: 0.55;
  }
  .auth-split__pane-foot {
    margin-top: 0;
    padding-top: 0;
  }
  .auth-split__work {
    position: static;
    padding: var(--p-6, 24px) var(--p-5, 20px) var(--p-8, 40px);
  }
  /* Действия уходят в правый верхний угол тёмной панели — общей шапки нет. */
  .auth-split {
    position: relative;
  }
  .auth-split__actions {
    top: var(--p-3, 12px);
    right: var(--p-3, 12px);
    color: var(--p-pane-ink);
  }
  .auth-split__pane-head {
    padding-right: 140px;
  }
  .auth-split__work-inner,
  .auth-split--md .auth-split__work-inner,
  .auth-split--lg .auth-split__work-inner {
    max-width: none;
  }
  .auth-split__heading {
    margin-bottom: var(--p-6, 24px);
  }
  .auth-split__h {
    font-size: var(--p-fs-h1);
    line-height: var(--p-lh-h1);
    letter-spacing: var(--p-ls-h1);
  }
}
</style>
