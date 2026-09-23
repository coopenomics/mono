<template lang="pug">
.question-card
  //- Строка вопроса открывает подробности в правом дроуэре (канон вместо
  //- раскрывающихся списков). Кнопки голосования и номер — свои действия.
  .question-card__row(@click='openDetails')
    //- Номер вопроса на зелёной плашке — он же идентификатор: клик копирует.
    button.question-card__id-avatar(type='button', @click.stop='copyId')
      | {{ agenda.table.id }}
      q-tooltip {{ $t('questions.questionCard.copyIdTooltip', { id: agenda.table.id }) }}

    .question-card__main
      .question-card__title {{ documentTitle }}
      .question-card__applicant {{ getApplicantName() }}

    //- Кнопки голосования — прижаты к правому краю строки.
    .question-card__voting(@click.stop)
      VotingButtons(
        :decision='agenda.table',
        :is-rejected='isRejected',
        :is-voted-for='isVotedFor',
        :is-voted-against='isVotedAgainst',
        :is-voted-any='isVotedAny',
        @vote-for='$emit("vote-for")',
        @vote-against='$emit("vote-against")'
      )

  //- Нижняя полоска: срок слева, действия справа — «Подробнее» у всех,
  //- утверждение или отклонение у председателя.
  .question-card__footer(@click.stop)
    span.question-card__expires {{ $t('questions.questionCard.expiresIn', { fromNow: formatToFromNow(agenda.table.expired_at) }) }}
    .question-card__actions
      BaseButton(variant='ghost', size='sm', @click='openDetails')
        q-icon.q-mr-xs(name='open_in_new', size='16px')
        | {{ $t('questions.questionCard.details') }}
      ChairmanDecisionButton

  //- Подробности вопроса: сведения по нему (например, что заявитель рассказал
  //- о себе) — первыми, ниже документы пакета строками. Содержимое дроуэра
  //- рисуется только открытым: сведения грузятся по первому открытию.
  DetailsDrawer(
    v-model='detailsOpen',
    :title='$t(`questions.questionCard.detailsTitle`, { id: agenda.table.id })',
    :width='720'
  )
    .question-card__details
      .question-card__details-title {{ documentTitle }}
      .question-card__applicant {{ getApplicantName() }}

      component.q-mt-md(
        v-if='infoComponent',
        :is='infoComponent',
        :agenda='agenda'
      )

      ComplexDocument.q-mt-md(:documents='agenda.documents', collapsible)

    //- Голосовать и утверждать можно, не закрывая подробности.
    template(#footer)
      .question-card__drawer-footer
        VotingButtons(
          :decision='agenda.table',
          :is-rejected='isRejected',
          :is-voted-for='isVotedFor',
          :is-voted-against='isVotedAgainst',
          :is-voted-any='isVotedAny',
          @vote-for='$emit("vote-for")',
          @vote-against='$emit("vote-against")'
        )
        ChairmanDecisionButton
</template>

<script setup lang="ts">
import { computed, defineComponent, h, ref } from 'vue';
import { ComplexDocument } from 'src/shared/ui/ComplexDocument';
import { formatToFromNow } from 'src/shared/lib/utils/dates/formatToFromNow';
import { getShortNameFromCertificate } from 'src/shared/lib/utils/getNameFromCertificate';
import { VotingButtons } from '../VotingButtons';
import { useSessionStore } from 'src/entities/Session';
import type { IAgenda } from 'src/entities/Agenda/model';
import { Cooperative } from 'cooptypes';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { DetailsDrawer } from 'src/shared/ui/domain';
import { copyToClipboard, QTooltip } from 'quasar';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { decisionFactory } from 'src/shared/lib/decision-factory';
import { t } from 'src/shared/i18n';

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


const session = useSessionStore();
const isChairman = computed(() => session.isChairman);

// Отрицательный консенсус: против проголосовало большинство состава совета.
// Порог зеркален контракту (votefor/declinedec): против*100 > состав*50, строго.
// council_members_count приходит обогащённым в DTO решения с бэкенда.
const isRejected = computed(() => {
  const table = props.agenda.table as { votes_against?: string[]; council_members_count?: number };
  const against = table.votes_against?.length ?? 0;
  const members = table.council_members_count ?? 0;
  return members > 0 && against * 100 > members * 50;
});

// Состояние раскрытия — локальное для каждой карточки.
const detailsOpen = ref(false);
const openDetails = () => {
  detailsOpen.value = true;
};

const emit = defineEmits(['authorize', 'decline', 'vote-for', 'vote-against']);

/**
 * Действие председателя по вопросу. Нужно и в строке вопроса, и в подвале
 * дроуэра, поэтому собрано один раз. Отрицательный консенсус — явное
 * отклонение (контракт declinedec), иначе утверждение, доступное после
 * принятия советом.
 */
const ChairmanDecisionButton = defineComponent({
  name: 'ChairmanDecisionButton',
  setup() {
    return () => {
      if (!isChairman.value) return null;
      if (isRejected.value) {
        return h(
          BaseButton,
          { variant: 'negative', size: 'sm', loading: props.isProcessing, onClick: () => emit('decline') },
          () => t('questions.questionCard.decline')
        );
      }
      const approved = Boolean(props.agenda.table.approved);
      return h('span', { class: 'question-card__approve' }, [
        h(
          BaseButton,
          {
            variant: 'primary',
            size: 'sm',
            disabled: !approved,
            loading: props.isProcessing,
            onClick: () => emit('authorize'),
          },
          () => t('questions.questionCard.approve')
        ),
        approved ? null : h(QTooltip, null, () => t('questions.questionCard.approveDisabledHint')),
      ]);
    };
  },
});

// Копирование идентификатора вопроса по клику на плашку с номером.
const copyId = async () => {
  try {
    await copyToClipboard(String(props.agenda.table.id));
    SuccessAlert(t('questions.questionCard.copied'));
  } catch {
    FailAlert(t('questions.questionCard.copyFailed'));
  }
};

// Компонент дополнительной информации для конкретного типа решения.
const infoComponent = computed(() => {
  const type = props.agenda.table?.type;
  if (!type) return null;
  return decisionFactory.getInfoComponent(type);
});

const documentTitle = computed(() => getDocumentTitle());

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

  return t('questions.questionCard.untitledQuestion');
}

// Получение имени заявителя
const getApplicantName = () => {
  const certificate = props.agenda.table.username_certificate;
  if (certificate) {
    return getShortNameFromCertificate(certificate);
  }
  return t('questions.questionCard.accountFallback', { username: props.agenda.table.username });
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

/* Нижняя полоска: срок слева, «Утвердить» справа */
.question-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  border-top: 1px solid var(--p-line);
}
.question-card__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--p-2, 8px);
}
:deep(.question-card__approve) {
  display: inline-flex;
}

/* Подробности вопроса в дроуэре */
.question-card__details {
  padding: var(--p-4, 16px);
}
.question-card__details-title {
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  line-height: 1.4;
  color: var(--p-ink);
  overflow-wrap: anywhere;
}
.question-card__drawer-footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
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
  /* Срок — отдельной строкой, действия под ним во всю ширину */
  .question-card__footer {
    flex-wrap: wrap;
  }
  .question-card__actions {
    flex: 1 1 100%;
    justify-content: flex-end;
  }
}
</style>
