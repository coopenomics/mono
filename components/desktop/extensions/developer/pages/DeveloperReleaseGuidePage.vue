<template lang="pug">
//- Справка издателя во всю ширину страницы. Шаг — строка из двух зон: слева
//- номер, заголовок и одна-две фразы, справа действие — кнопка страницы стола
//- либо команда в блоке кода. На узком экране зоны встают одна под другой.
.q-pa-md
  PageHint.q-mb-md(storage-key='developer:release-guide:hint-dismissed')
    | {{ $t('developer.guide.intro') }}

  BaseBanner.q-mb-md(v-if='!loading && !catalogUrl', variant='warn') {{ $t('developer.guide.noCatalog') }}

  BaseCard.q-mb-md
    .release-guide__step(v-for='(step, index) in firstRelease', :key='step.title')
      .release-guide__about
        .release-guide__num {{ index + 1 }}
        div
          .release-guide__title {{ step.title }}
          .release-guide__text {{ step.text }}
      .release-guide__do
        BaseButton(v-if='step.route', variant='secondary', @click='go(step.route)')
          template(#icon-left)
            q-icon(:name='step.routeIcon', size='18px')
          | {{ step.routeLabel }}
        CodeBlock(v-for='block in step.blocks ?? []', :key='block.value', v-bind='block')

  .t-eyebrow.q-mb-sm {{ $t('developer.guide.afterTitle') }}
  BaseCard
    .release-guide__step(v-for='topic in afterRelease', :key='topic.title')
      .release-guide__about
        div
          .release-guide__title {{ topic.title }}
          .release-guide__text {{ topic.text }}
      .release-guide__do
        CodeBlock(v-for='block in topic.blocks ?? []', :key='block.value', v-bind='block')
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base';
import { CodeBlock, PageHint, type CodeBlockProps } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { APPS_CATALOG_LIVE, useLiveReload } from 'src/shared/lib/realtime';
import { api as catalogApi } from '../features/CatalogAddress/api';
import { api as packagesApi } from '../features/MyPackages/api';
import { appNameOf, kitCreateCommand, kitPublishCommand } from '../shared/lib/kitCommands';
import { t } from '../i18n';

/**
 * «Справка»: путь приложения от регистрации пакета до каталога. Каркас и
 * выпуск — команды набора `@coopenomics/app-kit`; стол подставляет в них пакет
 * издателя и адрес каталога узла (487-37). Пакет, цену и ключ API задают
 * страницы стола.
 */
interface GuideStep {
  title: string;
  text: string;
  blocks?: CodeBlockProps[];
  /** Страница стола, на которой выполняется шаг. */
  route?: string;
  routeLabel?: string;
  routeIcon?: string;
}

/** Имя приложения в примерах, пока у издателя нет своих пакетов. */
const SAMPLE = 'myapp';

const router = useRouter();
const systemStore = useSystemStore();
const catalogUrl = ref<string | null>(null);
const ownPackage = ref<string | null>(null);
// Признак включён с самого начала: предупреждение об адресе не мигает до загрузки.
const loading = ref(true);

/** Пакет в командах: свой пакет издателя либо образец в пространстве кооператива. */
const packageId = computed(() => ownPackage.value ?? `@${systemStore.info.coopname}/${SAMPLE}`);
const appName = computed(() => appNameOf(packageId.value));

const firstRelease = computed<GuideStep[]>(() => [
  {
    title: t('developer.guide.register.title'),
    text: t('developer.guide.register.text'),
    route: 'developer-my-packages',
    routeLabel: t('developer.install.myPackages'),
    routeIcon: 'inventory_2',
  },
  {
    title: t('developer.guide.key.title'),
    text: t('developer.guide.key.text'),
    route: 'developer-api-keys',
    routeLabel: t('developer.install.apiKeys'),
    routeIcon: 'key',
  },
  {
    title: t('developer.guide.create.title'),
    text: t('developer.guide.create.text'),
    blocks: [
      {
        value: kitCreateCommand(packageId.value, t('developer.guide.appTitleSample'), catalogUrl.value),
        note: t('developer.guide.create.note', { name: appName.value }),
      },
    ],
  },
  {
    title: t('developer.guide.publish.title'),
    text: t('developer.guide.publish.text'),
    blocks: [
      {
        value: `cd ${appName.value}\n${kitPublishCommand()}`,
        note: t('developer.guide.publish.note', { packageId: packageId.value }),
      },
    ],
  },
  { title: t('developer.guide.moderation.title'), text: t('developer.guide.moderation.text') },
]);

const afterRelease = computed<GuideStep[]>(() => [
  {
    title: t('developer.guide.update.title'),
    text: t('developer.guide.update.text'),
    blocks: [{ value: kitPublishCommand(t('developer.guide.update.briefSample')), note: t('developer.guide.update.note') }],
  },
  {
    title: t('developer.guide.rights.title'),
    text: t('developer.guide.rights.text'),
    blocks: [
      {
        label: t('developer.guide.rights.manifestLabel'),
        value: [
          '"coopenomics": {',
          '  "ports": ["document", "accessToken"],',
          '  "chainActions": ["eosio::refund"]',
          '}',
        ].join('\n'),
        note: t('developer.guide.rights.note'),
        copyable: false,
      },
    ],
  },
  {
    title: t('developer.guide.ci.title'),
    text: t('developer.guide.ci.text'),
    blocks: [{ value: `CATALOG_PUBLISHER_TOKEN=cpt_… ${kitPublishCommand()}` }],
  },
]);

function go(name: string) {
  void router.push({ name });
}

async function load(): Promise<void> {
  try {
    const [url, assignments] = await Promise.all([catalogApi.publicCatalogUrl(), packagesApi.myAssignments()]);
    catalogUrl.value = url;
    ownPackage.value = assignments[0]?.packageId ?? null;
  } catch {
    // Без адреса и пакетов справка показывает образец и предупреждение об адресе.
    catalogUrl.value = null;
  } finally {
    loading.value = false;
  }
}

// Живое обновление по ленте узла: зарегистрированный пакет подставляется в команды сразу.
useLiveReload([APPS_CATALOG_LIVE.publishers], load);
onMounted(load);
</script>

<style scoped>
.release-guide__step {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 3fr);
  gap: var(--p-6);
  align-items: start;
}
.release-guide__step + .release-guide__step {
  margin-top: var(--p-5);
  padding-top: var(--p-5);
  border-top: 1px solid var(--p-line);
}
.release-guide__about {
  display: flex;
  gap: var(--p-3);
  align-items: flex-start;
}
.release-guide__num {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--p-7);
  height: var(--p-7);
  border-radius: var(--p-r-pill);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.release-guide__title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
  line-height: var(--p-lh-h3);
}
.release-guide__text {
  margin-top: var(--p-1);
  color: var(--p-ink-2);
}
.release-guide__do {
  min-width: 0;
}
/* Узкий экран: зоны шага одна под другой. */
@media (max-width: 1023px) {
  .release-guide__step {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-3);
  }
}
</style>
