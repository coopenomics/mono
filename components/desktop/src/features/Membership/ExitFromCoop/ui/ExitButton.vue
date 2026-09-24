<template lang="pug">
div
  BaseButton(
    v-if='walletStore.isWalletAgreementSigned',
    :variant='variant',
    :size='micro ? "sm" : "md"',
    :aria-label='label',
    @click='open'
  )
    template(#icon-left)
      q-icon(:name='icon', size='18px')
    span(v-if='!micro').q-ml-sm {{ label }}
    q-tooltip(v-if='micro') {{ label }}

  BaseDialog(
    v-model='showDialog',
    :title='$t("membership.exitButton.title")',
    size='lg',
    @update:model-value='(v) => !v && clear()'
  )
    //- Проверка реквизитов
    div.exit-loading(v-if='checkingRequisites')
      q-spinner(size='32px', color='primary')
      span.exit-loading__text {{ $t('membership.exitButton.checkingRequisites') }}

    //- Нет реквизитов — выход заблокирован, ведём на страницу реквизитов
    div(v-else-if='requisitesOk === false')
      BaseBanner(variant='warn')
        template(#icon)
          q-icon(name='warning')
        div
          p.q-mb-sm {{ $t('membership.exitButton.requisitesRequiredHint') }}
          p.q-mb-none {{ $t('membership.exitButton.requisitesRequiredWarning') }}
      div.q-mt-md.flex.justify-end
        BaseButton(variant='primary', @click='goToRequisites')
          template(#icon-left)
            q-icon(name='account_balance', size='18px')
          span.q-ml-sm {{ $t('membership.exitButton.setRequisites') }}

    //- Реквизиты есть — показываем заявление и форму подписи
    Form(
      v-else,
      :handler-submit='handlerSubmit',
      :is-submitting='isSubmitting',
      :disabled='!documents || loading || blockers.length > 0',
      :button-cancel-txt='$t("membership.exitButton.cancel")',
      :button-submit-txt='$t("membership.exitButton.signAndSubmit")',
      @cancel='clear'
    )
      BaseBanner(variant='warn')
        template(#icon)
          q-icon(name='warning')
        div
          p.q-mb-sm {{ $t('membership.exitButton.readCarefullyWarning') }}
          p.q-mb-none {{ $t('membership.exitButton.processDescription') }}

      //- Единый лоадер на подготовку заявлений и расчёт суммы (грузим параллельно).
      div.exit-loading(v-if='loading')
        q-spinner(size='32px', color='primary')
        span.exit-loading__text {{ $t('membership.exitButton.preparing') }}

      template(v-else)
        //- Причины отказа приходят от программ: пока они есть, подавать заявление
        //- бесполезно — бэкенд его отклонит.
        BaseBanner.q-mt-md(v-if='blockers.length', variant='neg')
          template(#icon)
            q-icon(name='block')
          div
            p.q-mb-sm Сейчас выйти нельзя:
            ul.exit-blockers
              li(v-for='reason in blockers', :key='reason') {{ reason }}

        //- Что закрывается и сколько вернётся: по строке на программу, с
        //- отметкой, какие остатки остаются кооперативу.
        div.exit-programs(v-if='programs.length')
          .exit-programs__title Участие в программах
          .exit-program(v-for='program in programs', :key='program.program_id')
            .exit-program__head
              span.exit-program__name {{ program.title }}
              span.exit-program__refund.t-num {{ formatAsset2Digits(program.refund) }}
            .exit-program__note(v-if='program.agreement_signed_at') Соглашение от {{ formatDate(program.agreement_signed_at) }}
            .exit-program__wallet(v-for='wallet in program.wallets', :key='wallet.wallet_name', :class='{ "exit-program__wallet--kept": !wallet.returns }')
              span {{ wallet.human_name }}
              span.t-num {{ formatAsset2Digits(wallet.balance) }}
              span.exit-program__policy(v-if='!wallet.returns') остаётся кооперативу

        div.exit-doc.q-mt-md(v-if='documents')
          //- Заявлений два, и подпись под ними одна: читаются друг за другом.
          .exit-doc__title(v-if='documents.annulment') Заявление о выходе
          DocumentHtmlReader(:html='documents.application.html')
          template(v-if='documents.annulment')
            .exit-doc__title.q-mt-md Заявление об аннулировании соглашений
            DocumentHtmlReader(:html='documents.annulment.html')

        //- Итог к возврату — soft-панель под документом, читается как подбивка
        //- к заявлению (а не «висящий» текст снизу). Сумма авторитетная: собирается
        //- по таблице политики кошельков (той же, что обходит контракт при возврате).
        div.exit-summary(v-if='preview')
          span.exit-summary__label {{ $t('membership.exitButton.refundAmountLabel') }}
          span.exit-summary__value {{ formatAsset2Digits(preview.total) }}
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { hasErrorCode } from 'src/shared/api/errors';
import { useRoute, useRouter } from 'vue-router';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { BaseBanner } from 'src/shared/ui/base/BaseBanner';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { Form } from 'src/shared/ui/Form';
import { formatAsset2Digits } from 'src/shared/lib/utils/formatAsset2Digits';
import { useConfirm } from 'src/shared/lib/composables';
import { useWalletStore } from 'src/entities/Wallet';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import {
  useMembershipExit,
  useExitDialog,
  useExitGate,
  type IExitDocuments,
  type IMembershipExitReturnPreview,
} from '../model';

import type { BaseButtonVariant } from 'src/shared/ui/base/BaseButton/BaseButton.types';
import { t } from 'src/shared/i18n';

interface Props {
  micro?: boolean;
  label?: string;
  variant?: BaseButtonVariant;
  icon?: string;
}

withDefaults(defineProps<Props>(), {
  micro: false,
  label: t('membership.exitButton.buttonLabel'),
  variant: 'danger',
  icon: 'logout',
});

const route = useRoute();
const router = useRouter();
const walletStore = useWalletStore();
const { showDialog, open } = useExitDialog();
const { prepareExitDocuments, submitSignedApplication, getReturnPreview, hasRequisites } = useMembershipExit();
const { confirm } = useConfirm();
const { loadExitStatus } = useExitGate();

const isSubmitting = ref(false);
const checkingRequisites = ref(false);
const requisitesOk = ref<boolean | null>(null);
const loading = ref(false);
const documents = ref<IExitDocuments | null>(null);
const preview = ref<IMembershipExitReturnPreview | null>(null);
const blockers = computed(() => preview.value?.blockers ?? []);
const programs = computed(() => preview.value?.programs ?? []);

const formatDate = (value: unknown): string =>
  value ? new Date(String(value)).toLocaleDateString('ru-RU') : '______';

watch(showDialog, async (opened) => {
  if (!opened) return;

  // Гейт реквизитов — без них выход не запускаем.
  checkingRequisites.value = true;
  try {
    requisitesOk.value = await hasRequisites();
  } catch (error) {
    // Не блокируем проактивно при сбое проверки — бэкенд всё равно отклонит подачу.
    console.error('Не удалось проверить реквизиты пайщика:', error);
    requisitesOk.value = true;
  } finally {
    checkingRequisites.value = false;
  }
  if (!requisitesOk.value) return;

  // Сначала расчёт: из него берутся программы и суммы для заявления об
  // аннулировании соглашений, поэтому документы готовятся следом.
  loading.value = true;
  try {
    try {
      preview.value = await getReturnPreview();
    } catch (error) {
      // Сумма — некритично: заявление о выходе можно подписать и без предрасчёта.
      console.error('Ошибка расчёта суммы возврата:', error);
    }
    if (preview.value?.blockers?.length) return;
    documents.value = await prepareExitDocuments(preview.value);
  } catch (error) {
    console.error('Ошибка формирования заявлений о выходе:', error);
    FailAlert('Не удалось сформировать заявления о выходе');
  } finally {
    loading.value = false;
  }
});

const clear = (): void => {
  showDialog.value = false;
  isSubmitting.value = false;
  checkingRequisites.value = false;
  requisitesOk.value = null;
  loading.value = false;
  documents.value = null;
  preview.value = null;
};

const goToRequisites = (): void => {
  showDialog.value = false;
  void router.push({ name: 'payment-methods', params: { coopname: route.params.coopname } });
};

const handlerSubmit = async (): Promise<void> => {
  if (!documents.value) return;

  const agreed = await confirm({
    title: 'Выйти из кооператива?',
    message: documents.value.annulment
      ? 'Ваше участие в программах прекратится, а средства вернутся после решения Совета. Вернуться назад нельзя.'
      : 'Членство прекратится, паевой взнос вернётся после решения Совета. Вернуться назад нельзя.',
    note: 'Заявления подписываются вашей электронной подписью прямо сейчас.',
    confirmLabel: 'Подписать и подать',
    danger: true,
  });
  if (!agreed) return;

  isSubmitting.value = true;
  try {
    await submitSignedApplication(documents.value);
    // Подтягиваем статус — overlay заблокирует кабинет и покажет экран ожидания письма.
    await loadExitStatus();
    SuccessAlert(t('membership.exitButton.signedSuccess'));
    clear();
  } catch (e: any) {
    // Авторитетный гейт реквизитов — на бэкенде. Если он отклонил подачу из-за
    // отсутствия реквизитов, переключаем диалог на экран-баннер с кнопкой.
    if (hasErrorCode(e, 'MEMBERSHIP_EXIT_PAYMENT_METHOD_REQUIRED')) {
      requisitesOk.value = false;
    } else {
      FailAlert(e);
    }
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped lang="scss">
.exit-blockers {
  margin: 0;
  padding-left: var(--p-5);
}

/* Что закрывается при выходе: по строке на программу, суммы столбиком справа. */
.exit-programs {
  margin-top: var(--p-4);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  overflow: hidden;
}
.exit-programs__title {
  padding: var(--p-3) var(--p-4);
  background: var(--p-surface-2);
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
}
.exit-program {
  padding: var(--p-3) var(--p-4);
  border-top: 1px solid var(--p-line);
}
.exit-program__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--p-3);
}
.exit-program__name {
  font-weight: 600;
  color: var(--p-ink);
}
.exit-program__refund {
  font-weight: 600;
  white-space: nowrap;
}
.exit-program__note {
  margin-top: 2px;
  font-size: var(--p-fs-meta);
  color: var(--p-ink-3);
}
.exit-program__wallet {
  display: flex;
  align-items: baseline;
  gap: var(--p-2);
  margin-top: var(--p-2);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}
.exit-program__wallet span:nth-child(2) {
  margin-left: auto;
  white-space: nowrap;
}
.exit-program__wallet--kept {
  color: var(--p-ink-3);
}
.exit-program__policy {
  flex-basis: 100%;
  font-size: var(--p-fs-meta);
}

.exit-doc__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}

.exit-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3);
  padding: var(--p-8) var(--p-4);
}
.exit-loading__text {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-2);
}

.exit-doc {
  max-height: 50vh;
  overflow-y: auto;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  padding: var(--p-4);
}
/* Документ приходит из backend с Quasar text-h-классами и inline-стилями
   (заголовок 3rem, line-height 4.5rem). Прижимаем заголовок и типографику к
   канону — иначе title распирает диалог. Приём как в ReadStatement.vue
   (deep + important, чтобы перебить глобальные правила DocumentHtmlReader). */
.exit-doc :deep(.statement h1),
.exit-doc :deep(.statement .text-h1),
.exit-doc :deep(.statement .text-h2) {
  font-size: var(--p-fs-h2) !important;
  line-height: var(--p-lh-h2) !important;
  letter-spacing: var(--p-ls-h2) !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  text-align: center !important;
  margin: var(--p-2) 0 var(--p-4) !important;
}
.exit-doc :deep(.statement h2),
.exit-doc :deep(.statement h3),
.exit-doc :deep(.statement h4),
.exit-doc :deep(.statement .text-h3),
.exit-doc :deep(.statement .text-h4),
.exit-doc :deep(.statement .text-h5),
.exit-doc :deep(.statement .text-h6) {
  font-size: var(--p-fs-body) !important;
  line-height: var(--p-lh-body) !important;
  letter-spacing: 0 !important;
  font-weight: 600 !important;
  color: var(--p-ink) !important;
  margin: var(--p-4) 0 var(--p-1) !important;
}
.exit-doc :deep(.statement p) {
  font-size: var(--p-fs-body) !important;
  line-height: var(--p-lh-body) !important;
}

.exit-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-4);
  margin-top: var(--p-4);
  padding: var(--p-4) var(--p-5);
  background: var(--p-surface-2);
  border-radius: var(--p-r-md);
}
.exit-summary__label {
  font-size: var(--p-fs-body);
  font-weight: 600;
  color: var(--p-ink);
  min-width: 0;
}
.exit-summary__value {
  font-family: var(--p-mono);
  font-size: var(--p-fs-h2);
  font-weight: 600;
  color: var(--p-ink);
  font-feature-settings: 'tnum' 1;
  white-space: nowrap;
}
</style>
