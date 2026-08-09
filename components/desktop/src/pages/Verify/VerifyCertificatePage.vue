<template lang="pug">
.verify
  .verify__head
    h1.verify__title Проверка удостоверения
    .verify__sub {{ coopTitle }}

  //- Камера. Разбор кода делает сам браузер: отдельной библиотеки распознавания
  //- нет намеренно — на устройстве проверяющего (киоск, планшет у входа) браузер
  //- это умеет, а тянуть в кабинет пайщика лишние сотни килобайт незачем.
  .verify__stage(v-if='!result')
    video.verify__video(v-show='scanning', ref='videoEl', playsinline, muted)
    .verify__placeholder(v-if='!scanning')
      q-icon(name='qr_code_scanner', size='64px')
      .verify__hint {{ hint }}
    BaseButton(v-if='!scanning', @click='startScan') Включить камеру

    //- Ручной ввод: без камеры (или где браузер не умеет разбирать код) проверку
    //- всё равно надо чем-то делать.
    .verify__manual
      BaseInput(v-model='manual', label='Или вставьте содержимое кода', type='textarea')
      BaseButton(variant='secondary', :disabled='!manual', @click='verify(manual)') Проверить

  //- Итог проверки: первым делом крупно — пускать или нет.
  .verify__result(v-else, :class='result.valid ? "verify__result--ok" : "verify__result--no"')
    q-icon(:name='result.valid ? "check_circle" : "cancel"', size='72px')
    .verify__verdict {{ result.valid ? 'Добро пожаловать' : 'Не подтверждено' }}
    .verify__name(v-if='result.name') {{ result.name }}
    .verify__meta(v-if='result.valid') {{ result.coop }} · действует до {{ result.until }}
    .verify__meta(v-else) {{ result.reason }}
    BaseButton(@click='reset') Проверить следующего
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { verifyOffline } from '@coopenomics/auth';
import { BaseButton, BaseInput } from 'src/shared/ui/base';
import { env } from 'src/shared/config';
import { useSystemStore } from 'src/entities/System/model';

/**
 * Считыватель удостоверений: проверяющий наводит камеру на код пайщика и сразу
 * видит, пускать или нет, и кого именно.
 *
 * Страница намеренно не выведена ни в одно меню — она для отдельного устройства на
 * входе, а не для кабинета. Ссылку знает тот, кто её открывает.
 *
 * Проверка — настоящая: подпись сходится против ключа заверения, прочитанного из
 * цепи, срок сверяется, цепь укореняется на кооперативе. Пока АНО не заведена,
 * якорем выступает сам кооператив — это слабее (цепь из одного звена подтверждает
 * сама себя), и потому кооператив называется явно, а не берётся из предъявленного
 * удостоверения.
 */
const system = useSystemStore();
const coopTitle = computed(() => system.cooperativeDisplayName || system.info.coopname || '');

const videoEl = ref<HTMLVideoElement | null>(null);
const scanning = ref(false);
const manual = ref('');
const hint = ref('Наведите камеру на код удостоверения');

interface VerifyView {
  valid: boolean;
  name?: string;
  coop?: string;
  until?: string;
  reason?: string;
}
const result = ref<VerifyView | null>(null);

let stream: MediaStream | null = null;
let timer: ReturnType<typeof setInterval> | null = null;

const REASONS: Record<string, string> = {
  expired: 'Срок удостоверения истёк',
  malformed_certificate: 'Код не является удостоверением пайщика',
  unsupported_alg: 'Удостоверение выпущено неизвестным способом',
  untrusted_anchor: 'Удостоверение выдано другим кооперативом',
  untrusted_issuer: 'Ключ заверения не совпал с опубликованным в цепи',
  invalid_signature: 'Подпись не сходится — удостоверение подделано или изменено',
  unsupported_schema_version: 'Удостоверение устаревшего образца',
};

async function startScan(): Promise<void> {
  const detector = barcodeDetector();
  if (!detector) {
    hint.value = 'Этот браузер не умеет читать коды — вставьте содержимое вручную';
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    hint.value = 'Камера недоступна — вставьте содержимое кода вручную';
    return;
  }
  scanning.value = true;
  if (videoEl.value) {
    videoEl.value.srcObject = stream;
    await videoEl.value.play().catch(() => undefined);
  }
  timer = setInterval(async () => {
    if (!videoEl.value) return;
    const codes = await detector.detect(videoEl.value).catch(() => []);
    const value = codes?.[0]?.rawValue;
    if (value) {
      stopScan();
      await verify(value);
    }
  }, 400);
}

