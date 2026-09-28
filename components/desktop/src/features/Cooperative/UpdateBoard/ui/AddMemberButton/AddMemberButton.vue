<template lang="pug">
//- Canon header-кнопка: на мобильном — только иконка + tooltip,
//- на десктопе — иконка + лейбл. Без обёртки .header-action, чтобы
//- не растягивать кнопку по высоте шапки.
q-btn(
  @click='showDialog = true',
  :color='isMobile ? "accent" : "primary"',
  :flat='isMobile',
  :dense='isMobile',
  :size='isMobile ? "sm" : undefined',
  no-wrap
)
  q-icon(name='fa-solid fa-user-plus')
  span.q-ml-sm(v-if='!isMobile') {{ $t('cooperative.addMemberButton.triggerLabel') }}
  q-tooltip(v-if='isMobile') {{ $t('cooperative.addMemberButton.triggerLabel') }}

AddMemberDialog(
  v-model='showDialog',
  :loading='loading',
  @add='addMember'
)
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import {
  AddMemberDialog,
  useUpdateBoard,
} from 'src/features/Cooperative/UpdateBoard';
import { readBlockchain, SuccessAlert, FailAlert } from 'src/shared/api';
import { useWindowSize } from 'src/shared/hooks';
import { t } from 'src/shared/i18n';

const showDialog = ref(false);
const loading = ref(false);
const systemStore = useSystemStore();
const { isMobile } = useWindowSize();

const addMember = async (username: string) => {
  loading.value = true;

  try {
    const verified = await verify(username);

    if (!verified) {
      FailAlert(t('cooperative.addMemberButton.usernameNotFoundError'));
      return;
    }

    const membersForSend = (systemStore.info.board_members || []).map(
      (member) => ({
        username: member.username,
        position_title: member.is_chairman ? t('cooperative.addMemberButton.chairmanTitle') : t('cooperative.addMemberButton.memberTitle'),
        position: member.is_chairman ? 'chairman' : 'member',
        is_voting: true,
      }),
    );

    membersForSend.push({
      username,
      position_title: t('cooperative.addMemberButton.memberTitle'),
      position: 'member',
      is_voting: true,
    });

    await updateBoard(membersForSend);
    showDialog.value = false;
  } catch (e) {
    FailAlert(e);
  } finally {
    loading.value = false;
  }
};

const verify = async (username: string) => {
  try {
    await readBlockchain.v1.chain.get_account(username);
    return true;
  } catch {
    return false;
  }
};

const updateBoard = async (members: any[]) => {
  try {
    const coop = useUpdateBoard();

    await coop.updateBoard({
      coopname: systemStore.info.coopname,
      username: useSessionStore().username,
      board_id: 0,
      members,
      name: t('cooperative.addMemberButton.boardName'),
      description: t('cooperative.addMemberButton.boardDescription'),
    });

    // Ответ приходит, когда состав уже записан в цепь: сведения о кооперативе
    // перечитываем сразу, остальные столы получат его по ленте изменений.
    SuccessAlert(t('cooperative.addMemberButton.updatedSuccess'));
    await systemStore.loadSystemInfo();
  } catch (e) {
    await systemStore.loadSystemInfo();
    throw e;
  }
};
</script>

