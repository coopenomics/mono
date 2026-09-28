<template lang="pug">
div
  // Лоадер пока получаем статус аккаунта
  WindowLoader(v-if="chatcoopStore.isLoading", :text="$t('chatcoop.chatCoopPage.checkingStatusText')")

  // Сообщение об ошибке
  div(v-else-if="chatcoopStore.error", class="error-message")
    p {{ chatcoopStore.error }}
    button(@click="retryLoadStatus", class="retry-button") {{ $t('chatcoop.chatCoopPage.retryLabel') }}

  // Виджет регистрации Matrix аккаунта
  MatrixRegistration(
    v-else-if="chatcoopStore.accountStatus && !chatcoopStore.accountStatus.hasAccount",
    @account-created="handleAccountCreated"
  )

  // Лоадер пока загружается iframe Matrix клиента
  WindowLoader(
    v-else-if="iframeSrc && isIframeLoading",
    :text="$t('chatcoop.chatCoopPage.loadingClientText')"
  )

  // Заглушка для мобильных устройств
  div(v-else-if="isMobile", class="mobile-stub")
    div.mobile-stub-content
      div.mobile-icon
        i.fas.fa-mobile-alt
      h2 {{ $t('chatcoop.chatCoopPage.mobileAvailableTitle') }}
      p {{ $t('chatcoop.chatCoopPage.mobileAvailableHint') }}
      p {{ $t('chatcoop.chatCoopPage.mobileInstructionsHint') }}
      q-btn(@click="goToMobileClient", class="mobile-button", color="primary", icon="fa-mobile-alt")
        | {{ $t('chatcoop.chatCoopPage.goToMobileClientLabel') }}

  // Iframe с Matrix клиентом после полной загрузки
  iframe(
    v-else-if="iframeSrc",
    v-show="!isIframeLoading",
    :src="iframeSrc",
    class="matrix-iframe",
    frameborder="0",
    width="100%",
    :style="{ height: 'calc(100vh - 51px)' }"
    @load="onIframeLoaded"
    allow="camera; microphone; display-capture"
  )
</template>

<script lang="ts" setup>
import { computed, ref, onMounted, watch } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CHAT_ACCOUNT_LIVE_TABLES } from 'app/extensions/chatcoop/shared/lib/live';
import { useRoute, useRouter } from 'vue-router';
import { WindowLoader } from 'src/shared/ui/Loader';
import { useChatCoopChatStore } from '../../../entities/ChatCoopChat/model';
import { MatrixRegistration } from '../../../widgets/MatrixRegistration';
import { useWindowSize } from 'src/shared/hooks/useWindowSize';
import { buildMatrixIframeSrc } from '../../../shared/lib/matrixIframeDeepLink';

const chatcoopStore = useChatCoopChatStore();
const router = useRouter();
const route = useRoute();
const { isMobile } = useWindowSize();
const isIframeLoading = ref(true);
let iframeLoadTimeout: number | null = null;

const matrixRoomParam = computed((): string | undefined => {
  const q = route.query.matrix_room;
  if (Array.isArray(q)) return q[0]?.toString();
  return typeof q === 'string' ? q : undefined;
});

const iframeSrc = computed((): string | undefined => {
  const base = chatcoopStore.accountStatus?.iframeUrl;
  if (!base) return undefined;
  return buildMatrixIframeSrc(base, matrixRoomParam.value);
});

function startIframeLoading() {
  if (!iframeSrc.value) return;

  isIframeLoading.value = true;

  // Очищаем предыдущий таймаут
  if (iframeLoadTimeout) {
    clearTimeout(iframeLoadTimeout);
  }

  // timing: timeout — запасной срок: iframe Matrix не всегда шлёт load, спиннер снимаем через 5 с
  iframeLoadTimeout = window.setTimeout(() => {
    isIframeLoading.value = false;
  }, 5000);
}

// Сбрасываем состояние загрузки iframe при изменении URL
watch(iframeSrc, () => {
  startIframeLoading();
});

function onIframeLoaded() {
  // Очищаем таймаут, если загрузка произошла раньше
  if (iframeLoadTimeout) {
    clearTimeout(iframeLoadTimeout);
    iframeLoadTimeout = null;
  }
  isIframeLoading.value = false;
}

async function retryLoadStatus() {
  chatcoopStore.clearError();
  await chatcoopStore.loadAccountStatus();
}

async function handleAccountCreated() {
  // После успешного создания аккаунта перезагружаем статус
  await chatcoopStore.loadAccountStatus();
}

function goToMobileClient() {
  router.push({ name: 'chatcoop-mobile' });
}

onMounted(async () => {
  await chatcoopStore.loadAccountStatus();
  // Инициализируем загрузку iframe после получения статуса аккаунта
  startIframeLoading();
});

// Учётная запись в Matrix живёт по ленте: созданная или пересозданная запись
// сразу меняет состояние экрана (iframe перезагружается только при смене адреса).
useLiveReload(CHAT_ACCOUNT_LIVE_TABLES, () => chatcoopStore.loadAccountStatus());
</script>

<style scoped>
.matrix-iframe {
  width: 100%;
  border: none;
  display: block;
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 51px);
  text-align: center;
  padding: 2rem;
}

.error-message p {
  margin-bottom: 1rem;
  color: #dc3545;
  font-size: 1.1rem;
}

.retry-button {
  padding: 0.5rem 1rem;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-size: 1rem;
}

.retry-button:hover {
  background-color: #0056b3;
}

.mobile-stub {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 51px);
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
}

.mobile-stub-content {
  text-align: center;
  padding: 2rem;
  max-width: 400px;
}

.mobile-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  opacity: 0.9;
}

.mobile-stub-content h2 {
  margin: 0 0 1rem 0;
  font-size: 2rem;
  font-weight: 600;
}

.mobile-stub-content p {
  margin: 0 0 1.5rem 0;
  opacity: 0.9;
  line-height: 1.6;
  font-size: 1.1rem;
}

.mobile-button {
  margin-top: 1rem;
}
</style>
