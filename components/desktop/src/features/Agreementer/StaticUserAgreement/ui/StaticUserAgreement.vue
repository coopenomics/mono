<template lang="pug">
div
  .agreement-pending.t-body(v-if='isPending') Документ на утверждении советом.
  DocumentHtmlReader(v-else :html='userAgreementHtml')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { Cooperative } from 'cooptypes';

const { info } = useSystemStore();

const userAgreementTemplate = Cooperative.Registry.UserAgreement;

const isPending = computed(() => {
  const protocol = info?.vars?.user_agreement;
  return !protocol?.protocol_number || !protocol?.protocol_day_month_year;
});

const userAgreementHtml = computed(() => {
  if (!info || !info.vars) {
    return '<div>Загрузка пользовательского соглашения...</div>';
  }

  const vars = info.vars;
  const contacts = info.contacts;
  const chairman = contacts?.chairman;
  const translation = userAgreementTemplate.translations.ru;

  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/\{\{\s*vars\.full_abbr_genitive\s*\}\}/g, vars.full_abbr_genitive || '')
      .replace(/\{\{\s*vars\.full_abbr\s*\}\}/g, vars.full_abbr || '')
      .replace(/\{\{\s*vars\.name\s*\}\}/g, vars.name || '')
      .replace(/\{\{\s*vars\.website\s*\}\}/g, vars.website || '')
      .replace(/\{\{\s*vars\.user_agreement\.protocol_number\s*\}\}/g, vars.user_agreement?.protocol_number || '')
      .replace(/\{\{\s*vars\.user_agreement\.protocol_day_month_year\s*\}\}/g, vars.user_agreement?.protocol_day_month_year || '')
      .replace(/\{\{\s*coop\.short_name\s*\}\}/g, contacts?.full_name || '')
      .replace(/\{\{\s*coop\.chairman\.last_name\s*\}\}/g, chairman?.last_name || '')
      .replace(/\{\{\s*coop\.chairman\.first_name\s*\}\}/g, chairman?.first_name || '')
      .replace(/\{\{\s*coop\.chairman\.middle_name\s*\}\}/g, chairman?.middle_name || '')
      .replace(/\{\{\s*user\.full_name\s*\}\}/g, '____________________')
      .replace(/\{\{\s*meta\.created_at\s*\}\}/g, '');
  };

  const replaceTranslations = (html: string): string => {
    let result = html;
    Object.entries(translation).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\%\\s*trans\\s*'${key}'\\s*\\%\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };

  let html = userAgreementTemplate.context;
  html = replaceTranslations(html);
  html = replacePlaceholders(html);

  return html;
});
</script>

<style scoped>
.agreement-pending {
  padding: var(--p-4);
  color: var(--p-ink-2);
  text-align: center;
}
</style>
