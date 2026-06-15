<template lang="pug">
BaseCard(
  title='Активные сессии и устройства',
  subtitle='Где выполнен вход в ваш кабинет. Незнакомую сессию можно завершить.'
)
  //- Скелетон первой загрузки (без спиннера-оверлея — канон).
  .sessions__skel(v-if='loading && !sessions.length')
    .sessions__skel-row(v-for='n in 2', :key='n')

  template(v-else)
    .sessions(v-if='sessions.length')
      .session-row(v-for='s in sessions', :key='s.id')
        q-icon.session-row__ico(:name='deviceIcon(s.device)', size='22px')
        .session-row__info
          .session-row__head
            span.session-row__device {{ deviceLabel(s.device) }}
            BaseChip(v-if='s.current', variant='pos') Текущая
          .session-row__meta {{ metaLine(s) }}
        BaseButton(
          v-if='!s.current',
          variant='ghost',
          size='sm',
          :loading='busyId === s.id',
          @click='onRevoke(s.id)'
        ) Завершить

      //- Массовое завершение — только если есть что завершать кроме текущей.
      .sessions__foot(v-if='hasOthers')
        BaseButton(
          variant='danger',
          :loading='revokingAll',
          @click='confirmAll = true'
        )
          template(#icon-left)
            q-icon(name='logout', size='18px')
          | Завершить все остальные

    EmptyState(
      v-else,
      title='Активных сессий нет',
      body='Здесь появятся устройства, с которых вы вошли в кабинет.'
    )
      template(#icon)
        q-icon(name='devices', size='32px')

  BaseDialog(
    v-model='confirmAll',
    title='Завершить все остальные сессии?',
    size='sm'
  )
    p.sessions__confirm Все устройства, кроме текущего, будут разлогинены. Это безопасно, если вы заметили незнакомый вход.
    template(#footer)
      BaseButton(variant='secondary', @click='confirmAll = false') Отмена
      BaseButton(variant='danger', :loading='revokingAll', @click='onRevokeAll') Завершить все
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';
import { BaseButton, BaseCard, BaseChip, BaseDialog, EmptyState } from 'src/shared/ui/base';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { formatToFromNow } from 'src/shared/lib/utils/dates/formatToFromNow';
import { type IAccountSession, useManageSessions } from '../model';

const { sessions, loading, load, revoke, revokeAllOthers } = useManageSessions();

const busyId = ref('');
const revokingAll = ref(false);
const confirmAll = ref(false);

const hasOthers = computed(() => sessions.value.some((s) => !s.current));

onMounted(() => {
  void load();
});

/** Человекочитаемое имя устройства из User-Agent (грубый разбор, без библиотек). */
function deviceLabel(ua: string): string {
  if (!ua || ua === 'unknown') return 'Неизвестное устройство';
  const os = /Windows/i.test(ua)
    ? 'Windows'
    : /Android/i.test(ua)
      ? 'Android'
      : /iPhone|iPad|iOS/i.test(ua)
        ? 'iOS'
        : /Mac OS X|Macintosh/i.test(ua)
          ? 'macOS'
          : /Linux/i.test(ua)
            ? 'Linux'
            : '';
  const browser = /Edg\//i.test(ua)
    ? 'Edge'
    : /Chrome\//i.test(ua)
      ? 'Chrome'
      : /Firefox\//i.test(ua)
        ? 'Firefox'
        : /Safari\//i.test(ua)
          ? 'Safari'
          : 'Браузер';
  return [browser, os].filter(Boolean).join(' · ') || 'Устройство';
}

function deviceIcon(ua: string): string {
  if (/Android|iPhone|Mobile/i.test(ua)) return 'smartphone';
  if (/iPad|Tablet/i.test(ua)) return 'tablet';
  return 'computer';
}

function metaLine(s: IAccountSession): string {
  const parts: string[] = [];
  if (s.ip && s.ip !== 'unknown') parts.push(s.ip);
  if (s.last_seen_at) parts.push(`активность ${formatToFromNow(s.last_seen_at)}`);
  return parts.join(' · ') || 'нет данных';
}

async function onRevoke(sessionId: string): Promise<void> {
  busyId.value = sessionId;
  try {
    await revoke(sessionId);
    SuccessAlert('Сессия завершена');
  } catch (e) {
    FailAlert(e);
  } finally {
    busyId.value = '';
  }
}

async function onRevokeAll(): Promise<void> {
  revokingAll.value = true;
  try {
    const revoked = await revokeAllOthers();
    SuccessAlert(`Завершено сессий: ${revoked}`);
    confirmAll.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    revokingAll.value = false;
  }
}
</script>

<style scoped>
.sessions {
  display: flex;
  flex-direction: column;
}
.session-row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-3);
  padding: var(--p-3) 0;
  border-bottom: 1px solid var(--p-line);
}
.session-row:last-child {
  border-bottom: none;
}
.session-row__ico {
  color: var(--p-ink-3);
  margin-top: 2px;
}
.session-row__info {
  flex: 1;
  min-width: 0;
}
.session-row__head {
  display: flex;
  align-items: center;
  gap: var(--p-2);
  flex-wrap: wrap;
}
.session-row__device {
  font-weight: 600;
  color: var(--p-ink);
}
.session-row__meta {
  font-size: var(--p-fs-body-sm);
  color: var(--p-ink-3);
  margin-top: 2px;
}
.sessions__foot {
  margin-top: var(--p-4);
}
.sessions__confirm {
  color: var(--p-ink-2);
  margin: 0;
}
.sessions__skel {
  display: flex;
  flex-direction: column;
  gap: var(--p-3);
}
.sessions__skel-row {
  height: 48px;
  border-radius: var(--p-r-md);
  background: var(--p-surface-2);
  animation: sessions-pulse 1.2s ease-in-out infinite;
}
@keyframes sessions-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}
</style>
