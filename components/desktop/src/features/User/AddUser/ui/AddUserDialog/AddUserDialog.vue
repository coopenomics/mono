<template lang="pug">
q-dialog(v-model='show', persistent, :maximized='true')
  q-card.add-user-wizard
    //- ===== Шапка =====
    header.add-user-wizard__bar
      .add-user-wizard__bar-title Добавить пайщика
      q-btn(
        flat,
        round,
        dense,
        icon='close',
        aria-label='Закрыть',
        :disable='loading',
        @click='closeDialog'
      )

    //- ===== Тело: вступление + степпер =====
    .add-user-wizard__body
      .add-user-wizard__col
        p.add-user-wizard__intro
          | Вы добавляете действующего пайщика в реестр цифрового кооператива.
          | Он получит приглашение на электронную почту и сможет сразу пользоваться
          | системой без заполнения заявления на вступление и оплаты взноса —
          | это уже сделано ранее вне цифровой системы.

        VerticalStepper(
          :steps='steps',
          :active-key='activeKey',
          :completed='completedKeys',
          @change='goToStep'
        )
          template(#active='{ step }')
            //- ---------- Шаг 1: Электронная почта ----------
            q-form.add-user-wizard__step(v-if='step.key === "contact"', ref='contactForm', greedy)
              q-input(
                v-model='state.email',
                label='Электронная почта',
                outlined,
                autocomplete='off',
                hint='На неё будет отправлено приглашение в кооператив',
                :rules='[validateEmail, validateExists]'
              )

            //- ---------- Шаг 2: Тип и данные пайщика ----------
            .add-user-wizard__step(v-else-if='step.key === "profile"')
              UserDataForm(v-model:userData='state.userData')

            //- ---------- Шаг 3: Вступительный взнос ----------
            q-form.add-user-wizard__step(v-else-if='step.key === "contribution"', greedy)
              q-input(
                v-model='addUserState.created_at',
                outlined,
                mask='datetime',
                label='Дата и время подписания заявления',
                placeholder='год/месяц/день часы:минуты',
                autocomplete='off',
                hint='Когда пайщик был принят в кооператив',
                :rules='[(val) => notEmpty(val), (val) => validateDateWithinRange(100)(val)]'
              )
              q-input(
                v-model='initial',
                outlined,
                type='number',
                :min='0',
                label='Размер вступительного взноса',
                hint='Был оплачен пайщиком при вступлении',
                :rules='[(val) => moreThenZero(val)]'
              )
                template(#append)
                  span.add-user-wizard__symbol {{ coop.governSymbol }}
                  q-btn(icon='sync', flat, dense, round, size='sm', @click='refresh("initial")')
                    q-tooltip Вернуть значение из настроек кооператива
              q-input(
                v-model='minimum',
                outlined,
                type='number',
                label='Размер минимального паевого взноса',
                hint='Был оплачен пайщиком при вступлении',
                :rules='[(val) => moreThenZero(val)]'
              )
                template(#append)
                  span.add-user-wizard__symbol {{ coop.governSymbol }}
                  q-btn(icon='sync', flat, dense, round, size='sm', @click='refresh("minimum")')
                    q-tooltip Вернуть значение из настроек кооператива

              label.add-user-wizard__option
                q-checkbox(v-model='addUserState.spread_initial', color='primary')
                .add-user-wizard__option-text
                  .add-user-wizard__option-title Добавить вступительный взнос на кошелёк
                  .add-user-wizard__option-caption Вступительный взнос будет добавлен на счёт кошелька кооператива и станет доступен для списания по фонду хозяйственной деятельности.

    //- ===== Подвал: навигация =====
    footer.add-user-wizard__foot
      BaseButton(
        v-if='activeKey === "contact"',
        variant='ghost',
        :disabled='loading',
        @click='closeDialog'
      ) Отмена
      BaseButton(
        v-else,
        variant='ghost',
        :disabled='loading',
        @click='goBack'
      )
        q-icon(name='arrow_back', size='16px')
        span.q-ml-sm Назад
      q-space
      BaseButton(
        v-if='activeKey !== "contribution"',
        variant='primary',
        @click='goNext'
      )
        span.q-mr-sm Далее
        q-icon(name='arrow_forward', size='16px')
      BaseButton(
        v-else,
        variant='primary',
        :disabled='!state.userData.type',
        :loading='loading',
        @click='addUserNow'
      )
        q-icon(name='person_add', size='16px')
        span.q-ml-sm Добавить пайщика
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import type { QForm } from 'quasar';
import { UserDataForm } from 'src/shared/ui/UserDataForm/UserDataForm';
import { VerticalStepper } from 'src/shared/ui/domain/VerticalStepper';
import type { StepperStep } from 'src/shared/ui/domain/VerticalStepper';
import { BaseButton } from 'src/shared/ui/base/BaseButton';
import { useAddUser } from '../../model';
import { useCooperativeStore } from 'src/entities/Cooperative';
import { useRegistratorStore } from 'src/entities/Registrator';
import { FailAlert, SuccessAlert } from 'src/shared/api';

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

const minimum = ref(0);
const initial = ref(0);
const loading = ref(false);

// ===== Шаги мастера =====
const steps: StepperStep[] = [
  { key: 'contact', label: 'Электронная почта', description: 'Куда отправить приглашение' },
  { key: 'profile', label: 'Тип и данные пайщика', description: 'Кто вступает и его реквизиты' },
  { key: 'contribution', label: 'Вступительный взнос', description: 'Что было оплачено при вступлении' },
];
const activeKey = ref<string>('contact');
const completedKeys = ref<string[]>([]);

const contactForm = ref<QForm | null>(null);

function markCompleted(key: string): void {
  if (!completedKeys.value.includes(key)) completedKeys.value.push(key);
}

async function goNext(): Promise<void> {
  if (activeKey.value === 'contact') {
    const ok = await contactForm.value?.validate();
    if (!ok) return;
    markCompleted('contact');
    activeKey.value = 'profile';
    return;
  }
  if (activeKey.value === 'profile') {
    if (!state.userData.type) {
      FailAlert('Выберите тип аккаунта пайщика');
      return;
    }
    markCompleted('profile');
    activeKey.value = 'contribution';
  }
}

function goBack(): void {
  if (activeKey.value === 'contribution') activeKey.value = 'profile';
  else if (activeKey.value === 'profile') activeKey.value = 'contact';
}

// Возврат на завершённый шаг по клику в степпере.
function goToStep(key: string): void {
  if (completedKeys.value.includes(key) || key === activeKey.value) {
    activeKey.value = key;
  }
}

// Сброс мастера при каждом открытии диалога.
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      activeKey.value = 'contact';
      completedKeys.value = [];
    }
  },
);

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

