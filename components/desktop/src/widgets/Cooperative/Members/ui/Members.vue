<template lang="pug">
div
  div(v-if='members')
    q-card(v-if='members.length > 0', flat)
      q-table.full-height(
        ref='tableRef',
        flat,
        bordered,
        :rows='members',
        :columns='columns',
        :table-colspan='9',
        row-key='username',
        :pagination='pagination',
        virtual-scroll,
        :virtual-scroll-item-size='48',
        :rows-per-page-options='[10]'
      )

        template(#header='props')
          q-tr(:props='props')
            q-th(v-for='col in props.cols', :key='col.name', :props='props') {{ col.label }}

            q-th(auto-width)

        template(#body='props')
          q-tr(:key='`m_${props.row.username}`', :props='props')
            q-td
              q-badge(v-if='props.row.is_chairman') {{ $t('cooperative.members.chairmanBadge') }}
              q-badge(v-else) {{ $t('cooperative.members.memberBadge') }}

            q-td {{ props.row.username }}
            q-td {{ props.row.last_name }}
            q-td {{ props.row.first_name }}
            q-td {{ props.row.middle_name }}


            q-td(auto-width)
              q-btn(
                size='sm',
                color='red',
                dense,
                @click='removeMember(props.row.username)',
                :loading='loadingMembers[props.row.username]'
              ) {{ $t('cooperative.members.removeLabel') }}

</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { SuccessAlert, FailAlert } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import {
  useUpdateBoard,
} from 'src/features/Cooperative/UpdateBoard';
import { useSystemStore } from 'src/entities/System/model';
import { t } from 'src/shared/i18n';
const { info } = useSystemStore();


const systemStore = useSystemStore();

const members = computed(() => systemStore.info.board_members || []);

const loadMembers = async () => {
  await systemStore.loadSystemInfo();
};

const loadingMembers = ref<Record<string, boolean>>({});

loadMembers();

const removeMember = async (username: string) => {
  let members_for_send = members.value.map(
    (el: {
      username: any;
      is_chairman: any;
    }) => {
      return {
        username: el.username,
        position_title: el.is_chairman ? t('cooperative.members.chairmanBadge') : t('cooperative.members.memberBadge'),
        position: el.is_chairman ? 'chairman' : 'member',
        is_voting: true,
      };
    },
  );

  members_for_send = members_for_send.filter(
    (el: { username: string }) => el.username != username,
  );
  loadingMembers.value[username] = true;

  try {
    await updateBoard(members_for_send, username);
  } catch {}
  loadingMembers.value[username] = false;
};

const updateBoard = async (new_members: any, removedUsername: string) => {
  try {
    const coop = useUpdateBoard();

    await coop.updateBoard({
      coopname: info.coopname,
      username: useSessionStore().username,
      board_id: 0,
      members: new_members,
      name: t('cooperative.members.boardName'),
      description: t('cooperative.members.boardDescription'),
    });

    // Удаляем участника из стора сразу после успешного обновления
    if (systemStore.info.board_members) {
      systemStore.info.board_members = systemStore.info.board_members.filter(
        (member: any) => member.username !== removedUsername
      );
    }

    SuccessAlert(t('cooperative.members.removeSuccess'));
  } catch (e: any) {
    FailAlert(e);
    // При ошибке перезагружаем данные
    await systemStore.loadSystemInfo();
  }
};

const columns = [
  {
    name: 'position',
    align: 'left',
    label: t('cooperative.members.column.position'),
    field: 'is_chairman',
    sortable: true,
  },
  {
    name: 'username',
    align: 'left',
    label: t('cooperative.members.column.username'),
    field: 'username',
    sortable: true,
  },
  {
    name: 'last_name',
    align: 'left',
    label: t('cooperative.members.column.lastName'),
    field: 'last_name',
    sortable: true,
  },
  {
    name: 'first_name',
    align: 'left',
    label: t('cooperative.members.column.firstName'),
    field: 'first_name',
    sortable: true,
  },
  {
    name: 'middle_name',
    align: 'left',
    label: t('cooperative.members.column.middleName'),
    field: 'middle_name',
    sortable: true,
  }
] as any;

const tableRef = ref(null);
const pagination = ref({ rowsPerPage: 10 });
</script>
