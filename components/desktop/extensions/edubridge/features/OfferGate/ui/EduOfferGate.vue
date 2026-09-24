<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(:storage-key="`edu:gate-${kind.toLowerCase()}:banner-dismissed`")
    | {{ hint }}

  CardListSkeleton(v-if="!state" :count="1")
  BaseCard(v-else variant="default")
    BaseBanner(v-if="offer?.source === 'NOT_CONFIGURED'" variant="warn")
      template(#icon)
        q-icon(name="info")
      | {{ $t('edubridge.eduOfferGate.notConfiguredNotice') }}
      | {{ $t('edubridge.eduOfferGate.contactChairmanHint') }}

    CardListSkeleton(v-else-if="!activeStep" :count="1")

    template(v-else)
      VerticalStepper(v-if="steps.length > 1" :steps="steps" :active-key="activeStep.key" :completed="completedKeys")
        template(#active="{ step }")
          EduGateDocumentStep(:key="step.key" v-bind="stepProps(step.key)")
            template(v-if="step.key === 'contract'" #before-agree)
              BaseInput(
                v-model="hourlyRate"
                :label="$t('edubridge.eduOfferGate.hourlyRateLabel')"
                type="number"
                :suffix="symbol"
                required
              )
                template(#append)
                  FieldHelp(:text="$t('edubridge.eduOfferGate.hourlyRateHint')")
      EduGateDocumentStep(v-else :key="activeStep.key" v-bind="stepProps(activeStep.key)")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { useSystemStore } from 'src/entities/System/model';
import { formatToAsset } from 'src/shared/lib/utils';
import { BaseBanner, BaseCard, BaseInput, CardListSkeleton, FieldHelp } from 'src/shared/ui/base';
import { PageHint, VerticalStepper, type StepperStep } from 'src/shared/ui/domain';
import type { DigitalDocument } from 'src/shared/lib/document';
import { buildContractDocument, fetchMyContract, signContract, type IContract, type IContractDraft } from '../../../entities/Teacher';
import { buildOfferDocument, fetchOnboardingState, signOffer, type EduOfferKind, type IEduOnboardingState } from '../api';
import EduGateDocumentStep from './EduGateDocumentStep.vue';
import { t } from '../../../i18n';

/**
 * Шлюз стола. Пока подключение не завершено, бэкенд выдаёт маркер
 * `Onboarding:*`, открывающий только эту страницу. Родитель-слушатель подписывает
 * оферту; преподаватель — оферту и следом договор участия в хозяйственной
 * деятельности (первая подпись его, вторая — председателя со стола «Запросы
 * одобрений»). Каждый документ читается целиком здесь же, подписывается
 * прочитанный экземпляр. После последней подписи перечитываем столы и уходим
 * на рабочую страницу.
 */
const props = defineProps<{
  kind: EduOfferKind;
  hint: string;
  offerDescription: string;
  offerTitle: string;
  contractDescription?: string;
  /** Куда уйти после подписи. */
  targetRoute: string;
}>();

const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();

const state = ref<IEduOnboardingState | null>(null);
const contract = ref<IContract | null>(null);
const offerDoc = ref<DigitalDocument | null>(null);
const contractDraft = ref<IContractDraft | null>(null);
// Ставка часа называется один раз — при подписании договора; потом её правит
// администратор в разделе «Экономика».
const hourlyRate = ref('');
const system = useSystemStore();
const symbol = computed(() => system.governSymbol);

const isTeacher = computed(() => props.kind === Zeus.EduOfferKind.TEACHER);
const offer = computed(() => (isTeacher.value ? state.value?.teacher : state.value?.parent) ?? null);
const offerSigned = computed(() => offer.value?.source === 'AGREEMENT_SIGNED');
// Договор считается подписанным преподавателем, пока председатель не отказал и договор не прекращён.
const RESIGNABLE: string[] = [Zeus.EduContractStatus.DECLINED, Zeus.EduContractStatus.TERMINATED];
const contractSigned = computed(() => Boolean(contract.value) && !RESIGNABLE.includes(contract.value?.status ?? ''));

const steps = computed<StepperStep[]>(() =>
  isTeacher.value
    ? [
        { key: 'offer', label: t('edubridge.eduOfferGate.step.teacherOffer.label'), description: t('edubridge.eduOfferGate.step.teacherOffer.description') },
        { key: 'contract', label: t('edubridge.eduOfferGate.step.contract.label'), description: t('edubridge.eduOfferGate.step.contract.description') },
      ]
    : [{ key: 'offer', label: t('edubridge.eduOfferGate.step.parentOffer.label') }],
);
const completedKeys = computed(() => {
  const done: string[] = [];
  if (offerSigned.value) done.push('offer');
  if (contractSigned.value) done.push('contract');
  return done;
});
const activeStep = computed(() => steps.value.find((s) => !completedKeys.value.includes(s.key)) ?? null);

function stepProps(key: string) {
  if (key === 'contract') {
    const declined = contract.value?.status === Zeus.EduContractStatus.DECLINED;
    const terminated = contract.value?.status === Zeus.EduContractStatus.TERMINATED;
    return {
      stepKey: key,
      description: props.contractDescription,
      notice: declined
        ? (contract.value?.decline_reason
          ? t('edubridge.eduOfferGate.contractDeclinedNoticeWithReason', { reason: contract.value.decline_reason })
          : t('edubridge.eduOfferGate.contractDeclinedNotice'))
        : terminated
          ? t('edubridge.eduOfferGate.contractTerminatedNotice')
          : undefined,
      agreeLabel: t('edubridge.eduOfferGate.contractAgreeLabel'),
      actionLabel: t('edubridge.eduOfferGate.signContract'),
      build: async () => {
        contractDraft.value = await buildContractDocument();
        return contractDraft.value.document.data?.html ?? '';
      },
      signDisabled: Number(hourlyRate.value) <= 0,
      sign: async () => {
        const rate = formatToAsset(String(hourlyRate.value).replace(',', '.'), symbol.value);
        contract.value = await signContract(rate, contractDraft.value ?? undefined);
        await onSigned(key);
      },
    };
  }
  return {
    stepKey: key,
    description: props.offerDescription,
    agreeLabel: t('edubridge.eduOfferGate.offerAgreeLabel', { offerTitle: props.offerTitle }),
    actionLabel: isTeacher.value ? t('edubridge.eduOfferGate.signAndContinue') : t('edubridge.eduOfferGate.signOffer'),
    build: async () => {
      offerDoc.value = await buildOfferDocument(props.kind);
      return offerDoc.value.data?.html ?? '';
    },
    sign: async () => {
      // Сервер отвечает после разбора блока подписи: состояние в ответе уже
      // с подписанной офертой — ждать и переспрашивать не нужно.
      state.value = await signOffer(props.kind, offerDoc.value ?? undefined);
      if (isTeacher.value && offerSigned.value && !contract.value) contract.value = await fetchMyContract();
      await onSigned(key);
    },
  };
}

async function load(): Promise<void> {
  try {
    state.value = await fetchOnboardingState();
    // Договор читается по подписанной оферте — раньше бэкенд его не отдаст.
    if (isTeacher.value && offerSigned.value) contract.value = await fetchMyContract();
    if (!activeStep.value && offer.value?.source !== 'NOT_CONFIGURED') await goToDesk();
  } catch (e) {
    FailAlert(e);
  }
}

/**
 * Завершение подписи зовётся из функции подписи, а не событием шага: как только
 * последний документ подписан, шаг снимается со страницы, и его событие «signed»
 * уже никто не слышит — страница оставалась на скелетоне, не уходя на стол.
 */
async function onSigned(key: string): Promise<void> {
  SuccessAlert(key === 'contract' ? t('edubridge.eduOfferGate.contractSignedSuccess') : t('edubridge.eduOfferGate.offerSignedSuccess'));
  if (!activeStep.value) await goToDesk();
}

/**
 * Уходим на рабочую страницу, перечитав стол: пункт «Подключение» рисуется по
 * праву на шлюз, а право снимается подписью, которая уже в базе узла (ответ
 * подписи пришёл после разбора её блока), — одного перечитывания достаточно.
 */
async function goToDesk(): Promise<void> {
  await desktopStore.loadDesktop();
  void router.replace({ name: props.targetRoute, params: { coopname: route.params.coopname } });
}

onMounted(load);
</script>
