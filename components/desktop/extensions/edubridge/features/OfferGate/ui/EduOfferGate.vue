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

    BaseBanner(v-else-if="!activeStep" variant="pos")
      template(#icon)
        q-icon(name="check_circle")
      | Подключение завершено. Стол открыт — переходим.

    template(v-else)
      VerticalStepper(v-if="steps.length > 1" :steps="steps" :active-key="activeStep.key" :completed="completedKeys")
        template(#active="{ step }")
          EduGateDocumentStep(:key="step.key" v-bind="stepProps(step.key)" @signed="onSigned(step.key)")
      EduGateDocumentStep(v-else :key="activeStep.key" v-bind="stepProps(activeStep.key)" @signed="onSigned(activeStep.key)")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Zeus } from '@coopenomics/sdk';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { BaseBanner, BaseCard, CardListSkeleton } from 'src/shared/ui/base';
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

const state = ref<IEduOnboardingState | null>(null);
const contract = ref<IContract | null>(null);
const offerDoc = ref<DigitalDocument | null>(null);
const contractDraft = ref<IContractDraft | null>(null);

const isTeacher = computed(() => props.kind === Zeus.EduOfferKind.TEACHER);
const offer = computed(() => (isTeacher.value ? state.value?.teacher : state.value?.parent) ?? null);
const offerSigned = computed(() => offer.value?.source === 'AGREEMENT_SIGNED');
// Договор считается подписанным преподавателем, пока председатель не отказал.
const contractSigned = computed(() => Boolean(contract.value) && contract.value?.status !== Zeus.EduContractStatus.DECLINED);

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
    return {
      stepKey: key,
      description: props.contractDescription,
      notice: declined ? `Председатель отказал в подписи договора${contract.value?.decline_reason ? `: ${contract.value.decline_reason}` : ''}. Прочитайте и подпишите договор заново.` : undefined,
      agreeLabel: 'Я прочитал(а) договор участия в хозяйственной деятельности и согласен(на) с его условиями.',
      actionLabel: 'Подписать договор',
      build: async () => {
        contractDraft.value = await buildContractDocument();
        return contractDraft.value.document.data?.html ?? '';
      },
      sign: async () => {
        contract.value = await signContract(contractDraft.value ?? undefined);
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

async function onSigned(key: string): Promise<void> {
  SuccessAlert(key === 'contract' ? 'Договор подписан — ждёт подписи председателя совета' : 'Оферта подписана');
  if (!activeStep.value) await goToDesk();
}

async function goToDesk(): Promise<void> {
  await desktopStore.loadDesktop();
  void router.replace({ name: props.targetRoute, params: { coopname: route.params.coopname } });
}

onMounted(load);
</script>