function stopScan(): void {
  if (timer) clearInterval(timer);
  timer = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
  scanning.value = false;
}

function reset(): void {
  result.value = null;
  manual.value = '';
}

async function verify(jws: string): Promise<void> {
  const claims = decodeClaims(jws);
  if (!claims) {
    result.value = { valid: false, reason: REASONS.malformed_certificate };
    return;
  }

  // Ключи заверения берём из цепи, а не из предъявленного удостоверения: иначе
  // предъявитель сам себе и издатель, и проверка ничего не значит.
  const trustedKeys: Record<string, string> = {};
  for (const link of claims.coop_chain ?? []) {
    const key = await certKeyFromChain(link.account);
    if (key) trustedKeys[link.account] = key;
  }

  const anchorAccount = claims.coop_chain?.[0]?.account ?? '';
  const verdict = await verifyOffline(jws, {
    trustedKeys,
    trustAnchorAccount: anchorAccount,
    trustAnchor: trustedKeys[anchorAccount],
  });

  result.value = verdict.valid
    ? {
        valid: true,
        name: fullName(claims.identification),
        coop: claims.coopname,
        until: new Date(claims.exp * 1000).toLocaleString('ru-RU'),
      }
    : {
        valid: false,
        name: fullName(claims.identification),
        reason: REASONS[verdict.reason ?? ''] ?? 'Удостоверение не подтверждено',
      };
}

interface Claims {
  coopname: string;
  exp: number;
  coop_chain?: { account: string; public_key: string }[];
  identification?: Record<string, unknown> | null;
}

function decodeClaims(jws: string): Claims | null {
  try {
    const segment = jws.split('.')[1];
    if (!segment) return null;
    const bin = atob(segment.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes)) as Claims;
  } catch {
    return null;
  }
}

function fullName(identification?: Record<string, unknown> | null): string {
  if (!identification) return '';
  const parts = [identification.last_name, identification.first_name, identification.middle_name];
  return parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
}

/** Публичный ключ права заверения аккаунта прямо из цепи. */
async function certKeyFromChain(account: string): Promise<string | null> {
  try {
    const res = await fetch(`${env.CHAIN_URL}/v1/chain/get_account`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ account_name: account }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      permissions?: { perm_name?: string; required_auth?: { threshold?: number; keys?: { key?: string }[]; accounts?: unknown[]; waits?: unknown[] } }[];
    };
    const perm = data.permissions?.find((p) => p.perm_name === 'cert');
    const auth = perm?.required_auth;
    if (!auth || auth.threshold !== 1 || auth.keys?.length !== 1 || auth.accounts?.length || auth.waits?.length) return null;
    return auth.keys[0].key ?? null;
  } catch {
    return null;
  }
}

interface DetectedCode { rawValue?: string }
interface Detector { detect: (source: CanvasImageSource) => Promise<DetectedCode[]> }

/** Разбор кода средствами браузера; где его нет — остаётся ручной ввод. */
function barcodeDetector(): Detector | null {
  const ctor = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector;
  return ctor ? new ctor({ formats: ['qr_code'] }) : null;
}

onBeforeUnmount(stopScan);
</script>

<style scoped>
.verify {
  max-width: 560px;
  margin: 0 auto;
  padding: var(--p-6);
  display: flex;
  flex-direction: column;
  gap: var(--p-5);
}
.verify__title {
  font-size: var(--p-fs-h3, 24px);
  font-weight: 600;
  color: var(--p-ink);
  margin: 0;
}
.verify__sub {
  color: var(--p-ink-3);
}
.verify__stage {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--p-4);
}
.verify__video {
  width: 100%;
  border-radius: var(--p-r-lg);
  background: var(--p-surface-2);
}
.verify__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-8) var(--p-4);
  color: var(--p-ink-3);
  border: 1px dashed var(--p-line);
  border-radius: var(--p-r-lg);
  text-align: center;
}
.verify__manual {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
  padding-top: var(--p-4);
  border-top: 1px solid var(--p-line);
}
.verify__result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-3);
  padding: var(--p-8) var(--p-4);
  border-radius: var(--p-r-lg);
  text-align: center;
}
.verify__result--ok {
  background: var(--p-pos-soft);
  color: var(--p-pos);
}
.verify__result--no {
  background: var(--p-neg-soft);
  color: var(--p-neg);
}
.verify__verdict {
  font-size: var(--p-fs-h3, 24px);
  font-weight: 700;
}
.verify__name {
  font-size: var(--p-fs-h4, 20px);
  color: var(--p-ink);
}
.verify__meta {
  color: var(--p-ink-2);
}
</style>
