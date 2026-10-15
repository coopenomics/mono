import { reactive, computed } from 'vue';
import { IWidgetConfig, DEFAULT_WIDGET_CONFIG } from 'src/shared/config/widget';

// Проверка на существование window (для SSR)
const isClient = typeof window !== 'undefined';

// Глобальное состояние виджета
const widgetState = reactive({
  isWidget: false,
  isReady: false,
  parentOrigin: '',
  config: { ...DEFAULT_WIDGET_CONFIG } as IWidgetConfig,
});

// Параметры URL для widget режима
const WIDGET_URL_PARAMS = {
  WIDGET_MODE: 'widget',
  WIDGET_CONFIG: 'widget_config',
  WIDGET_ORIGIN: 'widget_origin',
  WIDGET_PAGE: 'widget_page',
} as const;

export class WidgetMode {
  private static instance: WidgetMode | null = null;
  private isInitialized = false;

  private constructor() {
    // Инициализация только на клиенте
    if (isClient) {
      this.detectWidgetMode();
      this.isInitialized = true;
    }
  }

  // Singleton pattern
  public static getInstance(): WidgetMode {
    if (!WidgetMode.instance) {
      WidgetMode.instance = new WidgetMode();
    }
    return WidgetMode.instance;
  }

  // Определение режима виджета
  private detectWidgetMode(): void {
    // Проверяем только на клиенте
    if (!isClient) return;

    const urlParams = new URLSearchParams(window.location.search);
    const isInIframe = window.parent !== window;
    const widgetModeParam = urlParams.get(WIDGET_URL_PARAMS.WIDGET_MODE);

    // Проверяем различные условия для widget режима
    widgetState.isWidget = isInIframe || widgetModeParam === 'true';

    if (widgetState.isWidget) {
      this.initializeWidgetMode(urlParams);
    }
  }

  // Инициализация widget режима
  private initializeWidgetMode(urlParams: URLSearchParams): void {
    if (!isClient) return;

    // Получаем origin родительского окна
    try {
      widgetState.parentOrigin = document.referrer || '*';
    } catch {
      widgetState.parentOrigin = '*';
    }

    // Загружаем конфигурацию из URL параметров
    const configParam = urlParams.get(WIDGET_URL_PARAMS.WIDGET_CONFIG);
    if (configParam) {
      try {
        const urlConfig = JSON.parse(decodeURIComponent(configParam));
        widgetState.config = { ...widgetState.config, ...urlConfig };
      } catch (e) {
        console.warn('[Widget Mode] Invalid config in URL:', e);
      }
    }

    // Добавляем parent origin в разрешенные если не указан
    if (
      widgetState.parentOrigin &&
      !widgetState.config.allowedOrigins.includes(widgetState.parentOrigin)
    ) {
      widgetState.config.allowedOrigins.push(widgetState.parentOrigin);
    }

    // Включаем widget режим
    widgetState.config.enabled = true;

    // Применяем настройки для iframe
    this.applyWidgetStyles();
    this.setupWidgetEnvironment();
  }

  // Применение стилей для widget режима
  private applyWidgetStyles(): void {
    if (!isClient) return;

    // Убираем лишние элементы UI
    const style = document.createElement('style');
    // i18n-ignore: CSS-стили, не текст интерфейса
    style.textContent = `
      /* Widget Mode Styles */
      body.widget-mode {
        margin: 0;
        padding: 0;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .widget-mode .q-layout {
        min-height: auto !important;
      }

      .widget-mode .q-page {
        min-height: auto !important;
      }

      /* Скрываем элементы если нужно */
      .widget-mode .widget-hide-header .q-header {
        display: none !important;
      }

      .widget-mode .widget-hide-footer .q-footer {
        display: none !important;
      }

      /* Компактные отступы */
      .widget-mode .q-page-container {
        padding-top: 0 !important;
        padding-bottom: 0 !important;
      }

      /* Темная тема */
      .widget-mode.widget-theme-dark {
        background: #1a1a1a;
        color: white;
      }

      /* Светлая тема */
      .widget-mode.widget-theme-light {
        background: white;
        color: #1a1a1a;
      }
    `;

    document.head.appendChild(style);
  }

  // Настройка окружения для widget режима
  private setupWidgetEnvironment(): void {
    if (!isClient) return;

    // Добавляем CSS классы
    document.body.classList.add('widget-mode');

    if (widgetState.config.theme) {
      document.body.classList.add(`widget-theme-${widgetState.config.theme}`);
    }

    if (widgetState.config.hideHeader) {
      document.body.classList.add('widget-hide-header');
    }

    if (widgetState.config.hideFooter) {
      document.body.classList.add('widget-hide-footer');
    }

    // Предотвращаем навигацию если отключена
    if (widgetState.config.disableNavigation) {
      this.disableNavigation();
    }

    // Ограничиваем размеры если заданы
    if (widgetState.config.maxWidth || widgetState.config.maxHeight) {
      this.applyDimensionLimits();
    }
  }

