<template lang="pug">
.q-pa-md
  PageHint(:storage-key="`edu:gate-${kind}:banner-dismissed`")
    | {{ hint }}

  BaseCard(v-if="offer" variant="default")
    template(v-if="offer.source === 'NOT_CONFIGURED'")
      BaseBanner(variant="warn")
        template(#icon)
          q-icon(name="info")
        | Кооператив ещё не завершил подключение ЦПП «Образование» — подписать оферту пока нельзя.
        | Обратитесь к председателю.

    template(v-else-if="offer.source === 'AGREEMENT_SIGNED'")
      BaseBanner(variant="pos")
        template(#icon)
          q-icon(name="check_circle")
        | Оферта подписана. Стол открыт — переходим.

    template(v-else)
      .text-body2.q-mb-md {{ description }}
      BaseCheckbox(:model-value="agreed" block :disabled="busy" @update:model-value="(v) => (agreed = v)")
        | Я ознакомлен(а) с&nbsp;
        span.edu-gate__link(@click.stop="openOffer") {{ offerTitle }}
        |  и согласен(на) с условиями участия.
      .row.justify-end.q-mt-md
        BaseButton(variant="primary" :disabled="!agreed" :loading="busy" @click="sign") Подписать и продолжить

  BaseDialog(v-model="dialogOpen" title="Оферта" size="xl" maximized)
    CardListSkeleton(v-if="!offerHtml" :count="1")
    //- eslint-disable-next-line vue/no-v-html
    div.statement(v-else v-html="offerHtml")
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDesktopStore } from 'src/entities/Desktop/model';
import { BaseBanner, BaseButton, BaseCard, BaseCheckbox, BaseDialog, CardListSkeleton } from 'src/shared/ui/base';
import { PageHint } from 'src/shared/ui/domain';
import type { DigitalDocument } from 'src/shared/lib/document';
import { buildOfferDocument, fetchOnboardingState, signOffer, type EduOfferKind, type IEduOnboardingState } from '../api';

/**
 * Шлюз стола: пока оферта не подписана, бэкенд выдаёт маркер `Onboarding:*`,
 * открывающий только эту страницу. После подписи перечитываем столы и уходим
 * на рабочую страницу.
 */
const props = defineProps<{
  kind: EduOfferKind;
  hint: string;
  description: string;
  offerTitle: string;
  /** Куда уйти после подписи. */
  targetRoute: string;
}>();

const route = useRoute();
const router = useRouter();
const desktopStore = useDesktopStore();

const state = ref<IEduOnboardingState | null>(null);
const agreed = ref(false);
const busy = ref(false);
const dialogOpen = ref(false);
const offerHtml = ref('');
const offerDoc = ref<DigitalDocument | null>(null);

const offer = computed(() => (props.kind === 'parent' ? state.value?.parent : state.value?.teacher) ?? null);

async function load(): Promise<void> {
  try {
    state.value = await fetchOnboardingState();
    if (offer.value?.source === 'AGREEMENT_SIGNED') await goToDesk();
  } catch (e) {
    FailAlert(e);
  }
}

async function openOffer(): Promise<void> {
  dialogOpen.value = true;
  if (offerDoc.value) return;
  try {
    const doc = await buildOfferDocument(props.kind);
    offerDoc.value = doc;
    offerHtml.value = doc.data?.html ?? '';
  } catch (e) {
    FailAlert(e);
  }
}

async function sign(): Promise<void> {
  busy.value = true;
  try {
    state.value = await signOffer(props.kind, offerDoc.value ?? undefined);
    SuccessAlert('Оферта подписана');
    await goToDesk();
  } catch (e) {
    FailAlert(e);
  } finally {
    busy.value = false;
  }
}

async function goToDesk(): Promise<void> {
  await desktopStore.loadDesktop();
  void router.replace({ name: props.targetRoute, params: { coopname: route.params.coopname } });
}

onMounted(load);
</script>

<style scoped>
.edu-gate__link {
  color: var(--p-primary);
  text-decoration: underline;
  cursor: pointer;
}
</style>
