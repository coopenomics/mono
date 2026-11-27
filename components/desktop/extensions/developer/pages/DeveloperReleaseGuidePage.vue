<template lang="pug">
//- Инструкция издателя: одна карточка — путь первого выпуска по шагам, вторая
//- — что делать после него. У шага одна мысль и готовая команда с копированием.
.q-pa-md.release-guide
  BaseCard.q-mb-md
    .release-guide__step(v-for='(step, index) in firstRelease', :key='step.title')
      .t-eyebrow {{ $t('developer.guide.stepLabel', { n: index + 1 }) }}
      .release-guide__title {{ step.title }}
      .release-guide__text {{ step.text }}
      DataRow(
        v-if='step.command',
        :label="$t('developer.guide.commandLabel')",
        :value='step.command',
        :hint='step.note',
        align='vertical',
        mono,
        copyable
      )
      BaseButton.q-mt-sm(v-if='step.toPackages', variant='secondary', size='sm', @click='openPackages')
        | {{ $t('developer.guide.openPackages') }}

  BaseCard
    .release-guide__step(v-for='topic in afterRelease', :key='topic.title')
      .release-guide__title {{ topic.title }}
      .release-guide__text {{ topic.text }}
      DataRow(
        v-if='topic.command',
        :label='topic.commandLabel',
        :value='topic.command',
        :hint='topic.note',
        align='vertical',
        mono,
        copyable
      )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { DataRow } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { t } from '../i18n';

/**
 * «Выпуск из терминала»: путь приложения от каркаса до каталога командами
 * набора издателя. Регистрация пакета, ключ и цена — на странице «Мои пакеты»;
 * сам выпуск в интерфейсе не подаётся.
 */
interface GuideStep {
  title: string;
  text: string;
  command?: string;
  commandLabel?: string;
  /** Пояснение под командой: чем она заканчивается. */
  note?: string;
  /** Шаг выполняется на странице «Мои пакеты». */
  toPackages?: boolean;
}

const router = useRouter();
const systemStore = useSystemStore();
/** Имя приложения в примерах команд. */
const SAMPLE = 'myapp';
const samplePackage = computed(() => `@${systemStore.info.coopname}/${SAMPLE}`);

const firstRelease = computed<GuideStep[]>(() => [
  { title: t('developer.guide.kit.title'), text: t('developer.guide.kit.text') },
  {
    title: t('developer.guide.create.title'),
    text: t('developer.guide.create.text'),
    command: `./create-app ${SAMPLE} "${t('developer.guide.appTitleSample')}"`,
    note: t('developer.guide.create.note'),
  },
  {
    title: t('developer.guide.register.title'),
    text: t('developer.guide.register.text', { packageId: samplePackage.value }),
    toPackages: true,
  },
  {
    title: t('developer.guide.publish.title'),
    text: t('developer.guide.publish.text'),
    command: `./publish-app ${SAMPLE}`,
    note: t('developer.guide.publish.note', { packageId: samplePackage.value }),
  },
  { title: t('developer.guide.price.title'), text: t('developer.guide.price.text'), toPackages: true },
]);

const afterRelease = computed<GuideStep[]>(() => [
  {
    title: t('developer.guide.update.title'),
    text: t('developer.guide.update.text'),
    command: `RELEASE_BRIEF="${t('developer.guide.update.briefSample')}" ./publish-app ${SAMPLE}`,
    commandLabel: t('developer.guide.commandLabel'),
    note: t('developer.guide.update.note'),
  },
  {
    title: t('developer.guide.rights.title'),
    text: t('developer.guide.rights.text'),
    command: '"coopenomics": { "ports": ["document", "accessToken"], "chainActions": ["eosio::refund"] }',
    commandLabel: t('developer.guide.rights.manifestLabel'),
    note: t('developer.guide.rights.note'),
  },
]);

function openPackages() {
  void router.push({ name: 'developer-my-packages' });
}
</script>

<style scoped>
.release-guide {
  max-width: 760px;
}
.release-guide__step + .release-guide__step {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.release-guide__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
  margin-top: var(--p-1);
}
.release-guide__text {
  margin-top: var(--p-1);
  color: var(--p-ink-2);
}
</style>
