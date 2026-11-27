<template lang="pug">
//- Инструкция издателя во всю ширину страницы. Шаг — строка из двух зон:
//- слева что делать и зачем, справа готовая команда с копированием. На узком
//- экране зоны встают одна под другой. Первая карточка — путь первого
//- выпуска, вторая — обновление, права ядра и сервер сборки.
.q-pa-md
  PageHint.q-mb-md(storage-key='developer:release-guide:hint-dismissed')
    | {{ $t('developer.guide.intro') }}

  BaseBanner.q-mb-md(v-if='!loading && !catalogUrl', variant='warn') {{ $t('developer.guide.noCatalog') }}

  BaseCard.q-mb-md
    .release-guide__step(v-for='(step, index) in firstRelease', :key='step.title')
      .release-guide__about
        .t-eyebrow {{ $t('developer.guide.stepLabel', { n: index + 1 }) }}
        .release-guide__title {{ step.title }}
        .release-guide__text {{ step.text }}
        BaseButton.q-mt-sm(v-if='step.route', variant='secondary', size='sm', @click='go(step.route)')
          | {{ step.routeLabel }}
      .release-guide__do(v-if='step.commands')
        DataRow(
          v-for='command in step.commands',
          :key='command.value',
          :label='command.label',
          :value='command.value',
          :hint='command.note',
          align='vertical',
          mono,
          copyable
        )

  BaseCard
    .release-guide__step(v-for='topic in afterRelease', :key='topic.title')
      .release-guide__about
        .release-guide__title {{ topic.title }}
        .release-guide__text {{ topic.text }}
      .release-guide__do
        DataRow(
          v-for='command in topic.commands ?? []',
          :key='command.value',
          :label='command.label',
          :value='command.value',
          :hint='command.note',
          align='vertical',
          mono,
          copyable
        )
        template(v-if='topic.code')
          .release-guide__code-label {{ topic.code.label }}
          pre.release-guide__code {{ topic.code.value }}
          .release-guide__code-note(v-if='topic.code.note') {{ topic.code.note }}
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { BaseBanner, BaseButton, BaseCard } from 'src/shared/ui/base';
import { DataRow, PageHint } from 'src/shared/ui/domain';
import { useSystemStore } from 'src/entities/System/model';
import { api as catalogApi } from '../features/CatalogAddress/api';
import { api as packagesApi } from '../features/MyPackages/api';
import { appNameOf, kitCreateCommand, kitPublishCommand } from '../shared/lib/kitCommands';
import { t } from '../i18n';

/**
 * «Выпуск из терминала»: путь приложения от регистрации пакета до каталога.
 * Каркас и выпуск — команды публичного набора `@coopenomics/app-kit` (npx);
 * стол подставляет в них пакет издателя и адрес каталога узла (487-37).
 * Регистрация, цена и ключ API — на страницах стола; выпуск в интерфейсе не
 * подаётся.
 */
interface GuideCommand {
  label: string;
  value: string;
  /** Пояснение под командой: чем она заканчивается. */
  note?: string;
}

interface GuideStep {
  title: string;
  text: string;
  commands?: GuideCommand[];
  /** Пример фрагмента файла: показывается блоком кода, не командой. */
  code?: GuideCommand;
  /** Страница стола, на которой выполняется шаг. */
  route?: string;
  routeLabel?: string;
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
  },
  {
    title: t('developer.guide.key.title'),
    text: t('developer.guide.key.text'),
    route: 'developer-api-keys',
    routeLabel: t('developer.install.apiKeys'),
  },
  {
    title: t('developer.guide.create.title'),
    text: t('developer.guide.create.text'),
    commands: [
      {
        label: t('developer.guide.commandLabel'),
        value: kitCreateCommand(packageId.value, t('developer.guide.appTitleSample'), catalogUrl.value),
        note: t('developer.guide.create.note', { name: appName.value }),
      },
    ],
  },
  {
    title: t('developer.guide.publish.title'),
    text: t('developer.guide.publish.text'),
    commands: [
      { label: t('developer.guide.folderLabel'), value: `cd ${appName.value}` },
      {
        label: t('developer.guide.commandLabel'),
        value: kitPublishCommand(),
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
    commands: [
      {
        label: t('developer.guide.commandLabel'),
        value: kitPublishCommand(t('developer.guide.update.briefSample')),
        note: t('developer.guide.update.note'),
      },
    ],
  },
  {
    title: t('developer.guide.rights.title'),
    text: t('developer.guide.rights.text'),
    code: {
      label: t('developer.guide.rights.manifestLabel'),
      value: [
        '"coopenomics": {',
        '  "ports": ["document", "accessToken"],',
        '  "chainActions": ["eosio::refund"]',
        '}',
      ].join('\n'),
      note: t('developer.guide.rights.note'),
    },
  },
  {
    title: t('developer.guide.ci.title'),
    text: t('developer.guide.ci.text'),
    commands: [
      {
        label: t('developer.guide.commandLabel'),
        value: `CATALOG_PUBLISHER_TOKEN=cpt_… ${kitPublishCommand()}`,
        note: t('developer.guide.ci.note'),
      },
    ],
  },
]);

function go(name: string) {
  void router.push({ name });
}

// realtime: нет источника — адрес каталога задаёт настройка узла, пакеты хранит внешний каталог приложений; страница читает их один раз при открытии.
onMounted(async () => {
  try {
    const [url, assignments] = await Promise.all([catalogApi.publicCatalogUrl(), packagesApi.myAssignments()]);
    catalogUrl.value = url;
    ownPackage.value = assignments[0]?.packageId ?? null;
  } catch {
    // Без адреса и пакетов инструкция показывает образец и предупреждение об адресе.
    catalogUrl.value = null;
  } finally {
    loading.value = false;
  }
});
</script>

<style scoped>
.release-guide__step {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
  gap: var(--p-6);
  align-items: start;
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
.release-guide__do {
  min-width: 0;
}
.release-guide__code-label {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
  margin-bottom: var(--p-1);
}
.release-guide__code {
  margin: 0;
  padding: var(--p-3) var(--p-4);
  font-family: var(--p-mono);
  font-size: var(--p-fs-body-sm);
  line-height: 1.6;
  color: var(--p-ink);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  white-space: pre;
  overflow-x: auto;
}
.release-guide__code-note {
  margin-top: var(--p-1);
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
}
/* Узкий экран: зоны шага одна под другой. */
@media (max-width: 1023px) {
  .release-guide__step {
    grid-template-columns: minmax(0, 1fr);
    gap: var(--p-3);
  }
}
</style>
