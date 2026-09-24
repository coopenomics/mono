<template lang="pug">
.capital-registration
  //- ВРЕМЕННЫЙ КОСТЫЛЬ: ранние участники без Contributor
  template(v-if='shouldShowTemporaryStub')
    .banner.banner--warn
      q-icon.banner__icon(name='info', size='20px')
      .banner__body
        strong {{ $t('capital.capitalRegistrationPage.earlyParticipantsTitle') }}
        |
        | {{ $t('capital.capitalRegistrationPage.earlyParticipantsText') }}
        | {{ $t('capital.capitalRegistrationPage.contactSupportText') }}
        |
        strong support@coopenomics.world
        |  {{ $t('capital.capitalRegistrationPage.orChatText') }}

  template(v-else)
    .banner.banner--info
      q-icon.banner__icon(name='description', size='20px')
      .banner__body
        | {{ $t('capital.capitalRegistrationPage.reviewDocsText') }}

    .reg-loading(v-if='isGeneratingCapitalDocs')
      q-spinner(color='primary', size='28px')
      span.reg-loading__text {{ $t('capital.capitalRegistrationPage.preparingDocsText') }}

    .reg-error(v-else-if='capitalDocsGenerationError')
      .banner.banner--neg
        q-icon.banner__icon(name='error', size='20px')
        .banner__body {{ $t('capital.capitalRegistrationPage.generateFailedText') }}
      BaseButton(
        variant='primary',
        :loading='isGeneratingCapitalDocs',
        @click='regenerateCapitalDocuments'
      )
        template(#icon-left)
          q-icon(name='refresh', size='18px')
        | {{ $t('common.action.retry') }}

    EmptyState(
      v-else-if='!hasGeneratedDocuments',
      :title='$t("capital.capitalRegistrationPage.docsNotReadyTitle")',
      :body='$t("capital.capitalRegistrationPage.docsNotReadyBody")'
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
          | {{ $t('capital.capitalRegistrationPage.signSubmitLabel') }}
</template>

<script lang="ts" setup>
import { computed, onMounted, watch } from 'vue';
import { useLiveReload } from 'src/shared/lib/realtime';
import { CAPITAL_LIVE_TABLES } from 'app/extensions/capital/shared/lib/live';
import { useRouter } from 'vue-router';
import { useGenerateCapitalRegistrationDocuments } from 'app/extensions/capital/features/Contributor/GenerateCapitalRegistrationDocuments/model';
import { useCompleteCapitalRegistration } from 'app/extensions/capital/features/Contributor/CompleteCapitalRegistration/model';
import { useContributorStore } from 'app/extensions/capital/entities/Contributor/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { BaseButton, BaseCard, EmptyState } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { t } from '../../../i18n';

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
      title: t('capital.capitalRegistrationPage.contractDocTitle', { index: n++ }),
      html: pack.generation_contract.html,
    });
  }
  if (pack.storage_agreement?.html) {
    list.push({
      key: 'storage_agreement',
      title: t('capital.capitalRegistrationPage.storageDocTitle', { index: n++ }),
      html: pack.storage_agreement.html,
    });
  }
  if (pack.blagorost_agreement?.html) {
    list.push({
      key: 'blagorost_agreement',
      title: t('capital.capitalRegistrationPage.blagorostDocTitle', { index: n++ }),
      html: pack.blagorost_agreement.html,
    });
  }
  if (pack.generator_offer?.html) {
    list.push({
      key: 'generator_offer',
      title: t('capital.capitalRegistrationPage.generatorDocTitle', { index: n++ }),
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

// Живой экран: перечитывается по ленте изменений Благороста вместо опроса по
// таймеру (набор таблиц — shared/lib/live).
useLiveReload(CAPITAL_LIVE_TABLES, reloadRegistrationData);

onMounted(() => {
  redirectIfRegistered();

  if (!shouldShowTemporaryStub.value && !contributorStore.isContributorActiveOrPending) {
    generateCapitalDocuments().catch((error) => {
      console.error('Ошибка при генерации пачки документов:', error);
      FailAlert(t('capital.capitalRegistrationPage.generateError'));
    });
  }
});

const signAndCompleteRegistration = async () => {
  try {
    if (!generatedCapitalDocuments.value) {
      throw new Error(t('capital.error.registrationDocumentsNotGenerated'));
    }

    const {
      generation_contract,
      storage_agreement,
      blagorost_agreement,
      generator_offer,
    } = generatedCapitalDocuments.value;

    if (!storage_agreement) {
      throw new Error(t('capital.error.registrationRequiredDocumentsMissing'));
    }

    await completeRegistration(
      generation_contract,
      storage_agreement,
      blagorost_agreement,
      generator_offer,
    );

    SuccessAlert(t('capital.capitalRegistrationPage.signSuccess'));
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
