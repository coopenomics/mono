<template lang="pug">
//- Инструкция издателя: шаги идут сверху вниз в порядке работы, у каждого шага
//- одна мысль и готовая команда. Выпуск версии — только из терминала.
q-page(padding)
  .q-pa-md.release-guide
    BaseCard.q-mb-md(v-for='(step, index) in steps', :key='step.title')
      .release-guide__step
        .release-guide__number {{ index + 1 }}
        .release-guide__body
          .release-guide__title {{ step.title }}
          .release-guide__text {{ step.text }}
          CommandBlock.q-mt-sm(v-for='command in step.commands', :key='command', :command='command')
          .t-sm.t-muted.q-mt-sm(v-if='step.note') {{ step.note }}
          BaseButton.q-mt-sm(v-if='step.toPackages', variant='secondary', size='sm', @click='openPackages')
            | {{ $t('developer.guide.openPackages') }}
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { BaseButton, BaseCard } from 'src/shared/ui/base';
import { useSystemStore } from 'src/entities/System/model';
import CommandBlock from '../shared/ui/CommandBlock.vue';
import { t } from '../i18n';

/**
 * «Выпуск из терминала»: путь приложения от каркаса до каталога командами
 * набора издателя. Регистрация пакета, ключ и цена — на странице «Мои пакеты»;
 * сам выпуск в интерфейсе не подаётся.
 */
interface GuideStep {
  title: string;
  text: string;
  commands?: string[];
  note?: string;
  /** Шаг выполняется на странице «Мои пакеты». */
  toPackages?: boolean;
}

const router = useRouter();
const systemStore = useSystemStore();
/** Имя приложения в примерах команд. */
const SAMPLE = 'myapp';
const samplePackage = computed(() => `@${systemStore.info.coopname}/${SAMPLE}`);

const steps = computed<GuideStep[]>(() => [
  {
    title: t('developer.guide.kit.title'),
    text: t('developer.guide.kit.text'),
    note: t('developer.guide.kit.note'),
  },
  {
    title: t('developer.guide.create.title'),
    text: t('developer.guide.create.text'),
    commands: [`./create-app ${SAMPLE} "${t('developer.myPackages.appTitleSample')}"`],
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
    commands: [`./publish-app ${SAMPLE}`],
    note: t('developer.guide.publish.note', { packageId: samplePackage.value }),
  },
  {
    title: t('developer.guide.price.title'),
    text: t('developer.guide.price.text'),
    toPackages: true,
  },
  {
    title: t('developer.guide.update.title'),
    text: t('developer.guide.update.text'),
    commands: [`RELEASE_BRIEF="${t('developer.guide.update.briefSample')}" ./publish-app ${SAMPLE}`],
    note: t('developer.guide.update.note'),
  },
  {
    title: t('developer.guide.rights.title'),
    text: t('developer.guide.rights.text'),
    commands: ['"coopenomics": { "ports": ["document", "accessToken"], "chainActions": ["eosio::refund"] }'],
    note: t('developer.guide.rights.note'),
  },
]);

function openPackages() {
  void router.push({ name: 'developer-my-packages' });
}
</script>

<style scoped>
.release-guide {
  max-width: 860px;
}
.release-guide__step {
  display: flex;
  gap: var(--p-4);
}
.release-guide__number {
  flex: none;
  width: var(--p-7);
  height: var(--p-7);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--p-r-pill);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-weight: 600;
}
.release-guide__body {
  flex: 1;
  min-width: 0;
}
.release-guide__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  margin-bottom: var(--p-1);
}
.release-guide__text {
  color: var(--p-ink-2);
}
@media (max-width: 600px) {
  .release-guide__step {
    gap: var(--p-3);
  }
}
</style>
