<template>
  <AuthSplit
    :eyebrow="coopTitle"
    :title="$t('registrator.resetKeyForm.title')"
    :lead="$t('registrator.resetKeyForm.lead')"
    :quote="$t('registrator.resetKeyForm.quote')"
    :step-eyebrow="$t('registrator.resetKeyForm.title')"
    :heading="title"
    :text="subtitle"
    :size="mode === 'save-key' ? 'md' : 'sm'"
  >
    <template v-if="$slots.actions" #actions>
      <slot name="actions" />
    </template>
    <template v-if="$slots['pane-foot']" #pane-foot>
      <slot name="pane-foot" />
    </template>
    <!-- Шаг ожидания письма -->
    <template v-if="mode === 'check-mail'">
      <BaseBanner variant="info"> {{ $t('registrator.resetKeyForm.checkMailBanner') }} </BaseBanner>
    </template>

    <!-- Шаг сохранения ключа -->
    <template v-else-if="account">
      <p class="rk-form__lead"> {{ $t('registrator.resetKeyForm.saveKeyLeadPart1') }} <a href="https://bitwarden.com/download" target="_blank" rel="noopener">Bitwarden</a>{{ $t('registrator.resetKeyForm.saveKeyLeadPart2') }} </p>

      <BaseInput
        :model-value="account.private_key"
        :label="$t('registrator.resetKeyForm.privateKeyLabel')"
        readonly
        mono
      />

      <div class="rk-form__copy">
        <BaseButton
          variant="ghost"
          size="sm"
          :aria-label="copied ? $t('registrator.resetKeyForm.copiedLabel') : $t('registrator.resetKeyForm.copyKeyAriaLabel')"
          @click="copy"
        >
          <template #icon-left>
            <q-icon :name="copied ? 'check' : 'content_copy'" />
          </template>
          {{ copied ? $t('registrator.resetKeyForm.copiedLabel') : $t('registrator.resetKeyForm.copyKeyLabel') }}
        </BaseButton>
      </div>

      <BaseCheckbox v-model="iSave" class="rk-form__confirm" :label="$t('registrator.resetKeyForm.saveKeyConfirmLabel')" />

      <BaseButton
        variant="primary"
        :loading="loading"
        :disabled="!iSave"
        block
        @click="submit"
      > {{ $t('registrator.resetKeyForm.submit') }} </BaseButton>
    </template>

    <template v-else>
      <BaseBanner variant="neg"> {{ $t('registrator.resetKeyForm.genErrorBanner') }} </BaseBanner>
    </template>
    <template v-if="$slots.footer" #foot>
      <slot name="footer" />
    </template>
  </AuthSplit>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import { AuthSplit } from 'src/shared/ui/layout/AuthSplit';
import { BaseCheckbox } from 'src/shared/ui/base/BaseCheckbox';
import { useSystemStore } from 'src/entities/System/model';
import type { ResetKeyFormProps } from './ResetKeyForm.types';
import { t } from 'src/shared/i18n';

const props = withDefaults(defineProps<ResetKeyFormProps>(), {
  loading: false,
  account: null,
});

const emit = defineEmits<{
  copy: [];
  submit: [];
}>();

const systemStore = useSystemStore();
const coopTitle = computed(() => systemStore.cooperativeDisplayName);

const copied = ref(false);
const iSave = ref(false);

const title = computed(() =>
  props.mode === 'save-key' ? t('registrator.resetKeyForm.saveKeyTitle') : t('registrator.resetKeyForm.checkMailTitle'),
);
const subtitle = computed(() =>
  props.mode === 'save-key'
    ? t('registrator.resetKeyForm.saveKeySubtitle')
    : t('registrator.resetKeyForm.checkMailSubtitle'),
);

async function copy(): Promise<void> {
  if (!props.account) return;
  try {
    await copyToClipboard(props.account.private_key);
    copied.value = true;
    Notify.create({
      message: t('registrator.resetKeyForm.copiedNotify'),
      type: 'positive',
      position: 'top',
      timeout: 1500,
    });
    emit('copy');
  } catch {
    Notify.create({
      message: t('registrator.resetKeyForm.copyFailNotify'),
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
}
.rk-form__confirm {
  color: var(--p-ink);
}
</style>
