<template lang="pug">
.set-vars(v-if='installStore.vars')
  //- ===== Наименование =====
  section.vars-section
    h3.vars-section__title Наименование
    .vars-section__note
      span.chip ОПФ+
      |  — основа полного наименования. Например: «Потребительский Кооператив Социального Комплекса» или «Потребительский Кооператив». Ввод осуществляйте без кавычек.
    .vars-section__fields
      q-input(
        autofocus,
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.name',
        label='Собственное наименование кооператива',
        placeholder='Ромашка',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr',
        label='ОПФ+ в именительном падеже',
        placeholder='Потребительский Кооператив Социального Комплекса',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr_genitive',
        label='ОПФ+ в родительном падеже',
        placeholder='Потребительского Кооператива Социального Комплекса',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.full_abbr_dative',
        label='ОПФ+ в дательном падеже',
        placeholder='Потребительскому Кооперативу Социального Комплекса',
        :rules='[val => notEmpty(val)]'
      )
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.short_abbr',
        label='Краткая аббревиатура ОПФ+',
        placeholder='ПКСК',
        :rules='[val => notEmpty(val)]'
      )

  //- ===== Устав =====
  section.vars-section
    h3.vars-section__title Устав
    p.vars-section__note Укажите ссылку на устав вашего кооператива, ознакомиться с которым будет предложено пайщикам при регистрации.
    .vars-section__fields
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.statute_link',
        label='Ссылка на устав кооператива',
        placeholder='https://example.com/statute.pdf',
        type='url',
        :rules='[val => notEmpty(val)]'
      )

  //- ===== Паспортные данные =====
  section.vars-section
    h3.vars-section__title Паспортные данные
    p.vars-section__note Укажите, должны ли заявления на вступление в кооператив и система в целом запрашивать паспортные данные пайщиков при регистрации.
    q-toggle(
      v-model='installStore.vars.passport_request',
      label='Запрашивать паспортные данные',
      :true-value="'yes'",
      :false-value="'no'",
      color='primary'
    )

  //- ===== Контактная информация =====
  section.vars-section
    h3.vars-section__title Контактная информация
    p.vars-section__note Заполните электронную почту, которая будет размещена в политике конфиденциальности как контактная.
    .vars-section__fields
      q-input(
        outlined,
        dense,
        reserve-hint-space,
        color='primary',
        v-model='installStore.vars.confidential_email',
        label='Email по вопросам конфиденциальности',
        type='email',
        :rules='[val => notEmpty(val)]'
      )

  .set-vars__actions
    BaseButton(variant='ghost', @click='back')
      q-icon(name='arrow_back', size='16px')
      span.q-ml-sm Назад
    BaseButton(variant='primary', :loading='loading', @click='next')
      q-icon(name='done', size='16px')
      span.q-ml-sm Завершить установку
</template>

<script lang="ts" setup>
import { useInstallCooperativeStore } from 'src/entities/Installer/model';
import { useSystemStore } from 'src/entities/System/model';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useInstallCooperative } from '../../model';
import { notEmpty } from 'src/shared/lib/utils';
import { ref, onMounted } from 'vue';
import { BaseButton } from 'src/shared/ui/base/BaseButton';

const installStore = useInstallCooperativeStore();
const { info } = useSystemStore();
const loading = ref(false);

onMounted(() => {
  // Инициализируем переменные если их нет
  if (!installStore.vars) {
    installStore.vars = {
      coopname: info.coopname,
      full_abbr: '',
      full_abbr_genitive: '',
      full_abbr_dative: '',
      short_abbr: '',
      website: window.location.origin,
      name: '',
      confidential_link: window.location.origin + '/privacy',
      confidential_email: '',
      contact_email: '',
      passport_request: 'no',
      statute_link: '',
      wallet_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      signature_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      privacy_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      user_agreement: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
      participant_application: {
        protocol_number: '',
        protocol_day_month_year: '',
      },
    };
  }
});

const back = () => {
  installStore.current_step = 'soviet';
};

const next = async () => {
  try {
    const { install } = useInstallCooperative();
    loading.value = true;
    await install();
    await useSystemStore().loadSystemInfo();

    loading.value = false;
    installStore.is_finish = true;
    installStore.wif = '';
    installStore.soviet = [];
    installStore.vars = undefined;
    installStore.current_step = 'key';

    SuccessAlert('Установка произведена успешно');
  } catch (e: any) {
    FailAlert(e);
    loading.value = false;
  }
};
</script>

<style scoped lang="scss">
.set-vars {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
}

.vars-section {
  padding: var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
}
.vars-section__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
  margin: 0 0 var(--p-2, 8px);
}
.vars-section__note {
  margin: 0;
  font-size: var(--p-fs-body-sm, 13px);
  line-height: var(--p-lh-body, 1.55);
  color: var(--p-ink-2);
}
.vars-section__fields {
  display: flex;
  flex-direction: column;
  /* gap не задаём: reserve-hint-space у q-input уже разделяет поля (канон BaseForm). */
  margin-top: var(--p-3, 12px);
}

.set-vars__actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-2, 8px);
  margin-top: var(--p-2, 8px);
}
</style>
