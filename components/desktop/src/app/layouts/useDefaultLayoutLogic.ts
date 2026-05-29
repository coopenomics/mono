import { computed, onMounted, watch, ref } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import { useWindowSize } from 'vue-window-size';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useDesktopStore } from 'src/entities/Desktop/model';

export function useDefaultLayoutLogic() {
  const $q = useQuasar();
  const { width } = useWindowSize();
  const route = useRoute();
  const session = useSessionStore();
  const system = useSystemStore();
  const desktop = useDesktopStore();

  // Теперь используем состояние из desktop store
  const leftDrawerOpen = computed({
    get: () => desktop.leftDrawerOpen,
    set: (value: boolean) => desktop.setLeftDrawerOpen(value),
  });

  // Переменная для управления видимостью правого drawer
  const rightDrawerOpen = ref(true);

  const isMobile = computed(() => width.value < 768);
  const isDark = computed(() => $q.dark.isActive);
  const headerClass = computed(() =>
    isDark.value ? 'text-white bg-dark' : 'text-black bg-light',
  );

  const isRegistrationComplete = computed(
    () => session.isRegistrationComplete,
  );

  const loggedIn = computed(
    () => isRegistrationComplete.value && session.isAuth,
  );
  const showDrawer = computed(
    () => route.params.coopname === system.info.coopname,
  );

  const footerText = computed(() => {
    const info = system.info;
    if (!info.contacts || !info.contacts.full_name)
      return ''

    return `${info.contacts?.full_name}, ИНН: ${info.contacts?.details.inn}, ОГРН: ${info.contacts?.details.ogrn}, телефон: ${info.contacts?.phone}, почта: ${info.contacts?.email}`;
  });

  onMounted(() => {
    if (isMobile.value || !loggedIn.value) {
      desktop.setLeftDrawerOpen(false);
    }
  });

  watch(loggedIn, (v) => {
    desktop.setLeftDrawerOpen(v);
  });

  // На мобиле закрываем левый дровер при любой смене маршрута, чтобы выбор
  // пункта меню сразу скрывал overlay-дровер — иначе после перехода требуется
  // лишний тап «закрыть». Watch на route надёжнее ручного вызова в onSelect
  // конкретных меню: ловит и программные router.push, и WorkspaceSwitcher,
  // и любые другие источники навигации.
  watch(
    () => route.fullPath,
    () => {
      if (isMobile.value) {
        desktop.setLeftDrawerOpen(false);
      }
    },
  );

  const toggleLeftDrawer = () => {
    desktop.toggleLeftDrawer();
  };

  const toggleRightDrawer = () => {
    rightDrawerOpen.value = !rightDrawerOpen.value;
  };

  return {
    leftDrawerOpen,
    rightDrawerOpen,
    isMobile,
    loggedIn,
    isRegistrationComplete,
    showDrawer,
    headerClass,
    footerText,
    toggleLeftDrawer,
    toggleRightDrawer,
  };
}
