<template>
  <q-page padding>
    <div class="q-pa-md" style="max-width: 720px">
      <div class="text-h5 q-mb-md">Опубликовать пакет</div>
      <BaseBanner v-if="!isChairman" variant="warn" class="q-mb-md">
        Регистрация пакета — председательская операция.
        Сейчас вы не председатель кооператива-разработчика.
      </BaseBanner>

      <BaseCard variant="default">
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
        v-if="lastResult && lastResult.status === 'applied'"
        variant="pos"
        class="q-mt-md"
      >
        Пакет зарегистрирован. Request: <span class="t-mono">{{ lastResult.requestId }}</span>.
      </BaseBanner>
      <BaseBanner
        v-else-if="lastResult && lastResult.status === 'conflict'"
        variant="warn"
        class="q-mt-md"
      >
        Пакет с таким packageId уже зарегистрирован. Используйте «Опубликовать релиз»
        для добавления новой версии.
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
import {
  usePublishPackage,
  type IPublishPackageInput,
} from '../features/PublishPackage/model';

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
</script>
