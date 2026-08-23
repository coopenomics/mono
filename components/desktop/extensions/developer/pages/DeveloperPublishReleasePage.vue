<template>
  <q-page padding>
    <div class="q-pa-md" style="max-width: 720px">
      <BaseBanner v-if="!isChairman" variant="warn" class="q-mb-md">
        Публикация пакетов и релизов — председательская операция.
        Сейчас вы не председатель кооператива-разработчика.
      </BaseBanner>
      <BaseBanner v-else variant="info" class="q-mb-md">
        Регистрация пакета (шаг 1) нужна только для ручного пути — CI
        издателя регистрирует пакет сам при первом релизе. Релиз (шаг 2)
        подаётся на версию, уже залитую в реестр каталога
        (<span class="t-mono">npm publish</span>): первый релиз пакета
        уходит на модерацию, следующие принимаются автоматически.
        Токены для CI — на странице «Издатели».
      </BaseBanner>

      <h3 class="publish-section__title">Шаг 1. Регистрация пакета</h3>
      <BaseCard variant="default" class="q-mb-lg">
        <BaseForm :loading="isSubmitting" :error="lastError ?? undefined" @submit="onSubmit">
            <BaseInput
              v-model="packageId"
              label="Идентификатор пакета"
              placeholder="@voskhod/demoapp"
              hint="Формат @scope/name. scope — Antelope-имя кооператива-разработчика."
              :error="errors.packageId"
              required
              mono
            />

            <BaseInput
              v-model="ownerUsername"
              label="Antelope-аккаунт владельца"
              placeholder="voskhod"
              hint="1..12 символов: [a-z], [1-5], точка."
              :error="errors.ownerUsername"
              required
              mono
            />

            <div>
              <div class="t-fs-14 t-fw-500 q-mb-xs">Совместимые подсети</div>
              <div class="t-fs-13 text-grey q-mb-sm">
                По одному chain_id (64 hex-символа) на строку.
              </div>
              <q-input
                v-model="compatibleSubnetsRaw"
                type="textarea"
                outlined
                dense
                autogrow
                :error="!!errors.compatibleSubnets"
                :error-message="errors.compatibleSubnets"
                placeholder="db79c8409645082749ca50640d6f4ee511575acf26c4e2c8e4748e6bf6a01ed4"
                input-class="t-mono t-fs-13"
              />
            </div>

            <template #footer="{ loading }">
              <BaseButton
                variant="primary"
                type="submit"
                :loading="loading"
                :disabled="!isChairman"
              >
                Зарегистрировать пакет on-chain
              </BaseButton>
            </template>
        </BaseForm>
      </BaseCard>

      <BaseBanner
        v-if="lastResult && lastResult.status === PublishPackageStatus.APPLIED"
        variant="pos"
        class="q-mb-lg"
      >
        Пакет зарегистрирован. Request: <span class="t-mono">{{ lastResult.requestId }}</span>.
      </BaseBanner>
      <BaseBanner
        v-else-if="lastResult && lastResult.status === PublishPackageStatus.CONFLICT"
        variant="warn"
        class="q-mb-lg"
      >
        Пакет с таким packageId уже зарегистрирован. Опубликуйте новую версию
        в шаге 2.
      </BaseBanner>

      <h3 class="publish-section__title">Шаг 2. Публикация релиза</h3>
      <BaseCard variant="default">
        <BaseForm
          :loading="releaseSubmitting"
          :error="releaseError ?? undefined"
          @submit="onSubmitRelease"
        >
          <BaseInput
            v-model="releasePackageId"
            label="Идентификатор пакета"
            placeholder="@voskhod/demoapp"
            hint="Версия уже должна быть залита npm publish в реестр каталога."
            :error="releaseErrors.packageId"
            required
            mono
          />

          <BaseInput
            v-model="releaseVersion"
            label="Версия релиза"
            placeholder="1.0.0"
            hint="Semver: major.minor.patch."
            :error="releaseErrors.version"
            required
            mono
          />

          <BaseInput
            v-model="releaseBrief"
            label="Что изменилось"
            hint="Кратко для модератора. Необязательно."
            :error="releaseErrors.brief"
          />

          <template #footer="{ loading }">
            <BaseButton
              variant="primary"
              type="submit"
              :loading="loading"
              :disabled="!isChairman"
            >
              Опубликовать релиз
            </BaseButton>
          </template>
        </BaseForm>
      </BaseCard>

      <BaseBanner
        v-if="releaseResult && releaseResult.status === PublishReleaseStatus.APPLIED"
        variant="pos"
        class="q-mt-md"
      >
        Релиз активирован: пакет уже проходил модерацию, подписчики получат
        версию автоматически. Request: <span class="t-mono">{{ releaseResult.requestId }}</span>.
      </BaseBanner>
      <BaseBanner
        v-else-if="releaseResult && releaseResult.status === PublishReleaseStatus.QUEUED"
        variant="info"
        class="q-mt-md"
      >
        Первый релиз пакета — отправлен на модерацию (заявка
        <span class="t-mono">{{ releaseResult.moderationId }}</span>).
        После одобрения следующие версии будут приниматься автоматически.
      </BaseBanner>
      <BaseBanner
        v-else-if="releaseResult && releaseResult.status === PublishReleaseStatus.NOT_PUBLISHED"
        variant="warn"
        class="q-mt-md"
      >
        Версии нет в реестре каталога. Сначала выполните
        <span class="t-mono">npm publish</span> (или CI издателя), затем подайте релиз.
      </BaseBanner>
      <BaseBanner
        v-else-if="releaseResult && releaseResult.status === PublishReleaseStatus.CONFLICT"
        variant="warn"
        class="q-mt-md"
      >
        Эта версия уже подана или выпущена.
      </BaseBanner>
      <BaseBanner
        v-else-if="releaseResult && releaseResult.status === PublishReleaseStatus.INVALID_MANIFEST"
        variant="neg"
        class="q-mt-md"
      >
        Манифест не прошёл валидацию каталога: {{ releaseResult.error }}
      </BaseBanner>
    </div>
  </q-page>
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
    errors.packageId = 'Ожидается @scope/name из [a-z0-9-].';
  }
  if (!ANTELOPE_NAME_RE.test(ownerUsername.value.trim())) {
    errors.ownerUsername = 'Antelope-имя: 1..12 символов из [a-z1-5.].';
  }

  const subnets = compatibleSubnetsRaw.value
    .split(/[\s,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (subnets.length === 0) {
    errors.compatibleSubnets = 'Нужен минимум один chain_id.';
  } else {
    const bad = subnets.find((s) => !CHAIN_ID_RE.test(s));
    if (bad) errors.compatibleSubnets = `Неверный chain_id: ${bad}`;
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
    releaseErrors.packageId = 'Ожидается @scope/name из [a-z0-9-].';
  }
  if (!SEMVER_RE.test(releaseVersion.value.trim())) {
    releaseErrors.version = 'Semver: например 1.0.0.';
  }
  if (releaseBrief.value.length > 2000) {
    releaseErrors.brief = 'До 2000 символов.';
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
