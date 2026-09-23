<template lang="pug">
.q-pa-md
  PageHint.q-mb-md(:storage-key="`edu:gate-${kind.toLowerCase()}:banner-dismissed`")
    | {{ hint }}

  CardListSkeleton(v-if="!state" :count="1")
  BaseCard(v-else variant="default")
    BaseBanner(v-if="offer?.source === 'NOT_CONFIGURED'" variant="warn")
      template(#icon)
        q-icon(name="info")
      | Кооператив ещё не завершил подключение ЦПП «Образование» — подписать оферту пока нельзя.
      | Обратитесь к председателю.

    CardListSkeleton(v-else-if="!activeStep" :count="1")

    template(v-else)
      VerticalStepper(v-if="steps.length > 1" :steps="steps" :active-key="activeStep.key" :completed="completedKeys")
        template(#active="{ step }")
          EduGateDocumentStep(:key="step.key" v-bind="stepProps(step.key)")
            template(v-if="step.key === 'contract'" #before-agree)
              BaseInput(
                v-model="hourlyRate"
                label="Ваша ставка за час"
                type="number"
                :suffix="symbol"
                required
              )
                template(#append)
                  FieldHelp(text="Стоимость часа вашей работы преподавателем. Из ставки и часов занятий складывается взнос за курс. Дальше ставку меняет администратор кооператива в разделе «Экономика».")
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

/** Ожидание подписи: до 20 секунд с полусекундным шагом — столько идёт блок цепи и его разбор. */
const OFFER_WAIT_ATTEMPTS = 40;
const OFFER_WAIT_INTERVAL_MS = 500;
/** Столько же ждём, пока стол перестанет выдавать право на шлюз подключения. */
const DESK_WAIT_ATTEMPTS = 20;

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
        { key: 'offer', label: 'Оферта преподавателя', description: 'Условия участия в ЦПП «Образование»' },
        { key: 'contract', label: 'Договор участия в хозяйственной деятельности', description: 'Подписывают вы и председатель совета' },
      ]
    : [{ key: 'offer', label: 'Оферта родителя-слушателя' }],
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
        ? `Председатель отказал в подписи договора${contract.value?.decline_reason ? `: ${contract.value.decline_reason}` : ''}. Прочитайте и подпишите договор заново.`
        : terminated
          ? 'Прежний договор прекращён. Чтобы снова вести занятия, прочитайте и подпишите договор заново.'
          : undefined,
      agreeLabel: 'Я прочитал(а) договор участия в хозяйственной деятельности и согласен(на) с его условиями.',
      actionLabel: 'Подписать договор',
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
    agreeLabel: `Я ознакомлен(а) с ${props.offerTitle} и согласен(на) с условиями участия.`,
    actionLabel: isTeacher.value ? 'Подписать и продолжить' : 'Подписать оферту',
    build: async () => {
      offerDoc.value = await buildOfferDocument(props.kind);
      return offerDoc.value.data?.html ?? '';
    },
    sign: async () => {
      state.value = await signOffer(props.kind, offerDoc.value ?? undefined);
      // Подпись уходит в цепь, а признак в состоянии появляется из зеркала —
      // это занимает секунду-другую. Без ожидания шаг оставался открытым, а
      // следующий отвечал «сначала подпишите оферту».
      await waitForOffer();
      await onSigned(key);
    },
  };
}

/** Ждём, пока подпись оферты доедет из цепи в состояние подключения. */
async function waitForOffer(): Promise<void> {
  for (let attempt = 0; attempt < OFFER_WAIT_ATTEMPTS && !offerSigned.value; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, OFFER_WAIT_INTERVAL_MS));
    state.value = await fetchOnboardingState();
  }
  if (isTeacher.value && offerSigned.value && !contract.value) contract.value = await fetchMyContract();
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
  SuccessAlert(key === 'contract' ? 'Договор подписан — ждёт подписи председателя совета' : 'Оферта подписана');
  if (!activeStep.value) await goToDesk();
}

/**
 * Уходим на рабочую страницу, когда стол перестал выдавать право на шлюз:
 * пункт «Подключение» рисуется по этому праву, и без ожидания он оставался
 * в меню до следующего захода на страницу.
 */
async function goToDesk(): Promise<void> {
  const workspace = isTeacher.value ? 'edubridge-teacher' : 'edubridge-member';
  const gateGrant = isTeacher.value ? 'Onboarding:teacher' : 'Onboarding:learner';
  for (let attempt = 0; attempt < DESK_WAIT_ATTEMPTS; attempt++) {
    await desktopStore.loadDesktop();
    if (!desktopStore.hasGrant(workspace, gateGrant)) break;
    await new Promise((resolve) => setTimeout(resolve, OFFER_WAIT_INTERVAL_MS));
  }
  void router.replace({ name: props.targetRoute, params: { coopname: route.params.coopname } });
}

onMounted(load);
</script>