const { addUser, emailIsValid } = useAddUser();
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

const isValidEmail = computed(() => emailIsValid(state.email));
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

<style lang="scss" scoped>
.add-user-wizard {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--p-canvas);
}

/* ===== Шапка ===== */
.add-user-wizard__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--p-3, 12px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-bottom: 1px solid var(--p-line);
  flex-shrink: 0;
}
.add-user-wizard__bar-title {
  font-size: var(--p-fs-h2, 18px);
  font-weight: 600;
  color: var(--p-ink);
}

/* ===== Тело ===== */
.add-user-wizard__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: var(--p-6, 24px) var(--p-4, 16px);
}
.add-user-wizard__col {
  max-width: 680px;
  margin: 0 auto;
}
.add-user-wizard__intro {
  margin: 0 0 var(--p-5, 20px);
  font-size: var(--p-fs-body-sm, 13px);
  line-height: 1.55;
  color: var(--p-ink-2);
}

.add-user-wizard__step {
  display: flex;
  flex-direction: column;
  gap: var(--p-4, 16px);
  padding-bottom: var(--p-2, 8px);
}

.add-user-wizard__symbol {
  font-size: var(--p-fs-meta, 12px);
  color: var(--p-ink-2);
  margin-right: var(--p-1, 4px);
}

/* ===== Опция начисления взноса ===== */
.add-user-wizard__option {
  display: flex;
  align-items: flex-start;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border: 1px solid var(--p-line);
  border-radius: var(--p-r-md, 12px);
  cursor: pointer;
}
.add-user-wizard__option-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: var(--p-1, 4px);
}
.add-user-wizard__option-title {
  font-size: var(--p-fs-body-sm, 13px);
  font-weight: 600;
  color: var(--p-ink-1);
}
.add-user-wizard__option-caption {
  font-size: var(--p-fs-meta, 12px);
  line-height: 1.5;
  color: var(--p-ink-2);
}

/* ===== Подвал ===== */
.add-user-wizard__foot {
  display: flex;
  align-items: center;
  gap: var(--p-2, 8px);
  padding: var(--p-3, 12px) var(--p-4, 16px);
  background: var(--p-surface);
  border-top: 1px solid var(--p-line);
  flex-shrink: 0;
}
</style>
