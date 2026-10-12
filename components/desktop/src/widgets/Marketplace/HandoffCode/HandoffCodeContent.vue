<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { Zeus } from '@coopenomics/sdk';
import { useSessionStore } from 'src/entities/Session';
import { loadHandoffCode } from 'src/entities/MarketplaceHandoff';
import { HandoffQr } from 'src/widgets/Marketplace/HandoffQr';
import { BaseBanner, EmptyState } from 'src/shared/ui/base';
import { FailAlert } from 'src/shared/api';
import { HandoffTokenKind } from 'src/shared/lib/marketplace';
import { participantVerificationView } from 'src/shared/lib/verification';
import { HANDOFF_CODE_COPY, type AccountHandoffKind } from './copy';

/**
 * Содержимое экрана кода передачи пайщика — QR-код плюс пояснение. Единый
 * источник на оба стола и все точки показа:
 *  - заказчик (`kind=receive`): страница меню «Показать QR», диалог из шапки
 *    «Моих заказов» и детали заказа, карточка заявления на возврат;
 *  - поставщик (`kind=pickup`): страница меню «Показать QR».
 *
 * Код отдаёт сервер (`marketplaceHandoffCode`, 598-62): случайный, живёт
 * сутки. Стол его не собирает; по истечении срока экран сам запрашивает
 * новый код.
 */

const props = withDefaults(
  defineProps<{
    coopname: string;
    kind: AccountHandoffKind;
    size?: number;
  }>(),
  { size: 320 },
);

const session = useSessionStore();

const copy = computed(() => HANDOFF_CODE_COPY[props.kind]);

// Верификация личности (105-28): без базового уровня (паспорт на КУ) оператор
// не откроет выдачу. Предупреждаем заранее — пайщик берёт паспорт с собой;
// после первой верификации предупреждение исчезает навсегда.
const needsPassportWarning = computed(() => {
  if (props.kind !== HandoffTokenKind.Receive) return false;
  const levels = participantVerificationView({
    participant_account: session.participantAccount,
    user_account: session.userAccount,
  });
  return !levels.some((level) => level.type === 'passport_onsite');
});

const code = ref('');
const expiresAt = ref<Date | null>(null);
const loading = ref(true);

let renewTimer: ReturnType<typeof setTimeout> | null = null;

function clearRenew(): void {
  if (renewTimer) clearTimeout(renewTimer);
  renewTimer = null;
}

/** По истечении срока запросить новый код — экран пайщика живёт сутками в кармане. */
function scheduleRenew(at: Date | null): void {
  clearRenew();
  if (!at || typeof window === 'undefined') return;
  const delay = Math.max(at.getTime() - Date.now(), 1000);
  // timing: schedule — перевыпуск кода точно по истечении его срока действия
  renewTimer = setTimeout(() => void load(), delay);
}

async function load(): Promise<void> {
  if (!session.username) {
    code.value = '';
    expiresAt.value = null;
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const result = await loadHandoffCode({
      kind:
        props.kind === HandoffTokenKind.Pickup
          ? Zeus.MarketplaceHandoffCodeKind.PICKUP
          : Zeus.MarketplaceHandoffCodeKind.RECEIVE,
    });
    code.value = result.code;
    expiresAt.value = result.expires_at ? new Date(String(result.expires_at)) : null;
    scheduleRenew(expiresAt.value);
  } catch (e) {
    code.value = '';
    expiresAt.value = null;
    FailAlert(e);
  } finally {
    loading.value = false;
  }
}

// realtime: нет источника — код выдаёт сервер по запросу; новый код запрашивается по истечении срока действия
watch(() => [props.kind, session.username], () => void load());
onMounted(load);
onBeforeUnmount(clearRenew);
</script>

<template lang="pug">
.handoff-code(v-if="loading")
  q-skeleton(type="rect", :width="`${size}px`", :height="`${size}px`")
.handoff-code(v-else-if="code")
  BaseBanner(v-if="needsPassportWarning", variant="warn")
    | {{ $t('marketplace.handoffCodeContent.passportHint1') }}
    | {{ $t('marketplace.handoffCodeContent.passportHint2') }}
    | {{ $t('marketplace.handoffCodeContent.passportHint3') }}
  HandoffQr(:value="code", :size="size", :caption="copy.caption")
  .handoff-code__until(v-if="expiresAt") {{ $t('marketplace.handoffCodeContent.validUntil') }}
EmptyState(
  v-else,
  :title="$t('marketplace.handoffCodeContent.codeUnavailableTitle')",
  :body="copy.emptyBody"
)
  template(#icon)
    q-icon(name="qr_code_2", size="48px")
</template>

<style scoped lang="scss">
.handoff-code {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-4, 16px);
  max-width: 480px;
  margin: 0 auto;
  text-align: center;

  &__until {
    font-size: var(--p-fs-body-sm);
    color: var(--p-ink-3);
  }
}
</style>
