/* eslint-disable */

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV: string;
    VUE_ROUTER_MODE: 'hash' | 'history' | 'abstract' | undefined;
    VUE_ROUTER_BASE: string | undefined;
    CLIENT?: string;
    SERVER?: string;
  }
}

declare global {
  interface Window {
    YooMoneyCheckoutWidget: any;
    chatwootSDK: any;
  }
}

import 'vue-router';

declare module 'vue-router' {
  // Расширяем интерфейс RouteMeta, добавляя новые свойства
  interface RouteMeta {
    roles?: string[];
    conditions?: string;
    agreements?: string[];
    title: string;
    icon: string;
    requiresAuth?: boolean;
    hidden?: boolean;
    // Канон авторизации столов: требуемое право (capability «Resource:action»)
    // и признак страницы-шлюза стола. Смысл и правила — IWorkspaceRouteMeta
    // в shared/lib/types/workspace.ts (там же, где их объявляют расширения).
    requires?: string;
    gate?: boolean;
    // Страница открыта в режиме только для чтения (например, карточка
    // предложения, открытая модератором со стола администратора).
    readonly?: boolean;
  }
}
