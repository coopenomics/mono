<template lang="pug">
BaseForm(:loading="loading" @submit="submit")
  //- Кто учится — первым: себе пайщик ничего не вводит, имя и почта берутся из его профиля.
  .edu-learner-form__who.q-mb-md(v-if="canChooseSelf")
    BaseRadioCard(v-model="who" value="self" :title="$t('edubridge.learnerForm.whoSelf')")
    BaseRadioCard(v-model="who" value="other" :title="$t('edubridge.learnerForm.whoOther')")
  template(v-if="showFields")
    BaseInput(v-if="!form.is_self" v-model="form.display_name" :label="$t('edubridge.learnerForm.displayNameLabel')" v-bind="PLAIN_FIELD" required)
    BaseSelect(v-model="form.recipient_type" :label="$t('edubridge.learnerForm.recipientTypeLabel')" :options="recipientOptions" required)
    BaseInput(v-model="form.recipient_value" :label="recipientLabel" v-bind="PLAIN_FIELD" required)
  template(#footer)
    .row.justify-end.q-gutter-sm
      BaseButton(variant="ghost" type="button" :disabled="loading" @click="emit('cancel')") {{ $t('edubridge.learnerForm.cancel') }}
      BaseButton(variant="primary" type="submit" :loading="loading") {{ learner ? $t('common.action.save') : $t('common.action.add') }}
</template>

<script setup lang="ts">
// realtime: форма ученика — живое перечитывание затёрло бы ввод.
import { computed, reactive, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { BaseButton, BaseForm, BaseInput, BaseRadioCard, BaseSelect } from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { addLearner, RECIPIENT_LABELS, updateLearner, type ILearner, type ILearnerInput } from '../../entities/Learner';
import { t } from '../../i18n';

/** `hasSelf` — пайщик уже записан обучающимся: себя второй раз не добавить, выбора нет. */
const props = withDefaults(defineProps<{ learner?: ILearner | null; defaultSelf?: boolean; hasSelf?: boolean }>(), { defaultSelf: false, hasSelf: false });
const emit = defineEmits<{ saved: [learner: ILearner]; cancel: [] }>();

const session = useSessionStore();
const loading = ref(false);
const canChooseSelf = computed(() => !props.learner && !props.hasSelf);
const form = reactive<ILearnerInput>({
  display_name: '',
  recipient_type: Zeus.EduRecipientType.EMAIL,
  recipient_value: '',
  is_self: canChooseSelf.value && props.defaultSelf,
});
const who = computed<'self' | 'other'>({
  get: () => (form.is_self ? 'self' : 'other'),
  set: (v) => (form.is_self = v === 'self'),
});
/** Почта пайщика из его учётной записи: на неё придёт доступ, когда он учится сам. */
const ownEmail = computed(() => session.providerAccount?.email ?? '');
/** Себе при добавлении поля не нужны (если почта известна); при правке контакт можно сменить. */
const showFields = computed(() => Boolean(props.learner) || !form.is_self || !ownEmail.value);

/** Обычный текст: менеджеры паролей в эти поля ничего не предлагают. */
const PLAIN_FIELD = { autocomplete: 'off', 'data-bwignore': 'true', 'data-1p-ignore': 'true', 'data-lpignore': 'true' };

/** Что уходит на сервер: добавляя себя, пайщик ничего не вводил — подставляем его имя и почту. */
function payload(): ILearnerInput {
  if (!form.is_self) return { ...form };
  const own = { ...form, display_name: session.displayName };
  return ownEmail.value ? { ...own, recipient_type: Zeus.EduRecipientType.EMAIL, recipient_value: ownEmail.value } : own;
}

watch(
  () => props.learner,
  (l) => {
    if (!l) return;
    Object.assign(form, { display_name: l.display_name, recipient_type: l.recipient_type, recipient_value: l.recipient_value ?? '', is_self: l.is_self });
  },
  { immediate: true },
);

const recipientOptions = Object.entries(RECIPIENT_LABELS).map(([value, label]) => ({ value, label }));
const RECIPIENT_FIELD_LABELS: Record<string, string> = {
  [Zeus.EduRecipientType.EMAIL]: t('edubridge.learnerForm.recipientLabel.EMAIL'),
  [Zeus.EduRecipientType.TELEGRAM]: t('edubridge.learnerForm.recipientLabel.TELEGRAM'),
  [Zeus.EduRecipientType.ONSITE]: t('edubridge.learnerForm.recipientLabel.ONSITE'),
};
const recipientLabel = computed(() => RECIPIENT_FIELD_LABELS[form.recipient_type] ?? t('edubridge.learnerForm.recipientLabelDefault'));
async function submit(): Promise<void> {
  loading.value = true;
  try {
    const saved = props.learner ? await updateLearner({ ...form, id: props.learner.id }) : await addLearner(payload());
    SuccessAlert(props.learner ? t('edubridge.learnerForm.savedSuccess') : t('edubridge.learnerForm.createdSuccess'));
    emit('saved', saved);
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.edu-learner-form__who {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--p-3);
}
</style>
