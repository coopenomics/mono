<template lang="pug">
button.ws-switcher(
  v-bind='$attrs',
  type='button',
  :aria-haspopup='workspaces.length > 1 ? "menu" : undefined'
)
  span.ws-switcher__icon
    span.ws-switcher__icon-svg(v-html='logoSvg')
  .ws-switcher__text
    span.ws-switcher__caption(:title='coopBrand') {{ coopBrand }}
    span.ws-switcher__title(:title='currentTitle') {{ currentTitle }}
  q-icon.ws-switcher__chevron(v-if='workspaces.length > 1', name='expand_more', size='18px')

  q-menu(
    v-if='workspaces.length > 1',
    v-model='menuOpen',
    anchor='bottom left',
    self='top left',
    :offset='[0, 6]',
    class='ws-switcher__menu'
  )
    q-list(padding)
      q-item.ws-switcher__item(
        v-for='ws in workspaces',
        :key='ws.workspaceName',
        clickable,
        v-close-popup,
        :active='ws.workspaceName === activeWorkspaceName',
        @click='onSelect(ws.workspaceName)'
      )
        q-item-section(avatar)
          q-icon(:name='ws.icon || "fa-solid fa-desktop"', size='18px')
        q-item-section
          q-item-label {{ ws.title }}

//- Затемнение фона при открытом меню — рендерим в body чтобы overlay
//- покрывал всё, включая контент за drawer'ом.
Teleport(to='body')
  .ws-switcher__scrim(v-if='menuOpen', aria-hidden='true')
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import logoSvg from 'src/assets/logo.svg?raw';

// Шаблон двухкорневой (кнопка + Teleport для затемнения), поэтому
// автонаследование атрибутов отключаем и вручную направляем class и
// прочие внешние атрибуты на корневую кнопку — иначе Vue ругается, что
// class некуда применить.
defineOptions({ inheritAttrs: false });

const router = useRouter();
const desktop = useDesktopStore();
const system = useSystemStore();
const session = useSessionStore();

const activeWorkspaceName = computed(() => desktop.activeWorkspaceName);
const menuOpen = ref<boolean>(false);

/**
 * Иерархия ролей: chairman ⊇ member ⊇ user.
 * Председатель видит столы любых ролей; член совета — user+member; пайщик — только user.
 * Workspace без meta.roles или с пустым массивом — публичный.
 */
const ROLE_HIERARCHY = ['user', 'member', 'chairman'] as const;
type RoleLevel = (typeof ROLE_HIERARCHY)[number];

const currentRole = computed<RoleLevel>(() =>
  session.isChairman ? 'chairman' : session.isMember ? 'member' : 'user',
);

const workspaces = computed(() => {
  const userLevel = ROLE_HIERARCHY.indexOf(currentRole.value);
  return desktop.workspaceMenus.filter((ws) => {
    const roles = ws.meta?.roles as string[] | undefined;
    if (!roles || roles.length === 0) return true;
    return roles.some((r) => {
      const lvl = ROLE_HIERARCHY.indexOf(r as RoleLevel);
      return lvl >= 0 && lvl <= userLevel;
    });
  });
});

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
  return system.info.coopname || 'Кооператив';
});

const currentTitle = computed<string>(() => {
  const active = workspaces.value.find(
    (ws) => ws.workspaceName === activeWorkspaceName.value,
  );
  return active?.title || 'Рабочий стол';
});

function onSelect(name: string): void {
  if (name === activeWorkspaceName.value) return;
  desktop.selectWorkspace(name);
  desktop.goToDefaultPage(router);
}
</script>

<style scoped>
.ws-switcher {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  width: 100%;
  padding: var(--p-2, 8px);
  margin: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--p-radius-md, 8px);
  color: var(--p-ink);
  cursor: pointer;
  text-align: left;
  font: inherit;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}
.ws-switcher:hover {
  background: var(--p-surface);
  border-color: var(--p-line);
}

.ws-switcher__icon {
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft, rgba(13, 148, 136, 0.12));
  color: var(--p-primary);
  border-radius: var(--p-radius-md, 8px);
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
  font-size: var(--p-fs-caption, 11px);
  line-height: 1.2;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--p-ink-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
/* Title допускает перенос на 3 строки — чтобы «Стол вычислительных ресурсов»
   полностью помещался. Дальше — ellipsis. */
.ws-switcher__title {
  font-size: var(--p-fs-body, 14px);
  line-height: 1.25;
  font-weight: 600;
  color: var(--p-ink);
  /* Единый регистр названий столов: первая буква каждого слова — заглавная,
     независимо от того, как заведена строка в реестре workspace'ов. */
  text-transform: capitalize;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  word-break: break-word;
  padding-top: 2px;
}

.ws-switcher__chevron {
  flex: 0 0 18px;
  color: var(--p-ink-3, var(--p-ink-2));
  align-self: flex-start;
  margin-top: var(--p-1, 4px);
}

/* Меню выбора стола: canon-padding по краям, отступы вокруг
   иконки и текста чтобы они не упирались в края. */
.ws-switcher__menu :deep(.q-list) {
  min-width: 240px;
  padding: var(--p-1, 4px);
}
.ws-switcher__item {
  padding: var(--p-2, 8px) var(--p-3, 12px);
  border-radius: var(--p-radius-md, 8px);
  min-height: 0;
}
.ws-switcher__item :deep(.q-item__section--avatar) {
  min-width: 32px;
  padding-right: var(--p-2, 8px);
}
/* Тот же единый регистр для подписей пунктов списка. */
.ws-switcher__item :deep(.q-item__label) {
  text-transform: capitalize;
}

/* Затемнение фона за menu — не сливаемся с контентом за drawer'ом. */
.ws-switcher__scrim {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.32);
  z-index: 5999; /* q-menu = 6000 — scrim чуть ниже */
  pointer-events: none;
  animation: ws-switcher-scrim-in 0.15s ease;
}
@keyframes ws-switcher-scrim-in {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
