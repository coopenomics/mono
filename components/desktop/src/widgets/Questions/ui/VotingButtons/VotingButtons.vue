<template lang="pug">
.vote-controls
  //- Против
  .vote-side
    button.vote-btn.vote-btn--against(
      type='button',
      :class='{ "is-active": isVotedAgainst(decision), "is-locked": isVotedAny(decision) }',
      :disabled='isVotedAny(decision)',
      @click.stop='$emit("vote-against")'
    )
      q-icon(name='thumb_down', size='15px')
      span.vote-btn__count {{ decision.votes_against.length }}
    .vote-voters(v-if='decision.votes_against_certificates?.length')
      span.vote-voter(
        v-for='c in decision.votes_against_certificates',
        :key='getVoterKey(c)'
      ) {{ getShortNameFromCertificate(c) }}

  //- Индикатор принятия решения советом — галочка закрашивается,
  //- когда собрано достаточно голосов «за».
  .vote-status
    q-checkbox(
      :model-value='approved',
      disable,
      color='primary',
      size='md'
    )
      q-tooltip {{ approved ? 'Решение принято советом' : 'Решение ещё не принято советом' }}

  //- За
  .vote-side
    button.vote-btn.vote-btn--for(
      type='button',
      :class='{ "is-active": isVotedFor(decision), "is-locked": isVotedAny(decision) }',
      :disabled='isVotedAny(decision)',
      @click.stop='$emit("vote-for")'
    )
      span.vote-btn__count {{ decision.votes_for.length }}
      q-icon(name='thumb_up', size='15px')
    .vote-voters(v-if='decision.votes_for_certificates?.length')
      span.vote-voter(
        v-for='c in decision.votes_for_certificates',
        :key='getVoterKey(c)'
      ) {{ getShortNameFromCertificate(c) }}
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate'

const props = defineProps({
  decision: {
    type: Object,
    required: true
  },
  isVotedFor: {
    type: Function,
    required: true
  },
  isVotedAgainst: {
    type: Function,
    required: true
  },
  isVotedAny: {
    type: Function,
    required: true
  }
})

defineEmits(['vote-for', 'vote-against'])

const approved = computed(() => props.decision.approved)

const getVoterKey = (certificate: any) => {
  if (certificate.username) return certificate.username
  if (certificate.first_name && certificate.last_name) {
    return `${certificate.last_name}_${certificate.first_name}`
  }
  if (certificate.short_name) return certificate.short_name
  return Math.random().toString()
}
</script>

<style lang="scss" scoped>
.vote-controls {
  display: flex;
  align-items: flex-start;
  justify-content: center;
  gap: var(--p-3, 12px);
}

.vote-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--p-2, 8px);
  min-width: 64px;
}

/* Кнопка голоса — спокойная поверхность, токены pos/neg на активе и hover */
.vote-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-width: 64px;
  height: 34px;
  padding: 0 var(--p-3, 12px);
  background: var(--p-surface-2);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-sm, 8px);
  color: var(--p-ink-1);
  font-weight: 600;
  cursor: pointer;
  transition: background-color var(--p-dur-fast, 120ms) var(--p-ease-standard),
    border-color var(--p-dur-fast, 120ms) var(--p-ease-standard),
    color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.vote-btn__count {
  font-size: var(--p-fs-body, 14px);
  line-height: 1;
}

.vote-btn--against:not(.is-locked):hover {
  border-color: var(--p-neg);
  color: var(--p-neg);
}
.vote-btn--for:not(.is-locked):hover {
  border-color: var(--p-pos);
  color: var(--p-pos);
}

.vote-btn--against.is-active {
  background: var(--p-neg-soft);
  border-color: var(--p-neg);
  color: var(--p-neg);
}
.vote-btn--for.is-active {
  background: var(--p-pos-soft);
  border-color: var(--p-pos);
  color: var(--p-pos);
}

/* Заблокирована, но не выбранная — приглушаем */
.vote-btn.is-locked {
  cursor: default;
}
.vote-btn.is-locked:not(.is-active) {
  opacity: 0.45;
}

.vote-status {
  display: flex;
  align-items: center;
  height: 34px;
}

.vote-voters {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  max-width: 110px;
}
.vote-voter {
  font-size: var(--p-fs-eyebrow, 11px);
  line-height: 1.25;
  text-align: center;
  color: var(--p-ink-2);
  overflow-wrap: anywhere;
}
</style>
