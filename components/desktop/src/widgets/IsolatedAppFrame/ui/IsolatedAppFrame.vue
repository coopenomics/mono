<template lang="pug">
//- Изолированная рамка приложения каталога (487-18). Код приложения стол не
//- выполняет: он живёт в рамке с отдельным происхождением (sandbox без
//- allow-same-origin) и общается со столом командами моста.
q-page.isolated-frame
  //- Каркас загрузки стоит, пока браузер не отрисовал страницу приложения.
  CardListSkeleton.isolated-frame__skeleton(v-if='!loaded')
  iframe.isolated-frame__view(
    ref='frameEl',
    :class="{ 'isolated-frame__view--pending': !loaded }",
    sandbox='allow-scripts',
    referrerpolicy='no-referrer',
    :srcdoc='framedHtml',
    :title="$t('isolatedApp.frameTitle', { app: title })",
    @load='loaded = true'
  )

  //- Окно подписи рисует стол: текст документа получен от ядра, показан в
  //- рамке без сценариев, ключ пайщика приложению не передаётся.
  BaseDialog(v-model='signDialog', :title="$t('isolatedApp.sign.title')", size='lg')
    p.t-sm.t-muted.q-mb-sm {{ $t('isolatedApp.sign.intro', { app: title }) }}
    .isolated-frame__doc-title.q-mb-sm {{ pendingDocument?.full_title }}
    iframe.isolated-frame__doc(
      v-if='pendingDocument',
      sandbox='',
      referrerpolicy='no-referrer',
      :srcdoc='pendingDocument.html',
      :title="$t('isolatedApp.sign.title')"
    )
    BaseBanner.q-mt-sm(v-if='signError', variant='neg') {{ signError }}
    template(#footer)
      BaseButton(variant='ghost', :disabled='signing', @click='signDialog = false') {{ $t('common.action.cancel') }}
      BaseButton(variant='primary', :loading='signing', @click='confirmSign') {{ $t('isolatedApp.sign.confirm') }}
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import axios from 'axios';
import { BaseBanner, BaseButton, BaseDialog, CardListSkeleton } from 'src/shared/ui/base';
import { env } from 'src/shared/config';
import { resolveAccessToken } from 'src/shared/api/access-token';
import { signDocument, type ZGeneratedDocument } from 'src/shared/lib/document/model/entity';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
import { BRIDGE_MARK, packageCoords, parseBridgeRequest, withFramePolicy, type BridgeRequest } from '../model/bridge';

const props = defineProps<{
  /** Пакет каталога, `@scope/name`. */
  packageId: string;
  /** Название приложения для заголовков. */
  title: string;
  /** Страница приложения — HTML из проверенного по хэшу пакета. */
  html: string;
}>();

/** Запас до истечения токена приложения, мс: с почти истёкшим токеном стол запрос не отправляет. */
const APP_TOKEN_MARGIN_MS = 30_000;

/** Токены оформления стола, которые рамка получает для своей вёрстки. */
const THEME_TOKENS = [
  '--p-canvas', '--p-surface', '--p-surface-2', '--p-ink', '--p-ink-2', '--p-ink-3',
  '--p-line', '--p-primary', '--p-primary-soft', '--p-pos', '--p-neg', '--p-warn',
] as const;

const session = useSessionStore();
const system = useSystemStore();

const frameEl = ref<HTMLIFrameElement | null>(null);
/** Страница приложения отрисована — каркас загрузки снимается. */
const loaded = ref(false);

// ── Токен приложения ─────────────────────────────────────────────────────
let appToken: { value: string; expiresAt: number } | null = null;

/** Токен пайщика для бэкенда этого приложения; в рамку он не передаётся. */
async function ensureAppToken(): Promise<string> {
  if (appToken && Date.now() + APP_TOKEN_MARGIN_MS < appToken.expiresAt) return appToken.value;
  const coords = packageCoords(props.packageId);
  const memberToken = await resolveAccessToken();
  if (!coords || !memberToken) throw new Error(t('isolatedApp.error.noSession'));
  try {
    const res = await axios.post<{ token: string; expires_at: string }>(
      `${env.BACKEND_URL}/v1/apps-catalog/app-session/${encodeURIComponent(coords.scope)}/${encodeURIComponent(coords.name)}`,
      {},
      { headers: { Authorization: `Bearer ${memberToken}` } },
    );
    appToken = { value: res.data.token, expiresAt: new Date(res.data.expires_at).getTime() };
    return appToken.value;
  } catch {
    throw new Error(t('isolatedApp.error.sessionFailed'));
  }
}

// ── Команды моста ────────────────────────────────────────────────────────
function themeForFrame(): { mode: string; tokens: Record<string, string> } {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const tokens: Record<string, string> = {};
  for (const name of THEME_TOKENS) tokens[name] = style.getPropertyValue(name).trim();
  return { mode: root.getAttribute('data-theme') ?? 'light', tokens };
}

/**
 * Страница приложения с политикой рамки (сети у неё нет, только мост) и
 * токенами оформления стола: первый кадр страницы уже в теме стола.
 */
const framedHtml = computed(() => withFramePolicy(props.html, themeForFrame().tokens));

async function runGraphql(params: Record<string, unknown>): Promise<unknown> {
  const token = await ensureAppToken();
  try {
    const res = await axios.post(
      `${env.BACKEND_URL}/v1/graphql`,
      { query: params.query, variables: params.variables },
      { headers: { Authorization: `Bearer ${token}` } },
    );
    return res.data;
  } catch {
    throw new Error(t('isolatedApp.error.requestFailed'));
  }
}

// ── Подпись документа ────────────────────────────────────────────────────
const signDialog = ref(false);
const signing = ref(false);
const signError = ref('');
// Документ хранится без глубокой реактивности: подписи нужен исходный объект ядра.
const pendingDocument = shallowRef<ZGeneratedDocument | null>(null);
let pendingSign: { resolve: (value: unknown) => void; reject: (reason: Error) => void } | null = null;

/** Документ для показа и подписи стол берёт у ядра по хэшу, не у приложения. */
async function requestSign(params: Record<string, unknown>): Promise<unknown> {
  const memberToken = await resolveAccessToken();
  if (!memberToken) throw new Error(t('isolatedApp.error.noSession'));
  let document: ZGeneratedDocument;
  try {
    const res = await axios.get<ZGeneratedDocument>(
      `${env.BACKEND_URL}/v1/apps-catalog/app-document/${encodeURIComponent(String(params.hash))}`,
      { headers: { Authorization: `Bearer ${memberToken}` } },
    );
    document = res.data;
  } catch {
    throw new Error(t('isolatedApp.sign.loadFailed'));
  }
  // Одно окно подписи за раз: новый запрос отклоняет прежний.
  rejectSign();
  pendingDocument.value = document;
  signError.value = '';
  signDialog.value = true;
  return new Promise((resolve, reject) => {
    pendingSign = { resolve, reject };
  });
}

async function confirmSign() {
  if (!pendingDocument.value || !pendingSign) return;
  signing.value = true;
  signError.value = '';
  try {
    const signed = await signDocument(pendingDocument.value, session.username);
    const done = pendingSign;
    pendingSign = null;
    signDialog.value = false;
    done.resolve(signed);
  } catch (e) {
    signError.value = e instanceof Error ? e.message : t('isolatedApp.sign.failed');
  } finally {
    signing.value = false;
  }
}

/** Окно закрыто без подписи — приложение получает отказ пайщика. */
function rejectSign() {
  if (!pendingSign) return;
  const refused = pendingSign;
  pendingSign = null;
  pendingDocument.value = null;
  refused.reject(new Error(t('isolatedApp.sign.rejected')));
}

// Окно закрыто любым способом без подписи (кнопка, фон, Escape) — это отказ.
watch(signDialog, (open) => {
  if (!open) rejectSign();
});

async function execute(request: BridgeRequest): Promise<unknown> {
  if (request.method === 'init') {
    return { packageId: props.packageId, username: session.username, coopname: system.info.coopname, theme: themeForFrame() };
  }
  if (request.method === 'graphql') return runGraphql(request.params);
  return requestSign(request.params);
}

/** Ответ рамке. Происхождение рамки непрозрачное, поэтому адресат — `*`; секретов в ответах нет. */
function reply(id: string | number, payload: { result: unknown } | { error: { message: string } }) {
  // Рамке передаются только данные: копия через JSON отбрасывает реактивные
  // обёртки и объекты классов, которые сообщением окну не передаются.
  const data = JSON.parse(JSON.stringify({ coopBridge: BRIDGE_MARK, id, ...payload })) as unknown;
  frameEl.value?.contentWindow?.postMessage(data, '*');
}

async function onMessage(event: MessageEvent) {
  // Только своя рамка: сообщения других окон и рамок не исполняются.
  if (!frameEl.value || event.source !== frameEl.value.contentWindow) return;
  const request = parseBridgeRequest(event.data);
  if ('refusal' in request) {
    if (request.refusal === 'notBridge' || request.id === undefined) return;
    const message =
      request.refusal === 'unknownMethod'
        ? t('isolatedApp.error.unknownMethod', { method: request.method ?? '' })
        : t('isolatedApp.error.badRequest');
    reply(request.id, { error: { message } });
    return;
  }
  try {
    reply(request.id, { result: await execute(request) });
  } catch (e) {
    reply(request.id, { error: { message: e instanceof Error ? e.message : String(e) } });
  }
}

onMounted(() => window.addEventListener('message', onMessage));
onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage);
  rejectSign();
});
</script>

<style scoped>
.isolated-frame {
  display: flex;
  flex-direction: column;
  padding: 0;
}

.isolated-frame__skeleton {
  padding: var(--p-6);
}

/* Рамка грузится скрытой и без места в потоке: каркас стоит на её месте. */
.isolated-frame__view--pending {
  position: absolute;
  visibility: hidden;
}

.isolated-frame__view {
  flex: 1 1 auto;
  width: 100%;
  min-height: calc(100vh - var(--p-10) - var(--p-8));
  border: 0;
  background: var(--p-canvas);
}

.isolated-frame__doc-title {
  font-size: var(--p-fs-h3);
  font-weight: 600;
}

.isolated-frame__doc {
  width: 100%;
  height: 55vh;
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md);
  background: var(--p-surface);
}
</style>