  // Отключение навигации
  private disableNavigation(): void {
    if (!isClient) return;

    // Перехватываем попытки навигации
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (state, title, url) {
      console.log('[Widget Mode] Navigation blocked:', url);
      return originalPushState.call(this, state, title, url);
    };

    history.replaceState = function (state, title, url) {
      console.log('[Widget Mode] Navigation blocked:', url);
      return originalReplaceState.call(this, state, title, url);
    };
  }

  // Применение ограничений размеров
  private applyDimensionLimits(): void {
    if (!isClient) return;

    const style = document.createElement('style');
    let cssRules = '';

    if (widgetState.config.maxWidth) {
      cssRules += `max-width: ${widgetState.config.maxWidth}px;`;
    }

    if (widgetState.config.maxHeight) {
      cssRules += `max-height: ${widgetState.config.maxHeight}px;`;
    }

    if (cssRules) {
      style.textContent = `
        .widget-mode {
          ${cssRules}
          overflow: hidden;
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Получение текущего состояния
  public getState() {
    return {
      ...widgetState,
      isWidget: computed(() => widgetState.isWidget),
      isReady: computed(() => widgetState.isReady),
      config: computed(() => widgetState.config),
    };
  }

  // Обновление конфигурации
  public updateConfig(newConfig: Partial<IWidgetConfig>): void {
    Object.assign(widgetState.config, newConfig);

    // Переприменяем стили если изменились настройки отображения
    if (newConfig.theme || newConfig.hideHeader || newConfig.hideFooter) {
      this.reapplyStyles();
    }
  }

  // Переприменение стилей
  private reapplyStyles(): void {
    if (!isClient) return;

    // Убираем старые классы
    document.body.classList.remove('widget-theme-light', 'widget-theme-dark');
    document.body.classList.remove('widget-hide-header', 'widget-hide-footer');

    // Добавляем новые
    if (widgetState.config.theme) {
      document.body.classList.add(`widget-theme-${widgetState.config.theme}`);
    }

    if (widgetState.config.hideHeader) {
      document.body.classList.add('widget-hide-header');
    }

    if (widgetState.config.hideFooter) {
      document.body.classList.add('widget-hide-footer');
    }
  }

  // Установка готовности
  public setReady(ready: boolean): void {
    widgetState.isReady = ready;
  }

  // Получение layout для router
  public getLayout(): string {
    return widgetState.isWidget ? 'widget' : 'default';
  }

  // Проверка инициализации
  public get initialized(): boolean {
    return this.isInitialized;
  }

  // Принудительная инициализация (для использования на клиенте)
  public forceInitialize(): void {
    if (!this.isInitialized && isClient) {
      this.detectWidgetMode();
      this.isInitialized = true;
    }
  }

  // Создание URL для widget режима
  public static createWidgetUrl(
    baseUrl: string,
    options: {
      page?: string;
      config?: Partial<IWidgetConfig>;
      origin?: string;
    } = {},
  ): string {
    const url = new URL(baseUrl);

    // Добавляем параметры widget режима
    url.searchParams.set(WIDGET_URL_PARAMS.WIDGET_MODE, 'true');

    if (options.page) {
      url.searchParams.set(WIDGET_URL_PARAMS.WIDGET_PAGE, options.page);
    }

    if (options.config) {
      const configJson = JSON.stringify(options.config);
      url.searchParams.set(
        WIDGET_URL_PARAMS.WIDGET_CONFIG,
        encodeURIComponent(configJson),
      );
    }

    if (options.origin) {
      url.searchParams.set(WIDGET_URL_PARAMS.WIDGET_ORIGIN, options.origin);
    }

    return url.toString();
  }
}

// Экспорт для использования в композаблах
export function useWidgetMode() {
  const widgetMode = WidgetMode.getInstance();
  return widgetMode.getState();
}

// Lazy singleton instance - создается только при первом обращении
let _widgetModeInstance: WidgetMode | null = null;

export const widgetModeInstance = {
  getState: () => {
    if (!_widgetModeInstance) {
      _widgetModeInstance = WidgetMode.getInstance();
    }
    return _widgetModeInstance.getState();
  },
  updateConfig: (config: Partial<IWidgetConfig>) => {
    if (!_widgetModeInstance) {
      _widgetModeInstance = WidgetMode.getInstance();
    }
    _widgetModeInstance.updateConfig(config);
  },
  setReady: (ready: boolean) => {
    if (!_widgetModeInstance) {
      _widgetModeInstance = WidgetMode.getInstance();
    }
    _widgetModeInstance.setReady(ready);
  },
  forceInitialize: () => {
    if (!_widgetModeInstance) {
      _widgetModeInstance = WidgetMode.getInstance();
    }
    _widgetModeInstance.forceInitialize();
  },
  get initialized() {
    return _widgetModeInstance ? _widgetModeInstance.initialized : false;
  },
};
