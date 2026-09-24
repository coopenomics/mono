<template lang="pug">
div.mobile-client-page
  // Лоадер пока получаем статус аккаунта
  WindowLoader(v-if="chatcoopStore.isLoading", :text="$t('chatcoop.mobileClientPage.checkingStatusText')")

  // Сообщение об ошибке
  div(v-else-if="chatcoopStore.error", class="error-message")
    p {{ chatcoopStore.error }}
    button(@click="retryLoadStatus", class="retry-button") {{ $t('chatcoop.mobileClientPage.retryLabel') }}

  // Сообщение для пользователей без аккаунта
  div(v-else-if="!chatcoopStore.accountStatus || !chatcoopStore.accountStatus.hasAccount", class="no-account-message")
    div.no-account-icon
      i.fas.fa-mobile-alt
    h2 {{ $t('chatcoop.mobileClientPage.noAccountTitle') }}
    p {{ $t('chatcoop.mobileClientPage.noAccountHint1') }}
    p {{ $t('chatcoop.mobileClientPage.noAccountHint2') }}
    p {{ $t('chatcoop.mobileClientPage.noAccountHint3') }}
    q-btn(@click="goToRegistration", class="register-button")
      i.fas.fa-arrow-left.q-mr-sm
      | {{ $t('chatcoop.mobileClientPage.goToRegistrationLabel') }}

  // Инструкции для пользователей с аккаунтом
  div(v-else-if="chatcoopStore.accountStatus?.hasAccount && chatcoopStore.accountStatus?.matrixUsername", class="mobile-instructions")
    div.header
      h1 {{ $t('chatcoop.mobileClientPage.pageTitle') }}
      p {{ $t('chatcoop.mobileClientPage.pageSubtitle') }}

    div.instruction-steps
      div.step
        div.step-number 1
        div.step-content
          h3 {{ $t('chatcoop.mobileClientPage.step1Title') }}
          p {{ $t('chatcoop.mobileClientPage.step1Hint') }}
          div.download-links
            a(href="https://play.google.com/store/apps/details?id=io.element.android.x", target="_blank", class="download-link")
              i.fab.fa-google-play
              | Google Play
            a(href="https://apps.apple.com/us/app/element-x-secure-chat-call/id1631335820", target="_blank", class="download-link")
              i.fab.fa-app-store
              | App Store
            a(href="https://element.io/download", target="_blank", class="download-link")
              i.fas.fa-globe
              | {{ $t('chatcoop.mobileClientPage.otherPlatformsLabel') }}

      div.step
        div.step-number 2
        div.step-content
          h3 {{ $t('chatcoop.mobileClientPage.step2Title') }}
          p {{ $t('chatcoop.mobileClientPage.step2Hint') }}

      div.step
        div.step-number 3
        div.step-content
          h3 {{ $t('chatcoop.mobileClientPage.step3Title') }}
          p {{ $t('chatcoop.mobileClientPage.step3Hint') }}

      div.step
        div.step-number 4
        div.step-content
          h3 {{ $t('chatcoop.mobileClientPage.step4Title') }}
          div.server-input
            input(
              id="homeserver",
              type="text",
              :value="homeserverUrl",
              readonly,
              class="server-url-input"
            )
            button(@click="copyToClipboard", class="copy-button")
              i.fas.fa-copy
              | {{ $t('common.action.copy') }}

      div.step
        div.step-number 5
        div.step-content
          h3 {{ $t('chatcoop.mobileClientPage.step5Title') }}
          p {{ $t('chatcoop.mobileClientPage.step5Hint') }}
          ul.credentials-list
            li
              strong {{ $t('chatcoop.mobileClientPage.usernameLabel') }}
              |  {{ chatcoopStore.accountStatus?.matrixUsername || $t('chatcoop.mobileClientPage.loadingLabel') }}
            li
              strong {{ $t('chatcoop.mobileClientPage.passwordLabel') }}
              |  {{ $t('chatcoop.mobileClientPage.passwordHint') }}

  // Сообщение если аккаунт есть, но нет matrixUsername
  div(v-else-if="chatcoopStore.accountStatus?.hasAccount && !chatcoopStore.accountStatus?.matrixUsername", class="error-message")
    p {{ $t('chatcoop.mobileClientPage.missingCredentialsHint') }}
    p {{ $t('chatcoop.mobileClientPage.missingCredentialsRetryHint') }}
    button(@click="retryLoadStatus", class="retry-button") {{ $t('chatcoop.mobileClientPage.refreshDataLabel') }}
