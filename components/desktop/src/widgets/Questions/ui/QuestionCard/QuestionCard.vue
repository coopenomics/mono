<template lang="pug">
.question-card__container
  q-card.question-card(flat)
    q-card-section.question-card__header-section(
      :class='{ "cursor-pointer": $q.screen.lt.md }',
      @click='$q.screen.lt.md ? $emit("toggle-expand") : undefined'
    )
      .question-header
        .question-icon
          q-icon(
            name='fa-solid fa-clipboard-question',
            size='24px',
            color='primary'
          )

        .question-title
          .title {{ getDocumentTitle() }}
          .subtitle {{ getApplicantName() }}
      .question-status
        .expires-date {{ formatToFromNow(agenda.table.expired_at) }}
        .status
          q-badge(
            :color='getStatusColor()',
            :text-color='getStatusTextColor()'
          ) {{ getStatusText() }}

    q-slide-transition
      div(v-show='expanded')
        q-separator
        q-card-section
          div
            .row.items-center.q-mb-md
              .col-12.text-center
                VotingButtons(
                  :decision='agenda.table',
                  :is-voted-for='isVotedFor',
                  :is-voted-against='isVotedAgainst',
                  :is-voted-any='isVotedAny',
                  @vote-for='$emit("vote-for")',
                  @vote-against='$emit("vote-against")'
                )
                q-btn.q-mt-md(
                  v-if='isChairman',
                  size='sm',
                  color='teal',
                  :loading='isProcessing',
                  @click='$emit("authorize")',
                  unelevated,
                  push
                ) Утвердить
          ComplexDocument(:documents='agenda.documents')

  .card-actions-external
    q-btn(
      flat,
      dense,
      size='sm',
      :icon='expanded ? "expand_less" : "expand_more"',
      @click.stop='$emit("toggle-expand")',
      color='primary',
      round
    )
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { formatToFromNow } from 'src/shared/lib/utils/dates/formatToFromNow';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { VotingButtons } from '../VotingButtons';
import { useCurrentUser } from 'src/entities/Session';
import type { IAgenda } from 'src/entities/Agenda/model';
import { Cooperative } from 'cooptypes';
import 'src/shared/ui/CardStyles/index.scss';

const $q = useQuasar();

const props = defineProps({
  agenda: {
    type: Object as () => IAgenda,
    required: true,
  },
  expanded: {
    type: Boolean,
    default: false,
  },
  isProcessing: {
    type: Boolean,
    default: false,
  },
  isVotedFor: {
    type: Function,
    required: true,
  },
  isVotedAgainst: {
    type: Function,
    required: true,
  },
  isVotedAny: {
    type: Function,
    required: true,
  },
});

defineEmits(['toggle-expand', 'authorize', 'vote-for', 'vote-against']);

const currentUser = useCurrentUser();
const isChairman = computed(() => currentUser.isChairman);

// Получение заголовка документа с поддержкой агрегатов
function getDocumentTitle() {
  const agenda = props.agenda;
  const statement = agenda.documents?.statement;
  const rawDocument = statement?.documentAggregate?.rawDocument;
  const meta = rawDocument?.meta as
    | Cooperative.Document.IMetaDocument
    | undefined;
  // Используем только агрегаты документа
  if (meta?.title) {
    const title = meta.title;
    return formatDecisionTitle(title);
  }

  return 'Вопрос без заголовка';
}

// Форматирование заголовка решения
const formatDecisionTitle = (title: string) => {
  if (!title) return 'Без заголовка';
  if (title.length > 50) {
    return title.substring(0, 50) + '...';
  }
  return title;
};

// Получение имени заявителя
const getApplicantName = () => {
  const certificate = props.agenda.table.username_certificate;
  if (certificate) {
    return getShortNameFromCertificate(certificate);
  }
  return `Аккаунт: ${props.agenda.table.username}`;
};

// Определение статуса голосования
const getStatusText = () => {
  if (
    !props.agenda.table ||
    !props.agenda.table.votes_for ||
    !props.agenda.table.votes_against
  ) {
    return 'Не проголосовал';
  }

  try {
    if (props.isVotedAny(props.agenda.table)) {
      if (props.isVotedFor(props.agenda.table)) return 'Вы ЗА';
      if (props.isVotedAgainst(props.agenda.table)) return 'Вы ПРОТИВ';
    }
  } catch (error) {
    console.warn('Ошибка при проверке статуса голосования:', error);
  }
  return 'Не проголосовал';
};

const getStatusColor = () => {
  if (
    !props.agenda.table ||
    !props.agenda.table.votes_for ||
    !props.agenda.table.votes_against
  ) {
    return 'grey';
  }

  try {
    if (props.isVotedAny(props.agenda.table)) {
      if (props.isVotedFor(props.agenda.table)) return 'positive';
      if (props.isVotedAgainst(props.agenda.table)) return 'negative';
    }
  } catch (error) {
    console.warn('Ошибка при проверке цвета статуса голосования:', error);
  }
  return 'grey';
};

const getStatusTextColor = () => {
  return 'white';
};
</script>

<style lang="scss" scoped>
.question-card__container {
  padding: 8px;
  width: 100%;
}

.question-card {
  border-radius: 16px;
  border: 1px solid rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease-in-out;
  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transform: translateY(-1px);
  }
}

.question-card__header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.question-header {
  display: flex;
  align-items: center;
  gap: 16px;
}

.question-title .title {
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  margin-bottom: 4px;
}

.question-title .subtitle {
  font-size: 12px;
  color: #757575;
}

.question-status {
  text-align: right;
}

.question-status .expires-date {
  font-size: 12px;
  color: #757575;
  margin-bottom: 4px;
}

.question-status .status {
  margin-top: 4px;
}

.voting-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.card-actions-external {
  display: flex;
  justify-content: center;
  padding: 4px;
  gap: 8px;
}
</style>
