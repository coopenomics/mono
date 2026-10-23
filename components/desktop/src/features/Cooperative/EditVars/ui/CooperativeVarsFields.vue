<template lang="pug">
//- Параметры кооператива — значения, которые фабрика подставляет в документы.
//- Краткий набор нужен мастеру установки, полный — странице председателя.
.vars-fields
  //- ===== Наименование =====
  section.vars-section
    h3.vars-section__title {{ $t('cooperativeVars.nameSectionTitle') }}
    .vars-section__note
      span.chip {{ $t('cooperativeVars.opfChip') }}
      |  {{ $t('cooperativeVars.opfNote') }}
    .vars-section__fields
      BaseInput(
        v-if='extended'
        :model-value='form.coopname'
        :label='$t("cooperativeVars.coopnameLabel")'
        mono
        readonly
      )
      BaseInput(
        v-model='form.name'
        :label='$t("cooperativeVars.nameLabel")'
        :placeholder='$t("cooperativeVars.namePlaceholder")'
        :error='errorOf("name")'
        required
      )
      BaseInput(
        v-model='form.full_abbr'
        :label='$t("cooperativeVars.fullAbbrLabel")'
        :placeholder='$t("cooperativeVars.fullAbbrPlaceholder")'
        :error='errorOf("full_abbr")'
        required
      )
      BaseInput(
        v-model='form.full_abbr_genitive'
        :label='$t("cooperativeVars.fullAbbrGenitiveLabel")'
        :placeholder='$t("cooperativeVars.fullAbbrGenitivePlaceholder")'
        :error='errorOf("full_abbr_genitive")'
        required
      )
      BaseInput(
        v-model='form.full_abbr_dative'
        :label='$t("cooperativeVars.fullAbbrDativeLabel")'
        :placeholder='$t("cooperativeVars.fullAbbrDativePlaceholder")'
        :error='errorOf("full_abbr_dative")'
        required
      )
      BaseInput(
        v-model='form.short_abbr'
        :label='$t("cooperativeVars.shortAbbrLabel")'
        :placeholder='$t("cooperativeVars.shortAbbrPlaceholder")'
        :error='errorOf("short_abbr")'
        required
      )

  //- ===== Устав =====
  section.vars-section
    h3.vars-section__title {{ $t('cooperativeVars.statuteSectionTitle') }}
    p.vars-section__note {{ $t('cooperativeVars.statuteNote') }}
    .vars-section__fields
      BaseInput(
        v-model='form.statute_link'
        :label='$t("cooperativeVars.statuteLinkLabel")'
        placeholder='https://example.com/statute.pdf'
        type='url'
        :error='errorOf("statute_link")'
        required
      )

  //- ===== Паспортные данные =====
  section.vars-section
    h3.vars-section__title {{ $t('cooperativeVars.passportSectionTitle') }}
    p.vars-section__note {{ $t('cooperativeVars.passportNote') }}
    q-toggle(
      v-model='form.passport_request'
      :label='$t("cooperativeVars.passportToggleLabel")'
      :true-value="'yes'"
      :false-value="'no'"
      color='primary'
    )

  //- ===== Контакты и ссылки =====
  section.vars-section
    h3.vars-section__title {{ $t('cooperativeVars.contactSectionTitle') }}
    p.vars-section__note {{ $t('cooperativeVars.contactNote') }}
    .vars-section__fields
      BaseInput(
        v-model='form.confidential_email'
        :label='$t("cooperativeVars.confidentialEmailLabel")'
        type='email'
        :error='errorOf("confidential_email")'
        required
      )
      template(v-if='extended')
        BaseInput(
          v-model='form.contact_email'
          :label='$t("cooperativeVars.contactEmailLabel")'
          type='email'
        )
        BaseInput(
          v-model='form.website'
          :label='$t("cooperativeVars.websiteLabel")'
          type='url'
        )
        BaseInput(
          v-model='form.confidential_link'
          :label='$t("cooperativeVars.confidentialLinkLabel")'
          type='url'
        )

  //- ===== Реквизиты утверждения документов =====
  section.vars-section(v-if='extended')
    h3.vars-section__title {{ $t('cooperativeVars.protocolsSectionTitle') }}
    p.vars-section__note {{ $t('cooperativeVars.protocolsNote') }}
    .vars-protocol(v-for='key in AGREEMENT_VAR_KEYS', :key='key')
      .vars-protocol__title {{ $t(`cooperativeVars.agreement.${key}`) }}
      .vars-protocol__fields
        BaseInput(
          v-model='agreementOf(key).protocol_number'
          :label='$t("cooperativeVars.protocolNumberLabel")'
        )
        BaseInput(
          v-model='agreementOf(key).protocol_day_month_year'
          :label='$t("cooperativeVars.protocolDateLabel")'
          :placeholder='$t("cooperativeVars.protocolDatePlaceholder")'
        )
</template>

<script lang="ts" setup>
import { BaseInput } from 'src/shared/ui/base/BaseInput';
import { t } from 'src/shared/i18n';
import { AGREEMENT_VAR_KEYS, type AgreementVarKey, type IAgreementVarForm } from '../model';

const props = withDefaults(
  defineProps<{
    /** Полный набор: учётное имя, сайт и ссылки, реквизиты протоколов. */
    extended?: boolean;
    /** Показать ошибки пустых обязательных полей — после попытки сохранить. */
    showErrors?: boolean;
  }>(),
  { extended: false, showErrors: false },
);

// Объект параметров правится на месте: мастер установки держит его в своём
// хранилище, страница председателя — в локальной копии.
const form = defineModel<Record<string, any>>({ required: true });

const errorOf = (key: string): string | undefined =>
  props.showErrors && !String(form.value[key] ?? '').trim() ? t('validation.required') : undefined;

const agreementOf = (key: AgreementVarKey): IAgreementVarForm => {
  if (!form.value[key]) form.value[key] = { protocol_number: '', protocol_day_month_year: '' };
  return form.value[key] as IAgreementVarForm;
};
</script>

<style scoped lang="scss">
.vars-fields {
  display: flex;
  flex-direction: column;
  gap: var(--p-4);
}
.vars-section {
  padding: var(--p-4);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
}
.vars-section__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  color: var(--p-ink);
  margin: 0 0 var(--p-2);
}
.vars-section__note {
  margin: 0;
  font-size: var(--p-fs-body-sm);
  line-height: var(--p-lh-body);
  color: var(--p-ink-2);
}
.vars-section__fields {
  display: flex;
  flex-direction: column;
  margin-top: var(--p-3);
}
.vars-protocol {
  margin-top: var(--p-4);
}
.vars-protocol__title {
  font-size: var(--p-fs-body-sm);
  font-weight: 600;
  color: var(--p-ink);
  margin-bottom: var(--p-2);
}
.vars-protocol__fields {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: var(--p-3);
}
@media (max-width: 600px) {
  .vars-protocol__fields {
    grid-template-columns: 1fr;
  }
}
</style>
