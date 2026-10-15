import type { CandidateIntakeAnswerDomainInterface } from '~/domain/account/interfaces/candidate-domain.interface';
import type { IntakeFormAnswerDomainInterface } from '~/domain/participant/interfaces/register-participant-domain.interface';
import type { RegisteredIntakeForm } from '../services/agreement-registry.service';
import { intakeFieldLabel, validateIntakeValues } from './intake-schema.utils';
import { t } from '~/i18n';

export interface IntakeAnswersCheck {
  /** Ответы в виде, готовом к хранению; заполнен, только если замечаний нет. */
  answers: Record<string, CandidateIntakeAnswerDomainInterface>;
  /** Замечания человеческим языком; пусто — заявку можно принимать. */
  problems: string[];
}

/** Проверка одной анкеты: либо готовый к хранению ответ, либо замечания. */
function checkForm(
  form: RegisteredIntakeForm,
  answer: IntakeFormAnswerDomainInterface | undefined,
  submittedAt: string
): { stored?: CandidateIntakeAnswerDomainInterface; problems: string[] } {
  // Заголовок анкеты сам говорит, что это анкета («Анкета программы …»),
  // поэтому в сообщении его не оборачиваем словом «анкета» ещё раз.
  if (!answer) return { problems: [t('registration.intakeAnswers.formNotFilled', { formTitle: form.title })] };

  const { data, issues } = validateIntakeValues(form.json_schema, answer.values);
  if (issues.length > 0) {
    return {
      problems: issues.map(
        (issue) => `${form.title} — ${intakeFieldLabel(form.json_schema, issue.path)}: ${issue.message}`
      ),
    };
  }

  return {
    problems: [],
    stored: {
      values: data,
      title: form.title,
      json_schema: form.json_schema,
      extension_name: form.extension_name,
      submitted_at: submittedAt,
    },
  };
}

/**
 * Сверяет ответы заявителя с анкетами, которые ему положено заполнить.
 *
 * Что заполнять, решает реестр на сервере, а не клиент: лишняя анкета — такое
 * же замечание, как незаполненная. Хранятся очищенные значения (обрезанные
 * строки, без неизвестных полей), а не сырой ввод.
 */
export function checkIntakeAnswers(
  requiredForms: RegisteredIntakeForm[],
  submitted: IntakeFormAnswerDomainInterface[] | undefined,
  now: Date = new Date()
): IntakeAnswersCheck {
  const given = submitted ?? [];
  const problems: string[] = [];
  const answers: Record<string, CandidateIntakeAnswerDomainInterface> = {};

  const unknown = given.filter((answer) => !requiredForms.some((form) => form.id === answer.form_id));
  if (unknown.length > 0) {
    problems.push(t('registration.intakeAnswers.unknownForms', { formIds: unknown.map((answer) => answer.form_id).join(', ') }));
  }

  for (const form of requiredForms) {
    const result = checkForm(
      form,
      given.find((item) => item.form_id === form.id),
      now.toISOString()
    );
    problems.push(...result.problems);
    if (result.stored) answers[form.id] = result.stored;
  }

  return { answers: problems.length > 0 ? {} : answers, problems };
}
