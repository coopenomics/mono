<template lang="pug">
.verify
  .verify__head
    h1.verify__title {{ $t('verification.verifyCertificatePage.title') }}
    .verify__sub {{ coopTitle }}

  //- Камера. Разбор кода делает сам браузер: отдельной библиотеки распознавания
  //- нет намеренно — на устройстве проверяющего (киоск, планшет у входа) браузер
  //- это умеет, а тянуть в кабинет пайщика лишние сотни килобайт незачем.
  .verify__stage(v-if='!result')
    video.verify__video(v-show='scanning', ref='videoEl', playsinline, muted)
    .verify__placeholder(v-if='!scanning')
      q-icon(name='qr_code_scanner', size='64px')
      .verify__hint {{ hint }}
    BaseButton(v-if='!scanning', @click='startScan') {{ $t('verification.verifyCertificatePage.enableCamera') }}

    //- Ручной ввод: без камеры (или где браузер не умеет разбирать код) проверку
    //- всё равно надо чем-то делать.
    .verify__manual
      BaseInput(v-model='manual', :label='$t("verification.verifyCertificatePage.pasteLabel")', type='textarea')
      BaseButton(variant='secondary', :disabled='!manual', @click='verify(manual)') {{ $t('verification.verifyCertificatePage.submit') }}

  //- Итог проверки: первым делом крупно — пускать или нет.
  .verify__result(v-else, :class='result.valid ? "verify__result--ok" : "verify__result--no"')
    q-icon(:name='result.valid ? "check_circle" : "cancel"', size='72px')
    .verify__verdict {{ result.valid ? $t('verification.verifyCertificatePage.welcome') : $t('verification.verifyCertificatePage.notConfirmed') }}
    .verify__name(v-if='result.name') {{ result.name }}
    .verify__meta(v-if='result.valid') {{ $t('verification.verifyCertificatePage.resultLine', { coop: result.coop, until: result.until }) }}
    .verify__meta(v-else) {{ result.reason }}
    BaseButton(@click='reset') {{ $t('verification.verifyCertificatePage.checkNext') }}
</template>

<script lang="ts" setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { uiLocale, t as i18nT } from 'src/shared/i18n';
import { TRUST_ANCHOR_ANO_CERT_PUBKEY, verifyOffline } from '@coopenomics/auth';
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
 * Принимает удостоверение любого кооператива. Раньше принимались только свои, и это
 * было не выбором, а вынужденной мерой: цепочка в удостоверении перечисляла имена и
 * ключи, ключи читались из блокчейна по этим именам, и любой кооператив мог
 * поставить корень первым звеном своей цепи — ключи-то настоящие. Теперь цепочка
 * несёт подписи, корень вшит в приложение, и чужое удостоверение проверяется так же
 * строго, как своё.
 *
 * Сети при проверке не требуется вовсе. Устройство на входе может стоять там, где
 * её нет, и ответ всё равно должен быть здесь и сейчас.
 */
const system = useSystemStore();
const coopTitle = computed(() => system.cooperativeDisplayName || system.info.coopname || '');

const videoEl = ref<HTMLVideoElement | null>(null);
const scanning = ref(false);
const manual = ref('');
const hint = ref(i18nT('verification.verifyCertificatePage.scanHint'));

interface VerifyView {
  valid: boolean;
  name?: string;
  coop?: string;
  until?: string;
  reason?: string;
}
const result = ref<VerifyView | null>(null);

let stream: MediaStream | null = null;
// realtime: нет источника — проверка удостоверения идёт офлайн по подписи и корню доверия, с сервера страница ничего не читает.
let timer: ReturnType<typeof setInterval> | null = null;

const REASONS: Record<string, string> = {
  expired: i18nT('verification.verifyCertificatePage.expiredError'),
  malformed_certificate: i18nT('verification.verifyCertificatePage.notCertificateError'),
  unsupported_alg: i18nT('verification.verifyCertificatePage.unknownMethodError'),
  no_trust_anchor: i18nT('verification.verifyCertificatePage.noRootKeyError'),
  not_endorsed: i18nT('verification.verifyCertificatePage.coopNotConfirmedError'),
  broken_chain: i18nT('verification.verifyCertificatePage.chainBrokenError'),
  endorsement_expired: i18nT('verification.verifyCertificatePage.coopConfirmationExpiredError'),
  endorsement_invalid: i18nT('verification.verifyCertificatePage.chainForgedError'),
  foreign_chain: i18nT('verification.verifyCertificatePage.wrongNetworkError'),
  issuer_mismatch: i18nT('verification.verifyCertificatePage.issuerMismatchError'),
  signature_mismatch: i18nT('verification.verifyCertificatePage.signatureMismatchError'),
  unsupported_schema_version: i18nT('verification.verifyCertificatePage.legacyFormatError'),
};

async function startScan(): Promise<void> {
  const detector = barcodeDetector();
  if (!detector) {
    hint.value = i18nT('verification.verifyCertificatePage.browserUnsupportedError');
    return;
  }
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch {
    hint.value = i18nT('verification.verifyCertificatePage.cameraUnavailableError');
    return;
  }
  scanning.value = true;
  if (videoEl.value) {
    videoEl.value.srcObject = stream;
    await videoEl.value.play().catch(() => undefined);
  }
  // timing: schedule — кадры камеры разбираются на QR несколько раз в секунду, пока идёт сканирование
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

  // Корень доверия — из настроек установки, иначе вшитый в пакет. Из предъявленного
  // удостоверения он не берётся никогда: тогда предъявитель сам назначал бы, чем его
  // проверяют.
  const trustAnchor = env.COOPID_TRUST_ANCHOR_KEY || TRUST_ANCHOR_ANO_CERT_PUBKEY || undefined;

  const verdict = await verifyOffline(jws, {
    trustAnchor,
    // Сеть сверяется, чтобы признание из испытательной сети не действовало в боевой.
    chainId: env.CHAIN_ID || undefined,
  });

  result.value = verdict.valid
    ? {
        valid: true,
        name: fullName(claims.identification),
        coop: verdict.chain?.join(' → ') ?? claims.coopname,
        until: new Date(claims.exp * 1000).toLocaleString(uiLocale()),
      }
    : {
        valid: false,
        name: fullName(claims.identification),
        reason: REASONS[verdict.reason ?? ''] ?? i18nT('verification.verifyCertificatePage.notConfirmedError'),
      };
}

interface Claims {
  coopname: string;
  exp: number;
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