</template>

<script lang="ts" setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { WindowLoader } from 'src/shared/ui/Loader';
import { SuccessAlert } from 'src/shared/api';
import { useChatCoopChatStore } from '../../../entities/ChatCoopChat/model';
import { t } from '../../../i18n';

const chatcoopStore = useChatCoopChatStore();
const router = useRouter();

const homeserverUrl = computed(() => {
  const username = chatcoopStore.accountStatus?.matrixUsername;
  if (username && username.includes(':')) {
    return username.split(':')[1];
  }
  return 'chat.coopenomics.world';
});

async function retryLoadStatus() {
  chatcoopStore.clearError();
  await chatcoopStore.loadAccountStatus();
}

async function copyToClipboard() {
  try {
    await navigator.clipboard.writeText(homeserverUrl.value);
    SuccessAlert(t('chatcoop.mobileClientPage.copiedMessage'));
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
  }
}

function goToRegistration() {
  router.push({ name: 'chatcoop-chat' });
}

onMounted(async () => {
  await chatcoopStore.loadAccountStatus();
});
</script>

<style scoped>
.mobile-client-page {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.no-account-message {
  text-align: center;
  padding: 3rem 2rem;
  background: #f8f9fa;
  border-radius: 8px;
  border: 2px dashed #dee2e6;
}

.no-account-icon {
  font-size: 4rem;
  color: #6c757d;
  margin-bottom: 1.5rem;
}

.no-account-message h2 {
  color: #495057;
  margin-bottom: 1rem;
  font-size: 1.5rem;
}

.no-account-message p {
  color: #6c757d;
  margin-bottom: 1rem;
  line-height: 1.6;
}

.register-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: #007bff;
  color: white;
  text-decoration: none;
  border-radius: 6px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.register-button:hover {
  background: #0056b3;
}

.mobile-instructions {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 2rem;
  text-align: center;
}

.header h1 {
  margin: 0 0 0.5rem 0;
  font-size: 2rem;
  font-weight: 600;
}

.header p {
  margin: 0;
  opacity: 0.9;
  font-size: 1.1rem;
}

.instruction-steps {
  padding: 2rem;
}

.step {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 2rem;
  align-items: flex-start;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: #007bff;
  color: white;
  border-radius: 50%;
  font-weight: bold;
  font-size: 1.2rem;
  flex-shrink: 0;
}

.step-content h3 {
  margin: 0 0 0.5rem 0;
  color: #495057;
  font-size: 1.2rem;
  font-weight: 600;
}

.step-content p {
  margin: 0 0 1rem 0;
  color: #6c757d;
  line-height: 1.6;
}

.download-links {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.download-link {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #f8f9fa;
  color: #495057;
  text-decoration: none;
  border-radius: 6px;
  border: 1px solid #dee2e6;
  transition: all 0.2s;
}

.download-link:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.server-input {
  margin-top: 1rem;
}

.server-input label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #495057;
}

.server-url-input {
  width: 100%;
  padding: 0.75rem;
  border: 2px solid #dee2e6;
  border-radius: 6px;
  font-family: monospace;
  font-size: 1rem;
  background: #f8f9fa;
  margin-bottom: 0.5rem;
}

.copy-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: background-color 0.2s;
}

.copy-button:hover {
  background: #218838;
}

.credentials-list {
  background: #f8f9fa;
  padding: 1rem;
  border-radius: 6px;
  border-left: 4px solid #007bff;
}

.credentials-list li {
  margin-bottom: 0.5rem;
  line-height: 1.5;
  color: #495057;
}

.credentials-list li:last-child {
  margin-bottom: 0;
}

.account-info {
  background: #f8f9fa;
  padding: 1.5rem;
  margin: 2rem;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.account-info h3 {
  margin: 0 0 1rem 0;
  color: #495057;
  font-size: 1.1rem;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 0;
}

.info-item .label {
  font-weight: 500;
  color: #495057;
}

.info-item .value {
  font-family: monospace;
  background: white;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  border: 1px solid #dee2e6;
  color: #495057;
}

.error-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 50vh;
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
</style>
