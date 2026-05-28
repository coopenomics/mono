<template>
  <AuthCard
    :title="title"
    :subtitle="subtitle"
    :max-width="mode === 'save-key' ? 560 : 480"
  >
    <!-- Шаг ожидания письма -->
    <template v-if="mode === 'check-mail'">
      <BaseBanner variant="info">
        Письмо со ссылкой для перевыпуска ключа отправлено на указанную почту.
        Перейдите по ссылке, чтобы продолжить.
      </BaseBanner>
    </template>

    <!-- Шаг сохранения ключа -->
    <template v-else-if="account">
      <p class="rk-form__lead">
        Новый приватный ключ сгенерирован прямо в вашем браузере и не передаётся
        на серверы. Сохраните его в надёжном месте — рекомендуем менеджер
        паролей, например
        <a href="https://bitwarden.com/download" target="_blank" rel="noopener">Bitwarden</a>.
        Без ключа доступ к аккаунту восстановить нельзя.
      </p>

      <BaseInput
        :model-value="account.private_key"
        label="Приватный ключ"
        readonly
        mono
      />

      <div class="rk-form__copy">
        <BaseButton
          variant="ghost"
          size="sm"
          :aria-label="copied ? 'Скопировано' : 'Скопировать ключ'"
          @click="copy"
        >
          <template #icon-left>
            <q-icon :name="copied ? 'check' : 'content_copy'" />
          </template>
          {{ copied ? 'Скопировано' : 'Копировать ключ' }}
        </BaseButton>
      </div>

      <q-checkbox
        v-model="iSave"
        class="rk-form__confirm"
        label="Я сохранил ключ"
        color="primary"
      />

      <BaseButton
        variant="primary"
        :loading="loading"
        :disabled="!iSave"
        block
        @click="submit"
      >
        Установить ключ
      </BaseButton>
    </template>

    <template v-else>
      <BaseBanner variant="neg">
        Не удалось сгенерировать ключ. Обновите страницу и попробуйте снова.
      </BaseBanner>
    </template>
  </AuthCard>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import { AuthCard } from 'src/shared/ui/domain/AuthCard';
import type { ResetKeyFormProps } from './ResetKeyForm.types';

const props = withDefaults(defineProps<ResetKeyFormProps>(), {
  loading: false,
  account: null,
});

const emit = defineEmits<{
  copy: [];
  submit: [];
}>();

const copied = ref(false);
const iSave = ref(false);

const title = computed(() =>
  props.mode === 'save-key' ? 'Сохраните ключ' : 'Проверьте почту',
);
const subtitle = computed(() =>
  props.mode === 'save-key'
    ? 'Новый приватный ключ сгенерирован и готов к сохранению'
    : 'Мы отправили ссылку для перевыпуска ключа',
);

async function copy(): Promise<void> {
  if (!props.account) return;
  try {
    await copyToClipboard(props.account.private_key);
    copied.value = true;
    Notify.create({
      message: 'Ключ скопирован',
      type: 'positive',
      position: 'top',
      timeout: 1500,
    });
    emit('copy');
  } catch {
    Notify.create({
      message: 'Не удалось скопировать. Перенесите ключ вручную.',
      type: 'negative',
      position: 'top',
    });
  }
}

function submit(): void {
  if (!iSave.value || !props.account) return;
  emit('submit');
}
</script>

<style scoped>
.rk-form__lead {
  margin: 0 0 var(--p-3, 12px) 0;
  font-size: var(--p-fs-body);
  color: var(--p-ink-2);
  line-height: 1.55;
}
.rk-form__lead a {
  color: var(--p-primary);
  text-decoration: none;
}
.rk-form__lead a:hover {
  text-decoration: underline;
}
.rk-form__copy {
  display: flex;
  justify-content: flex-end;
  margin-top: -8px;
  margin-bottom: var(--p-2, 8px);
}
.rk-form__confirm {
  margin: var(--p-2, 8px) 0;
  color: var(--p-ink);
}
</style>
