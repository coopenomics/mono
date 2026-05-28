<template lang="pug">
q-header.app-q-header(:bordered='false')
  AppHeader(
    :show-menu-button='loggedIn',
    @toggle-menu="emit('toggle-left-drawer')"
  )
    template(v-if='!loggedIn && coopTitle', #brand)
      span.app-q-header__logo
        span.app-q-header__logo-svg(v-html='logoSvg', aria-hidden='true')
      b {{ coopTitle }}

    template(v-if='loggedIn', #crumb)
      BackButton
      //- Хлебные крошки: путь внутри рабочего стола (например
      //- «Отчётность › Календарь»). Последняя крошка — текущая страница
      //- (ink, bold), предыдущие — приглушённый родитель, между ними
      //- chevron. Корень стола в крошку не выводим. Detail-страница может
      //- задать своё имя через desktopStore.setPageTitleOverride — тогда
      //- крошка одна (название сущности).
      template(v-for='(crumb, idx) in crumbs', :key='idx')
        b(v-if='idx === crumbs.length - 1') {{ crumb }}
        span(v-else) {{ crumb }}
        q-icon(v-if='idx < crumbs.length - 1', name='chevron_right')

    template(v-if='loggedIn', #actions)
      //- Старый механизм (useHeaderActions store) — для страниц, ещё не
      //- переведённых на Teleport; удалим, когда мигрируем все.
      component(
        v-for='action in headerActions',
        :key='action.id',
        :is='action.component',
        v-bind='action.props'
      )
      //- Новый механизм: страница телепортирует свои действия сюда
      //- через <Teleport to="#header-actions-host">.
      span#header-actions-host.header-actions-host

    template(v-if='loggedIn && isClient', #notifications)
      NotificationCenter

    template(#theme)
      ToogleDarkLight(:is-mobile='isMobile', :show-text='false', :as-button='true')

    template(v-if='!loggedIn', #profile)
      BaseButton(
        v-if="showRegisterButton && !is('signup') && !is('install')",
        variant='primary',
        @click='signup'
      ) Регистрация
      BaseButton(
        v-if="showRegisterButton && is('signup')",
        variant='primary',
        @click='login'
      ) Вход
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import config from 'src/app/config';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useWindowSize, useHeaderActionsReader } from 'src/shared/hooks';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { AppHeader } from 'src/shared/ui/layout/AppHeader';
import { ToogleDarkLight } from 'src/shared/ui/ToogleDarkLight';
import { BackButton } from 'src/widgets/Header/BackButton';
import { NotificationCenter } from 'src/widgets/NotificationCenter';
import logoSvg from 'src/assets/logo.svg?raw';

defineProps({
  showDrawer: {
    type: Boolean,
    required: true,
  },
});

const emit = defineEmits<{
  'toggle-left-drawer': [];
}>();

const route = useRoute();
const router = useRouter();
const session = useSessionStore();
const systemStore = useSystemStore();
const { isMobile } = useWindowSize();
const { headerActions } = useHeaderActionsReader();
const desktopStore = useDesktopStore();

const isClient = computed(() => Boolean(process.env.CLIENT));

const loggedIn = computed(
  () => session.isRegistrationComplete && session.isAuth,
);

// Хлебные крошки: путь внутри рабочего стола. route.matched — цепочка
// совпавших записей от корня стола до листа; берём те, у кого задан
// meta.title. Первый сегмент — корень рабочего стола («Стол бухгалтера»,
// «Капитал») — в крошку не выводим: нужен путь ВНУТРИ стола, поэтому при
// наличии хотя бы одного вложенного уровня отбрасываем его. Для плоской
// страницы (один уровень) остаётся одна крошка — как было раньше.
// Detail-страница задаёт своё имя через desktopStore.setPageTitleOverride —
// оно перекрывает цепочку (крошка одна: название сущности).
const crumbs = computed<string[]>(() => {
  if (desktopStore.pageTitleOverride) return [desktopStore.pageTitleOverride];
  const titled = route.matched.filter((r) => r.meta?.title);
  const trail = titled.length > 1 ? titled.slice(1) : titled;
  return trail.map((r) => r.meta!.title as string);
});

const coopTitle = computed<string>(() => {
  const status = systemStore.info.system_status;
  if (
    status === Zeus.SystemStatus.install ||
    status === Zeus.SystemStatus.initialized
  ) {
    return 'УСТАНОВКА';
  }
  return `${systemStore.info.vars?.short_abbr ?? ''} ${systemStore.info.vars?.name ?? ''}`.trim();
});

const showRegisterButton = computed(() => {
  if (loggedIn.value) return false;
  return config.registrator.showRegisterButton;
});

const is = (what: string): boolean => route.name === what;

function signup(): void {
  void router.push({
    name: 'signup',
    params: { coopname: systemStore.info.coopname },
  });
}

function login(): void {
  void router.push({
    name: 'signin',
    params: { coopname: systemStore.info.coopname },
  });
}
</script>

<style scoped>
.app-q-header {
  background: var(--p-canvas);
  color: var(--p-ink);
  box-shadow: none;
}
/* Бренд-логотип на странице без логина — тот же приём, что в личном
   кабинете (WorkspaceSwitcher): inline-SVG через v-html в зелёном квадрате,
   logo.svg на fill:currentColor наследует color. Зелёный одинаков в обеих
   темах, поэтому переключение темы не требуется. */
.app-q-header__logo {
  flex: 0 0 28px;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--p-primary-soft);
  color: var(--p-primary);
  border-radius: var(--p-r-sm, 8px);
}
.app-q-header__logo-svg {
  display: inline-flex;
  width: 16px;
  height: 16px;
  line-height: 0;
}
.app-q-header__logo-svg :deep(svg) {
  width: 100%;
  height: 100%;
}
/* Teleport-host для действий страницы: прозрачен для layout —
   телепортированные кнопки становятся прямыми flex-детьми .topbar__actions. */
.header-actions-host {
  display: contents;
}
</style>
