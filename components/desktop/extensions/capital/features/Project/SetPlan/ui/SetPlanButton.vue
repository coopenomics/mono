<template lang="pug">
div
  q-btn(
    v-if="props.project?.permissions?.can_set_plan"
    size='sm',
    color='primary',
    @click='showDialog = true',
    label='Установить план проекта'
  )

  BaseDialog(
    v-model='showDialog',
    title='Установить план проекта',
    size='md',
    @update:model-value='(v) => !v && clear()'
  )
    Form.q-pa-md(
      :handler-submit='handleSetPlan',
      :is-submitting='isSubmitting',
      :button-submit-txt='"Установить план"',
      :button-cancel-txt='"Отмена"',
      @cancel='clear'
      style="width: 600px; max-width: 100% !important;"
    )
      q-input(
        v-model.number='formData.plan_creators_hours'
        label='Плановое количество часов исполнителей'
        type='number'
        :rules='[(val) => val > 0 || "Количество часов должно быть больше 0"]'
        outlined
      )
        template(#append)
          span.text-grey-7 ч

      q-input(
        v-model='formData.plan_expenses'
        label='Плановые расходы'
        :rules='[(val) => !!val || "Плановые расходы обязательны"]'
        outlined
      )
        template(#append)
          span.text-grey-7 {{ governSymbol }}

      q-input(
        v-model='formData.plan_hour_cost'
        label='Стоимость часа работы'
        :rules='[(val) => !!val || "Стоимость часа работы обязательна"]'
        outlined
      )
        template(#append)
          span.text-grey-7 {{ governSymbol }}
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useSetPlan } from '../model';
import { FailAlert, SuccessAlert } from 'src/shared/api/alerts';
import { BaseDialog } from 'src/shared/ui/base/BaseDialog';
import { Form } from 'src/shared/ui/Form';
import type { IProject } from '../../../../entities/Project/model';

const props = defineProps<{ project: IProject | null | undefined }>();

const { setPlan, governSymbol, formatAmountForEOSIO } = useSetPlan();

const showDialog = ref(false);
const isSubmitting = ref(false);

const formData = ref({
  plan_creators_hours: 0,
  plan_expenses: '',
  plan_hour_cost: ''
});

const clear = () => {
  showDialog.value = false;
  formData.value = {
    plan_creators_hours: 0,
    plan_expenses: '',
    plan_hour_cost: ''
  };
};

// Обновляем входные данные при изменении проекта
watch(
  () => props.project,
  (newProject) => {
    if (newProject && newProject.is_planed) {
      // Для запланированного проекта заполняем форму текущими значениями
      formData.value.plan_creators_hours = newProject.plan.creators_hours || 0;
      formData.value.plan_expenses = newProject.plan.target_expense_pool || '';
      formData.value.plan_hour_cost = newProject.plan.hour_cost || '';
    } else {
      // Для нового проекта сбрасываем форму
      formData.value = {
        plan_creators_hours: 0,
        plan_expenses: '',
        plan_hour_cost: ''
      };
    }
  },
  { immediate: true }
);

const handleSetPlan = async () => {
  if (!props.project) return;

  // Проверяем права доступа
  if (!props.project.permissions?.can_set_plan) {
    FailAlert('У вас нет прав на установку плана проекта');
    return;
  }

  isSubmitting.value = true;
  try {
    const planData = {
      coopname: props.project.coopname || '',
      master: props.project.master || '',
      project_hash: props.project.project_hash,
      plan_creators_hours: formData.value.plan_creators_hours,
      plan_expenses: formatAmountForEOSIO(formData.value.plan_expenses),
      plan_hour_cost: formatAmountForEOSIO(formData.value.plan_hour_cost)
    };

    await setPlan(planData);
    SuccessAlert('План проекта успешно установлен');
    clear();
  } catch (error) {
    FailAlert(error);
  } finally {
    isSubmitting.value = false;
  }
};
</script>
