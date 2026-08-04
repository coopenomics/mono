<template lang="pug">
div
  .agreement-pending.t-body(v-if='isPending') Документ на утверждении советом.
  DocumentHtmlReader(v-else :html='privacyPolicyHtml')
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useSystemStore } from 'src/entities/System/model';
import { DocumentHtmlReader } from 'src/shared/ui/DocumentHtmlReader';
import { Cooperative } from 'cooptypes';

const { info } = useSystemStore();

const privacyPolicyTemplate = Cooperative.Registry.PrivacyPolicy;

const isPending = computed(() => {
  const protocol = info?.vars?.privacy_agreement;
  return !protocol?.protocol_number || !protocol?.protocol_day_month_year;
});

const privacyPolicyHtml = computed(() => {
  if (!info || !info.vars) {
    return '<div>Загрузка политики конфиденциальности...</div>';
  }

  const vars = info.vars;
  const contacts = info.contacts;
  const translation = privacyPolicyTemplate.translations.ru;

  const replacePlaceholders = (text: string): string => {
    return text
      .replace(/\{\{\s*vars\.full_abbr_dative\s*\}\}/g, vars.full_abbr_dative || '')
      .replace(/\{\{\s*vars\.name\s*\}\}/g, vars.name || '')
      .replace(/\{\{\s*vars\.website\s*\}\}/g, vars.website || '')
      .replace(/\{\{\s*vars\.short_abbr\s*\}\}/g, vars.short_abbr || '')
      .replace(/\{\{\s*vars\.confidential_email\s*\}\}/g, vars.confidential_email || '')
      .replace(/\{\{\s*vars\.confidential_link\s*\}\}/g, vars.confidential_link || '')
      .replace(/\{\{\s*vars\.privacy_agreement\.protocol_number\s*\}\}/g, vars.privacy_agreement?.protocol_number || '')
      .replace(/\{\{\s*vars\.privacy_agreement\.protocol_day_month_year\s*\}\}/g, vars.privacy_agreement?.protocol_day_month_year || '')
      .replace(/\{\{\s*coop\.short_name\s*\}\}/g, contacts?.full_name || '');
  };

  const replaceTranslations = (html: string): string => {
    let result = html;
    Object.entries(translation).forEach(([key, value]) => {
      const regex = new RegExp(`\\{\\%\\s*trans\\s*'${key}'\\s*\\%\\}`, 'g');
      result = result.replace(regex, value);
    });
    return result;
  };

  let html = privacyPolicyTemplate.context;
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
