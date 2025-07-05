<template lang="pug">
q-dialog(v-model='show', persistent, :maximized='false')
  q-card
    div
      q-bar.bg-gradient-dark.text-white
        span Добавить пайщика
        q-space
        q-btn(v-close-popup, dense, flat, icon='close')
          q-tooltip Закрыть

      .q-pa-sm.row.justify-center
        .q-pa-md
          .q-pb-md
            span Внимание! Вы собираетесь добавить действующего пайщика в реестр цифрового кооператива. Пайщик получит приглашение на электронную почту и сможет сразу использовать систему без заполнения заявления на вступление и оплаты вступительного взноса, т.к. он сделал это ранее вне цифровой системы.

          UserDataForm(v-model:userData='state.userData')
            template(#top)
              q-input.q-mb-md(
                v-model='state.email',
                standout='bg-teal text-white',
                label='Электронная почта',
                :rules='[validateEmail, validateExists]'
              )

            template(#bottom)
              q-input.q-mt-md(
                standout='bg-teal text-white',
                v-model='addUserState.created_at',
                mask='datetime',
                label='Дата и время подписания заявления',
                placeholder='год/месяц/день часы:минуты',
                :rules='[(val) => notEmpty(val), (val) => validateDateWithinRange(100)(val)]',
                autocomplete='off',
                hint='когда пайщик был принят в кооператив'
              )

              q-input.q-mt-md(
                standout='bg-teal text-white',
                v-model='initial',
                type='number',
                :min='0',
                label='Размер вступительного взноса',
                :rules='[(val) => moreThenZero(val)]',
                hint='был оплачен пайщиком при вступлении'
              )
                template(#append)
                  span.text-overline {{ coop.governSymbol }}
                  q-btn(icon='sync', flat, dense, @click='refresh("initial")')

              q-input.q-mt-md(
                standout='bg-teal text-white',
                v-model='minimum',
                hint='был оплачен пайщиком при вступлении',
                type='number',
                label='Размер минимального паевого взноса',
                :rules='[(val) => moreThenZero(val)]'
              )
                template(#append)
                  span.text-overline {{ coop.governSymbol }}
                  q-btn(icon='sync', flat, dense, @click='refresh("minimum")')

              q-card.q-mt-md(flat)
                q-item(tag='label', v-ripple)
                  q-item-section(avatar)
                    q-checkbox(v-model='addUserState.spread_initial')

                  q-item-section
                    q-item-label Начислить вступительный взнос
                    q-item-label(caption) Вступительный взнос будет зачислен на счёт кошелька кооператива и станет доступен для списания по фонду хозяйственной деятельности.

              q-card.q-mt-md(flat)
                q-item(tag='label', v-ripple)
                  q-item-section(avatar)
                    q-checkbox(v-model='spread_minimum', disable)

                  q-item-section
                    q-item-label Начислить минимальный паевый взнос
                    q-item-label(caption) Минимальный паевый взнос будет зачислен на оборотный счет кооператива и учитываться в процессе возврата при выходе пайщика из кооператива.

              .q-mt-lg
                q-btn(flat, @click='closeDialog') Отмена
                q-btn(color='primary', @click='addUserNow', :loading='loading') Добавить
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { UserDataForm } from 'src/shared/ui/UserDataForm/UserDataForm';
import { useAddUser } from '../../model';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { useRegistratorStore } from 'src/entities/Registrator';
import { FailAlert, SuccessAlert } from 'src/shared/api';
import { useCreateUser } from 'src/features/User/CreateUser';
import { useSystemStore } from 'src/entities/System/model';
import { notEmpty } from 'src/shared/lib/utils';
import { validateDateWithinRange } from 'src/shared/lib/utils/dates/validateDateWithinRange';
import { useAccountStore } from 'src/entities/Account/model';

const { info } = useSystemStore();

// Props для управления видимостью диалога
const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
}>();

// Вычисляемое свойство для v-model
const show = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value),
});

const { state, addUserState, clearUserData } = useRegistratorStore();
const spread_minimum = ref(true);
const minimum = ref(0);
const initial = ref(0);
const loading = ref(false);

// Функция для добавления пользователя
const addUserNow = async () => {
  try {
    loading.value = true;
    await addUser();
    SuccessAlert('Пользователь добавлен');
    clearUserData();
    closeDialog();

    // Обновляем список участников
    const accountStore = useAccountStore();
    await accountStore.getAccounts({
      options: { page: 1, limit: 1000, sortOrder: 'DESC' },
    });
  } catch (e: any) {
    FailAlert(e.message);
  } finally {
    loading.value = false;
  }
};

// Функция для закрытия диалога
const closeDialog = () => {
  show.value = false;
};

// Функция для проверки значения больше нуля
const moreThenZero = (value: any) => {
  return Number(value) > 0 || 'Значение должно быть больше нуля';
};

watch(initial, (newValue) => {
  if (state.userData.type === 'organization')
    addUserState.org_initial = Number(newValue);
  else addUserState.initial = Number(newValue);
});

watch(minimum, (newValue) => {
  if (state.userData.type === 'organization')
    addUserState.org_minimum = Number(newValue);
  else addUserState.minimum = Number(newValue);
});

const { addUser } = useAddUser();
const api = useCreateUser();
const coop = useCooperativeStore();

onMounted(async () => {
  await coop.loadPublicCooperativeData(info.coopname);

  if (coop.publicCooperativeData) {
    if (addUserState.initial == 0)
      addUserState.initial = parseFloat(coop.publicCooperativeData.initial);

    if (addUserState.minimum == 0)
      addUserState.minimum = parseFloat(coop.publicCooperativeData.minimum);

    if (addUserState.org_initial == 0)
      addUserState.org_initial = parseFloat(
        coop.publicCooperativeData.org_initial,
      );

    if (addUserState.org_minimum == 0)
      addUserState.org_minimum = parseFloat(
        coop.publicCooperativeData.org_minimum,
      );

    updateLocalVars();
  }
});

const updateLocalVars = () => {
  if (state.userData.type === 'organization') {
    initial.value = addUserState.org_initial;
    minimum.value = addUserState.org_minimum;
  } else {
    initial.value = addUserState.initial;
    minimum.value = addUserState.minimum;
  }
};

watch(
  () => state.userData.type,
  () => {
    updateLocalVars();
  },
);

const refresh = (what: string) => {
  if (coop.publicCooperativeData)
    if (state.userData.type === 'organization') {
      if (what === 'initial')
        addUserState.org_initial = parseFloat(
          coop.publicCooperativeData.org_initial,
        );
      else
        addUserState.org_minimum = parseFloat(
          coop.publicCooperativeData.org_minimum,
        );
    } else {
      if (what === 'initial')
        addUserState.initial = parseFloat(coop.publicCooperativeData.initial);
      else
        addUserState.minimum = parseFloat(coop.publicCooperativeData.minimum);
    }

  updateLocalVars();
};

const isValidEmail = computed(() => api.emailIsValid(state.email));
const isEmailExist = ref(false);

const validateEmail = () => {
  return isValidEmail.value || 'Введите корректный email';
};

const validateExists = () => {
  return (
    !isEmailExist.value || 'Пользователь с таким email уже существует. Войдите.'
  );
};
</script>
