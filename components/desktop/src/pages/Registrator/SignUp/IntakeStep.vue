<template lang="pug">
div(v-show='store.isStep("IntakeStep")')
  .intake
    section.intake__form(v-for='form in store.intakeForms', :key='form.id')
      //- Заголовок анкеты повторять не нужно, когда она одна и состоит из одного
      //- поля: его подпись и пояснение уже всё говорят.
      h3.intake__title(v-if='showFormTitle(form)') {{ form.title }}
      p.intake__lead(v-if='form.description') {{ form.description }}

      ZodForm(
        :schema='asFormSchema(form.schema)',
        :model-value='store.state.intakeAnswers[form.id] ?? {}',
        @update:model-value='(values) => setAnswers(form.id, values)'
      )

    .intake__actions
      BaseButton(variant='ghost', @click='store.prev()')
        q-icon(name='arrow_back')
        span.q-ml-md назад

      BaseButton(variant='primary', :disabled='!store.isIntakeComplete', @click='proceed') Продолжить
</template>

<script lang="ts" setup>
import { useRegistratorStore, type IRegistrationIntakeForm } from 'src/entities/Registrator';
import type { IExtensionConfigSchema } from 'src/entities/Extension/model';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { ZodForm } from 'src/shared/ui/ZodForm';

/**
 * Сведения о себе, которые просят расширения кооператива: набор анкет зависит от
 * выбранной программы и приходит с сервера. Поля рисует та же форма, что и
 * настройки расширений, — анкета описана той же схемой.
 */
const store = useRegistratorStore();

const asFormSchema = (schema: unknown) => schema as IExtensionConfigSchema;

const showFormTitle = (form: IRegistrationIntakeForm): boolean => {
  const fields = Object.keys((form.schema as { properties?: object })?.properties ?? {});
  return store.intakeForms.length > 1 || fields.length > 1;
};

const setAnswers = (formId: string, values: Record<string, unknown>) => {
  store.state.intakeAnswers = { ...store.state.intakeAnswers, [formId]: values };
};

const proceed = () => {
  if (!store.isIntakeComplete) return;
  // Сюда возвращают и тех, кто начал вступление до появления анкет: учётка у
  // них уже создана, шаг пароля им повторять нельзя.
  if (store.state.accountCreated) {
    store.goTo(store.isBranched && !store.state.selectedBranch ? 'SelectBranch' : 'ReadStatement');
    return;
  }
  store.next();
};
</script>

<style scoped>
.intake {
  margin: var(--p-4, 16px) 0;
}
.intake__form + .intake__form {
  margin-top: var(--p-6, 24px);
}
.intake__title {
  margin: 0 0 var(--p-2, 8px);
  font-size: var(--p-fs-h3, 15px);
  font-weight: 600;
  color: var(--p-ink);
}
.intake__lead {
  margin: 0 0 var(--p-4, 16px);
  font-size: var(--p-fs-body, 14px);
  line-height: 1.5;
  color: var(--p-ink-2);
}
.intake__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--p-3, 12px);
  margin-top: var(--p-5, 20px);
}
</style>
