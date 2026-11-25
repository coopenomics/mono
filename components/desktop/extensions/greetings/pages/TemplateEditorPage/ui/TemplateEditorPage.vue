<template lang="pug">
.greeting-editor
  .q-pa-md
    .row.q-col-gutter-lg
      //- Зоны: слева — текст шаблона (что пишем), справа — письмо пайщику (что получит).
      .col-12.col-md-7
        BaseCard
          BackLink.q-mb-md(:label='$t("greetings.editor.back")' @click='goBack')
          template(v-if='firstLoad')
            .skel.skel--text.q-mb-md
            .skel.skel--text.q-mb-md
            .skel.greeting-editor__skel-body
          template(v-else)
            .row.q-col-gutter-md
              .col-12
                .greeting-editor__eyebrow {{ $t('greetings.editor.kindLabel') }}
                BaseSegmented(v-model='form.kind' :options='kindOptions' :disabled='!canManage')
              .col-12
                BaseInput(v-model='form.title' :label='$t("greetings.editor.titleLabel")' :readonly='!canManage')
              //- У рассылки одна дата отправки, у поздравления — период действия.
              template(v-if='isMailing')
                .col-12.col-sm-6
                  BaseInput(v-model='form.period_start' type='date' :label='$t("greetings.editor.sendDateLabel")' :readonly='!canManage')
                //- Поле даты держит место под подсказку снизу; флажок выравнивается по самому полю, а не по колонке.
                .col-12.col-sm-6.greeting-editor__repeat
                  BaseCheckbox(v-model='form.repeat_yearly' :label='$t("greetings.editor.repeatYearly")' :disabled='!canManage')
              template(v-else)
                .col-12.col-sm-6
                  BaseInput(v-model='form.period_start' type='date' :label='$t("greetings.editor.periodStartLabel")' :readonly='!canManage')
                .col-12.col-sm-6
                  BaseInput(v-model='form.period_end' type='date' :label='$t("greetings.editor.periodEndLabel")' :readonly='!canManage')
              .col-12(ref='subjectBox' @focusin='lastField = "subject"')
                BaseInput(v-model='form.subject' :label='$t("greetings.editor.subjectLabel")' :readonly='!canManage')

            .greeting-editor__vars(v-if='canManage')
              .greeting-editor__eyebrow {{ $t('greetings.editor.variablesLabel') }}
              .row.q-gutter-xs
                BaseButton(
                  v-for='item in visibleVariables'
                  :key='item.variable'
                  variant='secondary'
                  size='sm'
                  @mousedown.prevent
                  @click='insertVariable(item.token)'
                )
                  | {{ item.token }}
                  q-tooltip {{ item.description }}

            .greeting-editor__eyebrow.q-mt-md {{ $t('greetings.editor.bodyLabel') }}
            .greeting-editor__body(@focusin='lastField = "body"')
              Editor(
                ref='editor'
                v-model='form.body'
                :readonly='!canManage'
                :min-height='320'
                :placeholder='$t("greetings.editor.bodyPlaceholder")'
                show-focus-ring
              )

      .col-12.col-md-5
        BaseCard.greeting-editor__preview(:title='$t("greetings.editor.previewTitle")')
          BaseSelect(
            v-model='previewUsername'
            :options='participantOptions'
            :label='$t("greetings.editor.previewParticipant")'
            :placeholder='isMailing ? $t("greetings.editor.previewNearestMailing") : $t("greetings.editor.previewNearest")'
            clearable
            searchable
          )
          template(v-if='preview')
            .q-mt-md
              DataRow(:label='$t("greetings.editor.previewWho")' :value='previewWho' align='vertical')
              DataRow(:label='$t("greetings.editor.previewSubject")' :value='preview.subject' align='vertical')
            //- Письмо строит сервер той же функцией, что и рассылка; разметка уже очищена.
            .greeting-editor__letter.q-mt-md(v-html='preview.bodyHtml')
            BaseBanner.q-mt-md(v-if='preview.unknownVariables.length' variant='warn')
              template(#icon)
                q-icon(name='warning')
              | {{ $t('greetings.editor.unknownVariables', { variables: preview.unknownVariables.join(', ') }) }}
            //- Пробное письмо — тот же текст тем же сценарием, но на почту председателя.
            BaseButton.q-mt-md(
              v-if='canManage'
              variant='secondary'
              size='sm'
              :loading='testing'
              @click='sendTest'
            )
              template(#icon-left)
                q-icon(name='outgoing_mail' size='18px')
              | {{ $t('greetings.editor.sendTest') }}
          EmptyState.q-mt-md(v-else-if='previewMissing' :title='$t("greetings.editor.previewTitle")' :body='$t("greetings.editor.previewEmpty")')
            template(#icon)
              q-icon(name='mail_outline' size='32px')
          template(v-else)
            .skel.greeting-editor__skel-body.q-mt-md

  //- Липкий подвал: отмена слева, сохранение справа — всегда на виду.
  .greeting-editor__bar(v-if='canManage')
    BaseButton(variant='ghost' @click='goBack') {{ $t('common.action.cancel') }}
    BaseButton(variant='primary' :loading='saving' :disabled='firstLoad' @click='save') {{ $t('greetings.editor.save') }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { debounce } from 'quasar';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useHeaderActions } from 'src/shared/hooks';
import { useFirstLoad } from 'src/shared/lib/composables';
import { useLiveReload } from 'src/shared/lib/realtime';
import {
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseCheckbox,
  BaseInput,
  BaseSegmented,
  BaseSelect,
  EmptyState,
  type BaseSelectOption,
} from 'src/shared/ui/base';
import { BackLink, DataRow } from 'src/shared/ui/domain';
import { Editor } from 'src/shared/ui/Editor';
import {
  GREETINGS_LIVE,
  formatDay,
  greetingsApi,
  kindLabel,
  useCanManageGreetings,
  type IGreetingCalendarEntry,
  type IGreetingPreview,
  type IGreetingTemplate,
  type IGreetingVariable,
} from '../../../entities/Greeting';
import { TemplateStatusActions } from '../../../features/TemplateStatus';
import { t } from '../../../i18n';

/**
 * Редактор шаблона: поздравление с днём рождения или рассылка в дату.
 * Председатель пишет тему и текст с переменными, справа сразу видит письмо
 * на конкретном пайщике и может отправить его себе пробным письмом.
 */
const route = useRoute();
const router = useRouter();
const canManage = useCanManageGreetings();

const template = ref<IGreetingTemplate | null>(null);
const variables = ref<IGreetingVariable[]>([]);
const upcoming = ref<IGreetingCalendarEntry[]>([]);
const loading = ref(true);
const firstLoad = useFirstLoad(loading);
const saving = ref(false);

const form = reactive({
  kind: Zeus.GreetingTemplateKind.BIRTHDAY as Zeus.GreetingTemplateKind,
  repeat_yearly: false,
  title: '',
  period_start: '',
  period_end: '',
  subject: '',
  body: '',
});
const isMailing = computed(() => form.kind === Zeus.GreetingTemplateKind.MAILING);
const kindOptions = Object.values(Zeus.GreetingTemplateKind).map((value) => ({ value, label: kindLabel(value) }));
/** У рассылки возраста нет — его переменные в панели не показываются. */
const visibleVariables = computed(() => variables.value.filter((item) => !isMailing.value || !item.birthdayOnly));
/** Сохранённое состояние формы: по нему видно, есть ли несохранённые правки. */
const savedSnapshot = ref('');
const isDirty = computed(() => JSON.stringify(form) !== savedSnapshot.value);

const editor = ref<{ insertText: (text: string) => boolean } | null>(null);
const subjectBox = ref<HTMLElement | null>(null);
const lastField = ref<'subject' | 'body'>('body');

const templateId = computed(() => String(route.params.id ?? 'new'));
const isNew = computed(() => templateId.value === 'new');

const tokenOf = (variable: Zeus.GreetingVariable) =>
  `{{${variables.value.find((item) => item.variable === variable)?.token ?? ''}}}`;

/** Черновик нового шаблона под повод: готовый текст, который председатель правит. */
function fillNew(kind: Zeus.GreetingTemplateKind) {
  const now = new Date();
  const year = now.getFullYear();
  const tokens = {
    address: tokenOf(Zeus.GreetingVariable.ADDRESS),
    cooperative: tokenOf(Zeus.GreetingVariable.COOPERATIVE),
    chairman: tokenOf(Zeus.GreetingVariable.CHAIRMAN),
  };
  if (kind === Zeus.GreetingTemplateKind.MAILING) {
    const today = `${year}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    Object.assign(form, {
      kind,
      repeat_yearly: false,
      title: t('greetings.editor.newMailingTitle', { date: formatDay(today) }),
      period_start: today,
      period_end: today,
      subject: t('greetings.editor.defaultMailingSubject', tokens),
      body: t('greetings.editor.defaultMailingBody', tokens),
    });
  } else {
    Object.assign(form, {
      kind,
      repeat_yearly: false,
      title: t('greetings.editor.newTitle', { year }),
      period_start: `${year}-01-01`,
      period_end: `${year}-12-31`,
      subject: t('greetings.editor.defaultSubject', tokens),
      body: t('greetings.editor.defaultBody', tokens),
    });
  }
  // Заготовка — точка отсчёта: смена повода у нетронутой заготовки меняет текст.
  draftSnapshot.value = JSON.stringify(form);
}

/** Заготовка нового шаблона: пока председатель её не правил, смена повода подставляет другую. */
const draftSnapshot = ref('');
watch(
  () => form.kind,
  (kind) => {
    if (isNew.value && JSON.stringify({ ...form, kind: otherKind(kind) }) === draftSnapshot.value) fillNew(kind);
  },
);
const otherKind = (kind: Zeus.GreetingTemplateKind) =>
  kind === Zeus.GreetingTemplateKind.MAILING ? Zeus.GreetingTemplateKind.BIRTHDAY : Zeus.GreetingTemplateKind.MAILING;

function fillFrom(source: IGreetingTemplate) {
  template.value = source;
  Object.assign(form, {
    kind: source.kind,
    repeat_yearly: source.repeat_yearly,
    title: source.title,
    period_start: source.period_start,
    period_end: source.period_end,
    subject: source.subject,
    body: source.body,
  });
  savedSnapshot.value = JSON.stringify(form);
}

async function load() {
  try {
    const [vars, nearest] = await Promise.all([greetingsApi.loadVariables(), greetingsApi.loadUpcoming(20)]);
    variables.value = vars;
    upcoming.value = nearest;
    if (isNew.value) fillNew(Zeus.GreetingTemplateKind.BIRTHDAY);
    else fillFrom(await greetingsApi.loadTemplate(templateId.value));
  } catch (error) {
    FailAlert(error, t('greetings.editor.loadError'));
  } finally {
    loading.value = false;
  }
}

/** Переменная встаёт в место курсора: в тему — по позиции в поле, в текст — командой редактора. */
function insertVariable(word: string) {
  const token = `{{${word}}}`;
  if (lastField.value === 'subject') {
    const input = subjectBox.value?.querySelector('input');
    const at = input?.selectionStart ?? form.subject.length;
    form.subject = form.subject.slice(0, at) + token + form.subject.slice(input?.selectionEnd ?? at);
    return;
  }
  if (!editor.value?.insertText(token)) form.body = `${form.body}${token}`;
}

async function save(): Promise<boolean> {
  saving.value = true;
  try {
    // У рассылки одна дата: конец периода равен дате отправки.
    const periodEnd = isMailing.value ? form.period_start : form.period_end;
    const saved = await greetingsApi.saveTemplate({
      id: isNew.value ? null : templateId.value,
      ...form,
      period_end: periodEnd,
    });
    fillFrom(saved);
    SuccessAlert(t('greetings.editor.saved'));
    if (isNew.value) await router.replace({ name: 'greetings-template', params: { coopname: route.params.coopname, id: saved.id } });
    return true;
  } catch (error) {
    FailAlert(error, t('greetings.editor.saveError'));
    return false;
  } finally {
    saving.value = false;
  }
}

function goBack() {
  void router.push({ name: 'greetings-templates', params: { coopname: route.params.coopname } });
}

// ─── Предпросмотр ───────────────────────────────────────────────────────────
const preview = ref<IGreetingPreview | null>(null);
const previewMissing = ref(false);
const previewUsername = ref<string | null>(null);

const ageLabel = (age: number) => t('greetings.calendar.age', age);

/** «Иванова Анна Петровна · 35 лет» — кому и к какой дате письмо. */
const previewWho = computed(() => {
  const current = preview.value;
  if (!current) return '';
  return current.age == null ? current.displayName : `${current.displayName} · ${ageLabel(current.age)}`;
});

const participantOptions = computed<BaseSelectOption[]>(() =>
  upcoming.value.map((entry) => ({
    value: entry.username,
    label: entry.displayName,
    caption: `${formatDay(entry.date)} · ${ageLabel(entry.age)}`,
  })),
);

const refreshPreview = debounce(async () => {
  try {
    preview.value = await greetingsApi.loadPreview({
      subject: form.subject,
      body: form.body,
      username: previewUsername.value || null,
      kind: form.kind,
    });
    previewMissing.value = false;
  } catch (error) {
    // В календаре нет пайщиков с датой рождения — показываем пояснение, а не ошибку.
    preview.value = null;
    previewMissing.value = true;
    console.warn(t('greetings.editor.previewError'), error);
  }
}, 500);

watch(() => [form.subject, form.body, form.kind, previewUsername.value], () => void refreshPreview());

// ─── Пробное письмо ─────────────────────────────────────────────────────────
const testing = ref(false);
async function sendTest() {
  testing.value = true;
  try {
    await greetingsApi.sendTest({
      subject: form.subject,
      body: form.body,
      username: previewUsername.value || null,
      kind: form.kind,
    });
    SuccessAlert(t('greetings.editor.testSent'));
  } catch (error) {
    FailAlert(error, t('greetings.editor.testError'));
  } finally {
    testing.value = false;
  }
}

// ─── Шапка ──────────────────────────────────────────────────────────────────
const { registerAction, unregisterAction } = useHeaderActions();
const HEADER_ACTION_ID = 'greetings-template-status';

function onStatusChanged(updated: IGreetingTemplate | null) {
  if (updated) fillFrom(updated);
  else goBack();
}

watch(
  template,
  (current) => {
    if (!current) return;
    registerAction({
      id: HEADER_ACTION_ID,
      component: TemplateStatusActions,
      order: 1,
      props: {
        template: current,
        beforeStatusChange: () => (isDirty.value ? save() : Promise.resolve(true)),
        onChanged: onStatusChanged,
      },
    });
  },
  { immediate: true },
);

onMounted(() => void load());
onBeforeUnmount(() => unregisterAction(HEADER_ACTION_ID));

// Шаблон правит другой председательский сеанс или включает рассылку — перечитываем,
// только если в форме нет своих несохранённых правок.
useLiveReload([GREETINGS_LIVE.templates], async () => {
  if (isNew.value || isDirty.value) return;
  try {
    fillFrom(await greetingsApi.loadTemplate(templateId.value));
  } catch {
    // Шаблон удалён в другом сеансе — остаёмся на форме до явного «Отмена».
  }
});
</script>

<style scoped lang="scss">
.greeting-editor {
  min-height: 100%;
  display: flex;
  flex-direction: column;
}

.greeting-editor__eyebrow {
  font-size: var(--p-fs-eyebrow);
  color: var(--p-ink-3);
  margin-bottom: var(--p-2);
}

.greeting-editor__repeat {
  display: flex;
  align-items: flex-start;
  padding-top: var(--p-4);
}

.greeting-editor__vars {
  margin-top: var(--p-4);
}

.greeting-editor__body {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.greeting-editor__preview {
  position: sticky;
  top: var(--p-4);
}

.greeting-editor__letter {
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  padding: var(--p-5);
  background: var(--p-surface);
  color: var(--p-ink);
  line-height: var(--p-lh-body);
  overflow-wrap: anywhere;

  :deep(p) {
    margin: 0 0 var(--p-3);
  }

  :deep(p:last-child) {
    margin-bottom: 0;
  }
}

.greeting-editor__skel-body {
  height: calc(var(--p-10) * 3);
}

.greeting-editor__bar {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  display: flex;
  justify-content: space-between;
  gap: var(--p-3);
  padding: var(--p-3) var(--p-4);
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}

@media (max-width: 600px) {
  .greeting-editor__preview {
    position: static;
  }
}
</style>
