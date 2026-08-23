<template lang="pug">
.capital-registration
  //- ВРЕМЕННЫЙ КОСТЫЛЬ: ранние участники без Contributor
  template(v-if='shouldShowTemporaryStub')
    .banner.banner--warn
      q-icon.banner__icon(name='info', size='20px')
      .banner__body
        strong Ранним участникам.
        |
        | Перед продолжением нужно начислить дополнительный паевой взнос за раннее участие.
        | Уточните порядок и сумму в поддержке:
        |
        strong support@coopenomics.world
        |  или через чат на сайте.

  template(v-else)
    .banner.banner--info
      q-icon.banner__icon(name='description', size='20px')
      .banner__body
        | Ознакомьтесь с документами ниже и подпишите их.

    .reg-loading(v-if='isGeneratingCapitalDocs')
      q-spinner(color='primary', size='28px')
      span.reg-loading__text Готовим документы…

    .reg-error(v-else-if='capitalDocsGenerationError')
      .banner.banner--neg
        q-icon.banner__icon(name='error', size='20px')
        .banner__body Не удалось сформировать документы. Попробуйте ещё раз.
      BaseButton(
        variant='primary',
        :loading='isGeneratingCapitalDocs',
        @click='regenerateCapitalDocuments'
      )
        template(#icon-left)
          q-icon(name='refresh', size='18px')
        | Повторить

    EmptyState(
      v-else-if='!hasGeneratedDocuments',
      title='Документы пока не готовы',
      body='Если загрузка затянулась — обновите страницу или повторите генерацию.'
    )
      template(#icon)
        q-icon(name='description', size='32px')

    template(v-else)
      .reg-docs
        BaseCard.reg-doc(
          v-for='doc in documents',
          :key='doc.key',
          :title='doc.title'
        )
          .reg-doc__preview
            DocumentHtmlReader(:html='doc.html')

      .reg-foot
        BaseButton(
          variant='primary',
          size='lg',
          :loading='isCompleting',
          :disabled='isCompleting',
          @click='signAndCompleteRegistration'
        )
          template(#icon-left)
            q-icon(name='draw', size='18px')
          | Подписать и отправить
</template>

<script lang="ts" setup>
import { computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useGenerateCapitalRegistrationDocuments } from 'app/extensions/capital/features/Contributor/GenerateCapitalRegistrationDocuments/model';
import { useCompleteCapitalRegistration } from 'app/extensions/capital/features/Contributor/CompleteCapitalRegistration/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useDataPoller } from 'src/shared/lib/composables';
import { POLL_INTERVALS } from 'src/shared/lib/consts';
import { useSessionStore } from 'src/entities/Session';

interface RegistrationDoc {
  key: string;
  title: string;
  html: string;
}

const router = useRouter();
const contributorStore = useContributorStore();
const session = useSessionStore();

// ВРЕМЕННЫЙ КОСТЫЛЬ: проверка для пользователей из белого списка без Contributor
const temporaryStubUsernames = [
  'zlvsujtoctal',
  'ipesgnlxmnwx',
  'ndrlqjeptxhh',
  'hntppjjknmsu',
  'vvqamckynxod',
  'zxfevlujlica',
  'spnpcpshemqp',
  'yxkjufikzxri',
  'nqjoctcfusxs',
  'honruwpdxtty',
  'jifhmzxomaug',
  'mrgpikzesygk',
];
const shouldShowTemporaryStub = computed(() => {
  return temporaryStubUsernames.includes(session.username) && !contributorStore.self?.username;
});

const {
  generateDocuments: generateCapitalDocuments,
  regenerateDocuments: regenerateCapitalDocuments,
  isGenerating: isGeneratingCapitalDocs,
  generatedDocuments: generatedCapitalDocuments,
  generationError: capitalDocsGenerationError,
} = useGenerateCapitalRegistrationDocuments();

const { completeRegistration, isCompleting } = useCompleteCapitalRegistration();

const documents = computed<RegistrationDoc[]>(() => {
  const pack = generatedCapitalDocuments.value;
  if (!pack) return [];

  const list: RegistrationDoc[] = [];
  let n = 1;

  if (pack.generation_contract?.html && !contributorStore.self?.is_external_contract) {
    list.push({
      key: 'generation_contract',
      // Название — как в самом документе (1001.GenerationContract, подзаголовок
      // «об участии в хозяйственной деятельности»): договор УХД — это участие в
      // хозяйственной деятельности, управления в нём нет.
      title: `${n++}. Договор об участии в хозяйственной деятельности`,
      html: pack.generation_contract.html,
    });
  }
  if (pack.storage_agreement?.html) {
    list.push({
      key: 'storage_agreement',
      title: `${n++}. Соглашение о хранении имущества`,
      html: pack.storage_agreement.html,
    });
  }
  if (pack.blagorost_agreement?.html) {
    list.push({
      key: 'blagorost_agreement',
      title: `${n++}. Соглашение о программе Благорост`,
      html: pack.blagorost_agreement.html,
    });
  }
  if (pack.generator_offer?.html) {
    list.push({
      key: 'generator_offer',
      title: `${n++}. Оферта о программе Генератор`,
      html: pack.generator_offer.html,
    });
  }
  return list;
});

const hasGeneratedDocuments = computed(() => documents.value.length > 0);

const goToProfile = () => {
  router.replace({ name: 'capital-wallet' });
};

const redirectIfRegistered = () => {
  if (contributorStore.isContributorActiveOrPending) {
    goToProfile();
  }
};

watch(() => contributorStore.isContributorActiveOrPending, redirectIfRegistered);

const reloadRegistrationData = async () => {
  try {
    await contributorStore.loadContributor({ username: session.username });
  } catch (error) {
    console.warn('Ошибка при перезагрузке данных регистрации в poll:', error);
  }
};

const { start: startRegistrationPoll, stop: stopRegistrationPoll } = useDataPoller(
  reloadRegistrationData,
  { interval: POLL_INTERVALS.SLOW, immediate: false },
);

onMounted(() => {
  redirectIfRegistered();
  startRegistrationPoll();

  if (!shouldShowTemporaryStub.value && !contributorStore.isContributorActiveOrPending) {
    generateCapitalDocuments().catch((error) => {
      console.error('Ошибка при генерации пачки документов:', error);
      FailAlert('Не удалось сгенерировать документы регистрации');
    });
  }
});

onBeforeUnmount(() => {
  stopRegistrationPoll();
});

const signAndCompleteRegistration = async () => {
  try {
    if (!generatedCapitalDocuments.value) {
      throw new Error('Документы не сгенерированы');
    }

    const {
      generation_contract,
      storage_agreement,
      blagorost_agreement,
      generator_offer,
    } = generatedCapitalDocuments.value;

    if (!storage_agreement) {
      throw new Error('Отсутствуют обязательные документы');
    }

    await completeRegistration(
      generation_contract,
      storage_agreement,
      blagorost_agreement,
      generator_offer,
    );

    SuccessAlert('Документы успешно подписаны и отправлены');
    goToProfile();
  } catch (error) {
    console.error('Ошибка при завершении регистрации:', error);
    FailAlert(error);
  }
};
</script>

<style lang="scss" scoped>
.capital-registration {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
  max-width: 880px;
  margin: 0 auto;
  padding: var(--p-4) var(--p-4) var(--p-8);
}

.reg-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--p-3);
  min-height: 240px;
  padding: var(--p-6);
  color: var(--p-ink-2);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}

.reg-loading__text {
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body-sm);
}

.reg-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--p-3);
}

.reg-docs {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}

.reg-doc__preview {
  max-height: 420px;
  overflow: auto;
  padding: var(--p-4);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm);
  color: var(--p-ink);
}

.reg-foot {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  justify-content: flex-end;
  gap: var(--p-3);
  margin-top: var(--p-2);
  padding: var(--p-3) 0;
  background: var(--p-canvas);
  border-top: 1px solid var(--p-line);
}
</style>
