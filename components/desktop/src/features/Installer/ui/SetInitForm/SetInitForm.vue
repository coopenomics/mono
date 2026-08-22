<template lang="pug">
.set-init
  div(v-if='!loading && installationStatus')
    //- Если данные установлены сервером — показываем readonly
    div(v-if='installationStatus.init_by_server')
      .install-note
        | Вам предустановлены данные кооператива. Пожалуйста, проверьте их, и
        | в случае обнаружения ошибок обратитесь к вашему оператору для внесения
        | изменений.

      CreateOrganizationDataForm(
        :data='installationStatus.organization_data || installStore.organization_data',
        readonly,
        hideMatchButton
      )

      .set-init__actions
        BaseButton(variant='ghost', @click='back')
          q-icon(name='arrow_back', size='16px')
          span.q-ml-sm Назад
        BaseButton(variant='primary', :loading='saving', @click='next')
          span.q-mr-sm Далее
          q-icon(name='arrow_forward', size='16px')

    //- Если данных нет или они введены пользователем — форма для ввода/редактирования
    div(v-else)
      .install-note
        | Заполните данные кооператива. Они будут использоваться для организации
        | документооборота с пайщиками.

      CreateOrganizationDataForm(
        :data='installStore.organization_data',
        @update:data='onOrganizationDataUpdate'
      )
        template(#top)
          q-input(
            ref='emailInput',
            autofocus,
            outlined,
            dense,
            color='primary',
            v-model='organizationEmail',
            label='Email организации',
            type='email',
            :rules='[val => notEmpty(val)]',
            autocomplete='off'
          )

      .set-init__actions
        BaseButton(variant='ghost', @click='back')
          q-icon(name='arrow_back', size='16px')
          span.q-ml-sm Назад
        BaseButton(
          variant='primary',
          :loading='saving',
          :disabled='!isValidData',
          @click='saveAndNext'
        )
          span.q-mr-sm Продолжить
          q-icon(name='arrow_forward', size='16px')

  div(v-else-if='loading')
    Loader(text='Загрузка данных...')

  .set-init__error(v-else)
    q-icon(name='error', size='48px', color='negative')
    p.set-init__error-text Ошибка загрузки данных
    BaseButton(variant='secondary', @click='loadData')
      q-icon(name='refresh', size='16px')
      span.q-ml-sm Повторить
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { useInstallCooperative } from '../../model';
import { CreateOrganizationDataForm, type ICreateOrganizationData } from 'src/shared/ui/UserDataForm/CreateOrganizationDataForm';
import Loader from 'src/shared/ui/Loader/Loader.vue';
import { FailAlert } from 'src/shared/api';
import { extractGraphQLErrorMessages } from 'src/shared/api/errors';
import { useSystemStore } from 'src/entities/System/model';
import { notEmpty } from 'src/shared/lib/utils';
import { stripLegacyBankKpp } from 'src/shared/lib/utils/stripLegacyBankKpp';
import { Zeus } from '@coopenomics/sdk';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

defineEmits<{
  next: []
}>();

const installStore = useInstallCooperativeStore();
const { getInstallationStatus, initSystem } = useInstallCooperative();
const systemStore = useSystemStore();

const loading = ref(false);
const saving = ref(false);
const installationStatus = ref<any>(null);
const emailInput = ref<any>();

// Функция для создания дефолтных данных организации
const createDefaultOrganizationData = (): ICreateOrganizationData => ({
    short_name: '',
    full_name: '',
    type: Zeus.OrganizationType.COOP,
    represented_by: {
      last_name: '',
      first_name: '',
      middle_name: '',
      based_on: '',
      position: '',
    },
    phone: '',
    email: '',
    country: 'Russia',
    city: '',
    full_address: '',
    fact_address: '',
    details: {
      inn: '',
      ogrn: '',
      kpp: '',
    },
    bank_account: {
      bank_name: '',
      details: {
        corr: '',
        bik: '',
      },
      account_number: '',
      currency: 'RUB',
    },
});


// Computed для безопасного доступа к email
const organizationEmail = computed({
  get: () => installStore.organization_data?.email || '',
  set: (value: string) => {
    if (installStore.organization_data) {
      installStore.organization_data.email = value;
    }
  }
});

const isValidData = computed(() => {
  const data = installStore.organization_data;
  return !!(
    data?.email &&
    data?.short_name &&
    data?.full_name &&
    data?.represented_by?.last_name &&
    data?.represented_by?.first_name &&
    data?.phone &&
    data?.city &&
    data?.full_address &&
    data?.fact_address &&
    data?.details?.inn &&
    data?.details?.ogrn &&
    data?.details?.kpp &&
    data?.bank_account?.bank_name &&
    data?.bank_account?.details?.corr &&
    data?.bank_account?.details?.bik &&
    data?.bank_account?.account_number
  );
});

const loadData = async () => {
  if (!installStore.install_code) {
    FailAlert('Код установки не найден');
    installStore.current_step = 'key';
    return;
  }

  loading.value = true;
  try {
    installationStatus.value = await getInstallationStatus(installStore.install_code);
    // Всегда начинаем с шага init
    installStore.current_step = 'init';

    // Если данные организации уже установлены, загружаем их для просмотра в readonly
    if (installationStatus.value.organization_data) {
      // Исключаем поле username, которое не нужно для повторной инициализации
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { username, ...organizationData } = installationStatus.value.organization_data;

      // Преобразуем значение type в uppercase для соответствия GraphQL enum
      if (organizationData.type && typeof organizationData.type === 'string') {
        organizationData.type = organizationData.type.toUpperCase();
      }

      installStore.organization_data = stripLegacyBankKpp(organizationData);
    }
  } catch (error: any) {
    const errorMessage = extractGraphQLErrorMessages(error);
    // Если код истек или невалиден - возвращаемся на шаг ввода ключа
    if (errorMessage.includes('истекший') || errorMessage.includes('Неверный')) {
      FailAlert('Код установки истек или невалиден. Пожалуйста, введите ключ заново.');
      installStore.current_step = 'key';
      installStore.install_code = undefined;
    } else {
      FailAlert(error);
    }
  } finally {
    loading.value = false;
  }
};

const onOrganizationDataUpdate = (data: ICreateOrganizationData) => {
  installStore.organization_data = data;
};

const back = () => {
  installStore.current_step = 'key';
};

const next = () => {
  installStore.current_step = 'soviet';
};

const saveAndNext = async () => {
  saving.value = true;
  try {
    // Вызываем initSystem с данными организации
    await initSystem({
      organization_data: installStore.organization_data as any
    });

    // Обновляем информацию о системе
    await systemStore.loadSystemInfo();

    // После успешной инициализации данные остаются в store для возможности возврата назад
    // Не очищаем organization_data, чтобы пользователь мог видеть данные при возвращении

    next();
  } catch (error: any) {
    FailAlert(error.message || 'Ошибка инициализации');
  } finally {
    saving.value = false;
  }
};

onMounted(async () => {
  // Инициализируем данные организации в store, если их нет
  if (!installStore.organization_data) {
    installStore.organization_data = createDefaultOrganizationData();
  }

  loadData();
  await nextTick();
  if (emailInput.value) {
    emailInput.value.$el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
});

watch(() => installStore.install_code, () => {
  if (installStore.install_code) {
    loadData();
  }
});

watch(() => installStore.current_step, (newStep) => {
  if (newStep === 'init' && installStore.install_code) {
    loadData();
  }
});
</script>

<style scoped lang="scss">
.install-note {
  padding: var(--p-3, 12px) var(--p-4, 16px);
  margin-bottom: var(--p-4, 16px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}

.set-init__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  margin-top: var(--p-5, 20px);
}

.set-init__error {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--p-3, 12px);
  padding: var(--p-6, 24px);
}
.set-init__error-text {
  margin: 0;
  font-size: var(--p-fs-body, 14px);
  font-weight: 600;
  color: var(--p-ink);
}
</style>
