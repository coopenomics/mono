<template lang="pug">
.question-card
  //- Верхняя строка кликабельна — раскрывает документ. Исключение — зона
  //- кнопок голосования (@click.stop): по ним голосуют, документ не раскрывают.
  .question-card__row(@click='toggleExpand')
    //- Номер вопроса на зелёной плашке — он же идентификатор: клик копирует.
    button.question-card__id-avatar(type='button', @click.stop='copyId')
      | {{ agenda.table.id }}
      q-tooltip Скопировать № {{ agenda.table.id }}

    .question-card__main
      .question-card__title {{ getDocumentTitle() }}
      .question-card__applicant {{ getApplicantName() }}

    //- Кнопки голосования — прижаты к правому краю строки.
    .question-card__voting(@click.stop)
      VotingButtons(
        :decision='agenda.table',
        :is-voted-for='isVotedFor',
        :is-voted-against='isVotedAgainst',
        :is-voted-any='isVotedAny',
        @vote-for='$emit("vote-for")',
        @vote-against='$emit("vote-against")'
      )

    q-icon.question-card__chevron(
      :name='expanded ? "expand_less" : "expand_more"',
      size='20px'
    )

  //- Нижняя полоска: срок слева, действие председателя справа.
  //- У обычного пайщика — только срок, узкая панелька.
  .question-card__footer(@click.stop)
    span.question-card__expires Истекает {{ formatToFromNow(agenda.table.expired_at) }}
    .question-card__approve(v-if='isChairman')
      BaseButton(
        variant='primary',
        size='sm',
        :disabled='!agenda.table.approved',
        :loading='isProcessing',
        @click='$emit("authorize")'
      ) Утвердить
      q-tooltip(v-if='!agenda.table.approved') Для утверждения решение должно быть принято советом

  q-slide-transition
    .question-card__doc(v-show='expanded')
      ComplexDocument(:documents='agenda.documents')

      component(
        v-if='infoComponent',
        :is='infoComponent',
        :agenda='agenda'
      )
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { formatToFromNow } from 'src/shared/lib/utils/dates/formatToFromNow';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { VotingButtons } from '../VotingButtons';
import { useSessionStore } from 'src/entities/Session';
import type { IAgenda } from 'src/entities/Agenda/model';
import { Cooperative } from 'cooptypes';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { copyToClipboard } from 'quasar';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { decisionFactory } from 'src/shared/lib/decision-factory';

const props = defineProps({
  agenda: {
    type: Object as () => IAgenda,
    required: true,
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

defineEmits(['authorize', 'vote-for', 'vote-against']);

const session = useSessionStore();
const isChairman = computed(() => session.isChairman);

// Состояние раскрытия — локальное для каждой карточки.
const expanded = ref(false);
const toggleExpand = () => {
  expanded.value = !expanded.value;
};

// Копирование идентификатора вопроса по клику на плашку с номером.
const copyId = async () => {
  try {
    await copyToClipboard(String(props.agenda.table.id));
    SuccessAlert('Скопировано');
  } catch {
    FailAlert('Не удалось скопировать');
  }
};

// Компонент дополнительной информации для конкретного типа решения.
const infoComponent = computed(() => {
  const type = props.agenda.table?.type;
  if (!type) return null;
  return decisionFactory.getInfoComponent(type);
});

// Получение заголовка документа с поддержкой агрегатов
function getDocumentTitle() {
  const agenda = props.agenda;
  const statement = agenda.documents?.statement;
  const rawDocument = statement?.documentAggregate?.rawDocument;
  const meta = rawDocument?.meta as
    | Cooperative.Document.IMetaDocument
    | undefined;
  if (meta?.title) {
    return meta.title;
  }

  const tableMeta = agenda.table?.statement?.meta;
  if (tableMeta && typeof tableMeta === 'object' && (tableMeta as any).title) {
    return (tableMeta as any).title;
  }

  if (tableMeta && typeof tableMeta === 'string') {
    try {
      const parsed = JSON.parse(tableMeta);
      if (parsed?.title) {
        return parsed.title;
      }
    } catch {
      // ignore parse errors
    }
  }

  return 'Вопрос без заголовка';
}

// Получение имени заявителя
const getApplicantName = () => {
  const certificate = props.agenda.table.username_certificate;
  if (certificate) {
    return getShortNameFromCertificate(certificate);
  }
  return `Аккаунт: ${props.agenda.table.username}`;
};
</script>

<style lang="scss" scoped>
.question-card {
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-lg, 16px);
  overflow: hidden;
  transition: border-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.question-card:hover {
  border-color: var(--p-line-2, var(--p-line));
}

.question-card__row {
  display: flex;
  align-items: flex-start;
  gap: var(--p-4, 16px);
  padding: var(--p-4, 16px);
  cursor: pointer;
  transition: background-color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.question-card__row:hover {
  background: var(--p-surface-2);
}

/* Плашка с номером вопроса — кликабельна, копирует идентификатор */
.question-card__id-avatar {
  flex: 0 0 40px;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--p-r-sm, 8px);
  background: var(--p-primary-soft);
  color: var(--p-primary);
  font: inherit;
  font-size: var(--p-fs-body, 14px);
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--p-dur-fast, 120ms) var(--p-ease-standard),
    color var(--p-dur-fast, 120ms) var(--p-ease-standard);
}
.question-card__id-avatar:hover {
  background: var(--p-primary);
  color: var(--p-ink-on-primary);
}

.question-card__main {
  flex: 1 1 auto;
  min-width: 0;
}
.question-card__title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.question-card__applicant {
  margin-top: 2px;
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
}
.question-card__expires {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-3);
  white-space: nowrap;
}

/* Кнопки голосования — у правого края, отдельная зона действий */
.question-card__voting {
  flex: 0 0 auto;
  cursor: default;
}

.question-card__chevron {
  flex: 0 0 auto;
  align-self: flex-start;
  margin-top: 2px;
  color: var(--p-ink-3);
}

/* Нижняя полоска: срок слева, «Утвердить» справа */
.question-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
}
.question-card__approve {
  display: inline-flex;
}

/* Раскрываемое содержимое документа */
.question-card__doc {
  padding: var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
}

/* На узких экранах кнопки голосования переносятся под заголовок */
@media (max-width: 768px) {
  .question-card__row {
    flex-wrap: wrap;
  }
  .question-card__main {
    flex: 1 1 70%;
  }
  .question-card__voting {
    order: 4;
    flex: 1 1 100%;
  }
}
</style>
