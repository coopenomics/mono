<template lang="pug">
q-layout(view='hHh lpR fFf', :class='layoutClass')
  // Упрощенный header только если разрешен
  q-header(v-if='!config.hideHeader', :class='headerClass')
    q-toolbar
      q-toolbar-title(v-if='pageTitle') {{ pageTitle }}

      // Кнопка назад если включена навигация
      q-btn(
        v-if='!config.disableNavigation && canGoBack',
        flat,
        dense,
        round,
        icon='arrow_back',
        @click='goBack'
      )

  // Основной контент без footer
  q-page-container
    q-page.widget-page
      // Индикатор загрузки при смене workspace
      .absolute-full.flex.flex-center.z-top(v-if='desktop.isWorkspaceChanging')
        q-spinner(size='2em', color='primary')

      // Основной контент
      router-view(v-else)

  // Упрощенный footer только если разрешен
  q-footer(v-if='!config.hideFooter', :class='footerClass')
    q-toolbar.justify-center
      .text-caption {{ footerText }}
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useWidgetBridge } from 'src/shared/lib/widget/use-widget-bridge';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';

// Подключаем widget bridge
const {
  isWidget,
  isReady,
  widgetData,
  config,
  sendError,
  sendNavigation,
  sendResize,
} = useWidgetBridge({
  hideHeader: true,
  hideFooter: true,
  disableNavigation: false,
});

const route = useRoute();
const router = useRouter();
const desktop = useDesktopStore();
const { info } = useSystemStore();

// Вычисляемые свойства
const layoutClass = computed(() => ({
  'widget-layout': true,
  'widget-layout--ready': isReady.value,
  'widget-layout--no-header': config.hideHeader,
  'widget-layout--no-footer': config.hideFooter,
  [`widget-layout--theme-${config.theme}`]: true,
}));

const headerClass = computed(() => ({
  'widget-header': true,
  'bg-primary': config.theme === 'light',
  'bg-dark': config.theme === 'dark',
  'text-white': true,
}));

const footerClass = computed(() => ({
  'widget-footer': true,
  'bg-grey-3': config.theme === 'light',
  'bg-grey-8': config.theme === 'dark',
}));

const pageTitle = computed(() => {
  return route.meta?.title || info.coopname || t('app.widget.defaultTitle');
});

const canGoBack = computed(() => {
  const historyState = router.options.history.state;
  return (
    historyState &&
    typeof historyState.position === 'number' &&
    historyState.position > 0
  );
});

const footerText = computed(() => {
  return info.coopname || t('app.widget.defaultFooter');
});

// Методы
function goBack() {
  if (canGoBack.value) {
    router.back();
  }
}

// Отправка данных о навигации
watch(
  route,
  (newRoute) => {
    if (isWidget.value && isReady.value) {
      sendNavigation(newRoute.fullPath);
    }
  },
  { immediate: true },
);

// Обработка ошибок
const originalConsoleError = console.error;
console.error = (...args) => {
  originalConsoleError.apply(console, args);

  if (isWidget.value && isReady.value) {
    sendError({
      message: args.join(' '),
      source: 'console',
      timestamp: Date.now(),
    });
  }
};

// Обработка данных виджета
watch(widgetData, (newData) => {
  if (newData) {
    console.log('[Widget Layout] Received data:', newData);
    // Здесь можно обработать входящие данные
  }
});

// Автоматическое обновление размеров при изменении контента
onMounted(() => {
  if (isWidget.value) {
    // Наблюдаем за изменениями DOM
    const observer = new MutationObserver(() => {
      // Небольшая задержка для корректного вычисления размеров
      setTimeout(() => {
        const body = document.body;
        const height = Math.max(
          body.scrollHeight,
          body.offsetHeight,
          document.documentElement.clientHeight,
          document.documentElement.scrollHeight,
          document.documentElement.offsetHeight,
        );

        sendResize({
          width: body.offsetWidth,
          height: height,
        });
      }, 100);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class'],
    });
  }
});
</script>

<style lang="scss" scoped>
.widget-layout {
  // Убираем все лишние отступы
  &.q-layout {
    min-height: auto;
  }

  // Компактный header
  .widget-header {
    min-height: 40px;

    .q-toolbar {
      min-height: 40px;
      padding: 0 8px;
    }
  }

  // Компактный footer
  .widget-footer {
    min-height: 30px;

    .q-toolbar {
      min-height: 30px;
      padding: 0 8px;
    }
  }

  // Основная страница виджета
  .widget-page {
    padding: 8px;

    // Убираем стандартные отступы если скрыты header/footer
    &.q-page {
      min-height: auto;
    }
  }

  // Стили для скрытых элементов
  &.widget-layout--no-header .widget-page {
    padding-top: 8px;
  }

  &.widget-layout--no-footer .widget-page {
    padding-bottom: 8px;
  }

  // Темы
  &.widget-layout--theme-light {
    background: white;
    color: #1a1a1a;
  }

  &.widget-layout--theme-dark {
    background: #1a1a1a;
    color: white;
  }

  // Состояние готовности
  &.widget-layout--ready {
    opacity: 1;
    transition: opacity 0.3s ease;
  }

  &:not(.widget-layout--ready) {
    opacity: 0.7;
  }
}

// Глобальные стили для виджета
:deep(.q-layout__section--marginal) {
  // Уменьшаем отступы для всех секций
  z-index: 1;
}

:deep(.q-page-container) {
  // Убираем лишние отступы
  padding-top: 0;
  padding-bottom: 0;
}

// Убираем скроллбары для iframe
:deep(html) {
  overflow: hidden;
}

:deep(body) {
  overflow: hidden;
}
</style>
