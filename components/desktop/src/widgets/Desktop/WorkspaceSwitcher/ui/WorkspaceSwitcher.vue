<template lang="pug">
//- Шапка левого меню открывает единое окно столов и страниц — то же, что ⌘K.
button.ws-switcher(type='button', aria-haspopup='dialog', @click='palette.open()')
  span.ws-switcher__body
    span.ws-switcher__icon
      span.ws-switcher__icon-svg(v-html='logoSvg')
    span.ws-switcher__text
      span.ws-switcher__caption(:title='coopBrand') {{ coopBrand }}
      span.ws-switcher__title-box
        span.ws-switcher__title(:title='currentTitle') {{ currentTitle }}
  //- Нижняя строка называет действие словами — чтобы в шапке читалась кнопка
  //- выбора стола, а не заголовок.
  span.ws-switcher__footer
    span {{ workspaces.length > 1 ? t('desktop.workspaceSwitcher.switchLabel') : t('desktop.workspaceSwitcher.searchLabel') }}
    span.ws-switcher__keys(aria-hidden='true')
      span.kbd {{ modKey }}
      span.kbd K
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useCommandPaletteStore } from 'src/entities/CommandPalette/model';
import logoSvg from 'src/assets/logo.svg?raw';
import { t } from 'src/shared/i18n';

const desktop = useDesktopStore();
const system = useSystemStore();
const palette = useCommandPaletteStore();

const activeWorkspaceName = computed(() => desktop.activeWorkspaceName);

// Видимость столов — единый канон авторизации по правам от сервера,
// инкапсулированный в DesktopStore.isWorkspaceVisible. Собственной логики
// здесь нет: её зовут и CmdkMenu, и WorkspaceMenu.
const workspaces = computed(() =>
  desktop.workspaceMenus.filter((ws) => desktop.isWorkspaceVisible(ws)),
);

/**
 * «ПК «ВОСХОД»» — собрано из системных vars:
 *   vars.short_abbr (например, «ПК») + vars.name («Восход») в угловых кавычках.
 * Если каких-то из vars нет — деградируем мягко.
 */
const coopBrand = computed<string>(() => {
  const abbr = system.info.vars?.short_abbr?.trim();
  const name = system.info.vars?.name?.trim();
  if (abbr && name) return `${abbr} «${name}»`;
  if (name) return name;
  if (abbr) return abbr;
  return system.info.coopname || t('desktop.workspaceSwitcher.defaultCoopName');
});

const currentTitle = computed<string>(() => {
  const active = workspaces.value.find(
    (ws) => ws.workspaceName === activeWorkspaceName.value,
  );
  return active?.title || t('desktop.workspaceSwitcher.defaultDesktopTitle');
});

// На Mac сочетание показываем знаком ⌘, на остальных системах — Ctrl.
// Платформу узнаём после монтирования: на сервере она неизвестна, и разный
// текст на сервере и в браузере дал бы расхождение при гидрации.
const modKey = ref<string>('⌘');
onMounted(() => {
  if (!/Mac|iPhone|iPad/i.test(navigator.platform)) modKey.value = 'Ctrl';
});
</script>

<style scoped>
.ws-switcher {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 0;
  margin: 0;
  overflow: hidden;
  /* Рамка и фон видны всегда: без них шапка в покое выглядит заголовком,
     и неочевидно, что по ней открывается выбор стола. */
  background: var(--p-surface);
  border: 1px solid var(--p-line-1);
  border-radius: var(--p-r-sm);
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.ws-switcher:hover {
  border-color: var(--p-primary-line);
}

.ws-switcher__body {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  padding: var(--p-2);
}

.ws-switcher__icon {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
  border-radius: var(--p-r-sm);
}
.ws-switcher__icon-svg {
  display: inline-flex;
  width: 18px;
  height: 18px;
  line-height: 0;
}
.ws-switcher__icon-svg :deep(svg) {
  width: 100%;
  height: 100%;
}

.ws-switcher__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}
.ws-switcher__caption {
  font-size: var(--p-fs-eyebrow);
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--p-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Под название всегда занято две строки: высота шапки не зависит от длины
   названия, и меню под ней не прыгает при смене стола. */
.ws-switcher__title-box {
  display: flex;
  align-items: center;
  height: calc(var(--p-fs-body) * 1.25 * 2);
  margin-top: 2px;
}
/* «Стол вычислительных ресурсов» укладывается в две строки. Дальше — ellipsis. */
.ws-switcher__title {
  font-size: var(--p-fs-body, 14px);
  line-height: 1.25;
  font-weight: 600;
  color: var(--p-ink);
  /* Единый регистр названий столов: первая буква каждого слова — заглавная,
     независимо от того, как заведена строка в реестре workspace'ов. */
  text-transform: capitalize;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
}

.ws-switcher__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(var(--p-1) * 1.5) var(--p-2) calc(var(--p-1) * 1.5) var(--p-3);
  border-top: 1px solid var(--p-line);
  background: var(--p-surface-2);
  font-size: var(--p-fs-meta);
  line-height: 1;
  font-weight: 500;
  color: var(--p-ink-2);
  transition: color 0.15s ease;
}
.ws-switcher__keys {
  display: inline-flex;
  gap: 2px;
}
.ws-switcher:hover .ws-switcher__footer {
  color: var(--p-primary);
}
</style>
