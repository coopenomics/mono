<template lang="pug">
q-page(padding)
  .q-pa-md(style='max-width: 720px')
    BaseBanner.q-mb-md(v-if='!isChairman', variant='warn')
      | {{ $t('developer.publish.notChairman') }}
    BaseBanner.q-mb-md(v-else, variant='info')
      | {{ $t('developer.publish.introBefore') }} (
      span.t-mono npm publish
      | ). {{ $t('developer.publish.introAfter') }}

    h3.publish-section__title {{ $t('developer.publish.step1Title') }}
    BaseCard.q-mb-lg(variant='default')
      BaseForm(:loading='isSubmitting', :error='lastError ?? undefined', @submit='onSubmit')
        BaseInput(
          v-model='packageId',
          :label="$t('developer.publish.packageIdLabel')",
          placeholder='@voskhod/demoapp',
          :hint="$t('developer.publish.packageIdHint')",
          :error='errors.packageId',
          required,
          mono
        )

        BaseInput(
          v-model='ownerUsername',
          :label="$t('developer.publish.ownerLabel')",
          placeholder='voskhod',
          :hint="$t('developer.publish.ownerHint')",
          :error='errors.ownerUsername',
          required,
          mono
        )

        BaseInput(
          v-model='compatibleSubnetsRaw',
          type='textarea',
          autogrow,
          mono,
          :label="$t('developer.publish.subnetsLabel')",
          :hint="$t('developer.publish.subnetsHint')",
          :error='errors.compatibleSubnets',
          placeholder='db79c8409645082749ca50640d6f4ee511575acf26c4e2c8e4748e6bf6a01ed4'
        )

        template(#footer='{ loading }')
          BaseButton(
            variant='primary',
            type='submit',
            :loading='loading',
            :disabled='!isChairman'
          ) {{ $t('developer.publish.registerSubmit') }}

    BaseBanner.q-mb-lg(
      v-if='lastResult && lastResult.status === PublishPackageStatus.APPLIED',
      variant='pos'
    )
      | {{ $t('developer.publish.registered') }}
      |
      span.t-mono {{ lastResult.requestId }}
      | .
    BaseBanner.q-mb-lg(
      v-else-if='lastResult && lastResult.status === PublishPackageStatus.CONFLICT',
      variant='warn'
    )
      | {{ $t('developer.publish.packageConflict') }}

    h3.publish-section__title {{ $t('developer.publish.step2Title') }}
    BaseCard(variant='default')
      BaseForm(
        :loading='releaseSubmitting',
        :error='releaseError ?? undefined',
        @submit='onSubmitRelease'
      )
        BaseInput(
          v-model='releasePackageId',
          :label="$t('developer.publish.packageIdLabel')",
          placeholder='@voskhod/demoapp',
          :hint="$t('developer.publish.releasePackageHint')",
          :error='releaseErrors.packageId',
          required,
          mono
        )

        BaseInput(
          v-model='releaseVersion',
          :label="$t('developer.publish.versionLabel')",
          placeholder='1.0.0',
          :hint="$t('developer.publish.versionHint')",
          :error='releaseErrors.version',
          required,
          mono
        )

        BaseInput(
          v-model='releaseBrief',
          :label="$t('developer.publish.briefLabel')",
          :hint="$t('developer.publish.briefHint')",
          :error='releaseErrors.brief'
        )

        template(#footer='{ loading }')
          BaseButton(
            variant='primary',
            type='submit',
            :loading='loading',
            :disabled='!isChairman'
          ) {{ $t('developer.install.publishRelease') }}

    BaseBanner.q-mt-md(
      v-if='releaseResult && releaseResult.status === PublishReleaseStatus.APPLIED',
      variant='pos'
    )
      | {{ $t('developer.publish.applied') }}
      |
      span.t-mono {{ releaseResult.requestId }}
      | .
    BaseBanner.q-mt-md(
      v-else-if='releaseResult && releaseResult.status === PublishReleaseStatus.QUEUED',
      variant='info'
    )
      | {{ $t('developer.publish.queuedBefore') }}
      |
      span.t-mono {{ releaseResult.moderationId }}
      | . {{ $t('developer.publish.queuedAfter') }}
    BaseBanner.q-mt-md(
      v-else-if='releaseResult && releaseResult.status === PublishReleaseStatus.NOT_PUBLISHED',
      variant='warn'
    )
      | {{ $t('developer.publish.notPublishedBefore') }}
      |
      span.t-mono npm publish
      |
      | {{ $t('developer.publish.notPublishedAfter') }}
    BaseBanner.q-mt-md(
      v-else-if='releaseResult && releaseResult.status === PublishReleaseStatus.CONFLICT',
      variant='warn'
    )
      | {{ $t('developer.publish.releaseConflict') }}
    BaseBanner.q-mt-md(
      v-else-if='releaseResult && releaseResult.status === PublishReleaseStatus.INVALID_MANIFEST',
      variant='neg'
    )
      | {{ $t('developer.publish.invalidManifest', { error: releaseResult.error }) }}
</template>

<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import {
  BaseBanner,
  BaseButton,
  BaseCard,
  BaseForm,
  BaseInput,
} from 'src/shared/ui/base';
import { useSessionStore } from 'src/entities/Session';
import { Zeus } from '@coopenomics/sdk';
import {
  usePublishPackage,
  type IPublishPackageInput,
} from '../features/PublishPackage/model';
import {
  usePublishRelease,
  type IPublishReleaseInput,
} from '../features/PublishRelease/model';
import { t } from '../i18n';

const PublishPackageStatus = Zeus.PublishPackageStatus;
const PublishReleaseStatus = Zeus.PublishReleaseStatus;

const session = useSessionStore();
const isChairman = computed<boolean>(() => {
  const role = session.currentUserAccount?.provider_account?.role;
  return role === 'chairman';
});

const packageId = ref<string>('');
const ownerUsername = ref<string>(session.username || '');
const compatibleSubnetsRaw = ref<string>('');

const errors = reactive<Record<keyof IPublishPackageInput | 'compatibleSubnets', string>>({
  packageId: '',
  ownerUsername: '',
  compatibleSubnets: '',
});

const { isSubmitting, lastResult, lastError, submit } = usePublishPackage();

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;
const ANTELOPE_NAME_RE = /^[a-z1-5.]{1,12}$/;
const CHAIN_ID_RE = /^[a-f0-9]{64}$/i;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[0-9A-Za-z-.]+)?$/;

function validate(): IPublishPackageInput | null {
  errors.packageId = '';
  errors.ownerUsername = '';
  errors.compatibleSubnets = '';

  if (!PACKAGE_ID_RE.test(packageId.value.trim())) {
    errors.packageId = t('developer.publish.validation.packageIdFormat');
  }
  if (!ANTELOPE_NAME_RE.test(ownerUsername.value.trim())) {
    errors.ownerUsername = t('developer.publish.validation.ownerFormat');
  }

  const subnets = compatibleSubnetsRaw.value
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (subnets.length === 0) {
    errors.compatibleSubnets = t('developer.publish.validation.subnetsRequired');
  } else {
    const bad = subnets.find((s) => !CHAIN_ID_RE.test(s));
    if (bad) errors.compatibleSubnets = t('developer.publish.validation.subnetInvalid', { value: bad });
  }

  if (errors.packageId || errors.ownerUsername || errors.compatibleSubnets) return null;

  return {
    packageId: packageId.value.trim(),
    ownerUsername: ownerUsername.value.trim(),
    compatibleSubnets: subnets,
  };
}

async function onSubmit(): Promise<void> {
  const input = validate();
  if (!input) return;
  try {
    await submit(input);
  } catch {
    // ошибка уже легла в lastError через composable
  }
}

// ─── Шаг 2: релиз ────────────────────────────────────────────────────────

const releasePackageId = ref<string>('');
const releaseVersion = ref<string>('');
const releaseBrief = ref<string>('');


const releaseErrors = reactive<Record<'packageId' | 'version' | 'brief', string>>({
  packageId: '',
  version: '',
  brief: '',
});

const {
  isSubmitting: releaseSubmitting,
  lastResult: releaseResult,
  lastError: releaseError,
  submit: submitRelease,
} = usePublishRelease();

function validateRelease(): IPublishReleaseInput | null {
  releaseErrors.packageId = '';
  releaseErrors.version = '';
  releaseErrors.brief = '';

  if (!PACKAGE_ID_RE.test(releasePackageId.value.trim())) {
    releaseErrors.packageId = t('developer.publish.validation.packageIdFormat');
  }
  if (!SEMVER_RE.test(releaseVersion.value.trim())) {
    releaseErrors.version = t('developer.publish.validation.versionFormat');
  }
  if (releaseBrief.value.length > 2000) {
    releaseErrors.brief = t('developer.publish.validation.briefTooLong');
  }

  if (releaseErrors.packageId || releaseErrors.version || releaseErrors.brief) {
    return null;
  }

  const brief = releaseBrief.value.trim();
  return {
    packageId: releasePackageId.value.trim(),
    version: releaseVersion.value.trim(),
    ...(brief ? { brief } : {}),
  };
}

async function onSubmitRelease(): Promise<void> {
  const input = validateRelease();
  if (!input) return;
  try {
    await submitRelease(input);
  } catch {
    // ошибка уже легла в releaseError через composable
  }
}
</script>

<style scoped lang="scss">
.publish-section__title {
  margin: 0 0 var(--p-3);
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
