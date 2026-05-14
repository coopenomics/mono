import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/pages/HomePage.vue'),
  },
  {
    path: '/:contract/:processType',
    name: 'process',
    component: () => import('@/pages/ProcessPage.vue'),
    props: true,
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/pages/NotFoundPage.vue'),
  },
];

export const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior(to, from) {
    // Скроллим к началу только при смене процесса (params.processType).
    // При смене query (фокуса) не двигаем — user смотрит на ту же область.
    const changedProcess =
      to.name !== from.name || to.params.processType !== from.params.processType;
    if (!changedProcess) return false;
    if (typeof document !== 'undefined') {
      const main = document.querySelector('.app-main');
      if (main) {
        main.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
    return { top: 0 };
  },
});
