import { computed, onMounted, watch } from 'vue';
import { useQuasar } from 'quasar';
import { useRoute } from 'vue-router';
import { useWindowSize } from 'vue-window-size';
import { useSystemStore } from 'src/entities/System/model';
import { useSessionStore } from 'src/entities/Session';
import { useCurrentUser } from 'src/entities/Session';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { useDesktopStore } from 'src/entities/Desktop/model';

export function useDefaultLayoutLogic() {
  const $q = useQuasar();
  const { width } = useWindowSize();
  const route = useRoute();
  const session = useSessionStore();
  const currentUser = useCurrentUser();
  const cooperativeStore = useCooperativeStore();
  const system = useSystemStore();
  const desktop = useDesktopStore();

  cooperativeStore.loadContacts();

  // Теперь используем состояние из desktop store
  const leftDrawerOpen = computed({
    get: () => desktop.leftDrawerOpen,
    set: (value: boolean) => desktop.setLeftDrawerOpen(value),
  });

  const isMobile = computed(() => width.value < 768);
  const isDark = computed(() => $q.dark.isActive);
  const headerClass = computed(() =>
    isDark.value ? 'text-white bg-dark' : 'text-black bg-light',
  );

  const isRegistrationComplete = computed(
    () => currentUser.isRegistrationComplete.value,
  );

  const loggedIn = computed(
    () => isRegistrationComplete.value && session.isAuth,
  );
  const showDrawer = computed(
    () => route.params.coopname === system.info.coopname,
  );

  const footerText = computed(() => {
    const c = cooperativeStore.contacts;
    const d = c?.details;
    return d
      ? `${c.full_name}, ИНН: ${d.inn}, ОГРН: ${d.ogrn}, телефон: ${c.phone}, почта: ${c.email}`
      : '';
  });

  onMounted(() => {
    if (isMobile.value || !loggedIn.value) {
      desktop.setLeftDrawerOpen(false);
    }
  });

  watch(loggedIn, (v) => {
    desktop.setLeftDrawerOpen(v);
  });

  const toggleLeftDrawer = () => {
    desktop.toggleLeftDrawer();
  };

  return {
    leftDrawerOpen,
    isMobile,
    loggedIn,
    isRegistrationComplete,
    showDrawer,
    headerClass,
    footerText,
    toggleLeftDrawer,
  };
}
