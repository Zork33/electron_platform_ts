<template>
  <q-page>
    <div class="user-list-page">
      <!-- Заголовок страницы -->
      <div class="page-header">
        <div class="page-title">Список пользователей</div>
        <div class="header-actions">
          <q-btn
            flat
            :color="showDeleted ? 'warning' : 'grey'"
            :icon="showDeleted ? 'visibility_off' : 'visibility'"
            :label="showDeleted ? 'Скрыть удаленных' : 'Показать удаленных'"
            rounded
            @click="toggleShowDeleted"
          />
        </div>
      </div>

      <!-- Сообщение об ошибке -->
      <q-banner v-if="error" class="text-white bg-red" rounded>
        <template #avatar>
          <q-icon name="error" />
        </template>
        {{ error }}
        <template #action>
          <q-btn flat label="Повторить" @click="() => fetchUsers(showDeleted)" />
        </template>
      </q-banner>

      <!-- Список пользователей -->
      <div v-if="!loading" class="users-container">
        <q-item
          v-for="user in users"
          :key="user.id"
          :class="['user-card q-mb-md', { 'user-card--deleted': user.deleted_at }]"
          :clickable="!user.deleted_at"
          @click="!user.deleted_at && router.push(`/user/${user.id}`)"
        >
          <q-item-section>
            <div class="text-h6">{{ user.auth_email }}</div>
            <div class="text-subtitle2 text-grey-7">
              ID: {{ user.id }}
              <span v-if="user.person_id" class="q-ml-md">
                Person ID: {{ user.person_id }}
              </span>
              <span class="q-ml-md">
                Доступ:
                <q-toggle
                  dense
                  :disable="!!user.deleted_at"
                  :model-value="user.has_access"
                  @update:model-value="handleToggleAccess(user.id, $event)"
                  color="primary"
                  size="sm"
                  class="q-ml-xs"
                />
              </span>
              <q-badge v-if="user.is_admin" color="purple" class="q-ml-sm">Admin</q-badge>
            </div>
            <div class="text-caption text-grey-6">
              Создан: {{ new Date(user.created_at || '').toLocaleDateString('ru-RU') }}
              <span v-if="user.updated_at && user.updated_at !== user.created_at" class="q-ml-md">
                Обновлен: {{ new Date(user.updated_at).toLocaleDateString('ru-RU') }}
              </span>
            </div>
          </q-item-section>

          <q-item-section side>
            <div class="row items-center q-gutter-sm">
              <q-btn
                v-if="!user.deleted_at"
                flat
                round
                icon="delete"
                color="negative"
                @click.stop="confirmDeleteUser(user)"
              >
                <q-tooltip>Удалить</q-tooltip>
              </q-btn>
              <!-- Кнопка восстановления закомментирована - нет на бэкенде -->
              <!-- <q-btn
                v-else
                flat
                round
                icon="restore"
                color="positive"
                @click.stop="confirmRestoreUser(user)"
              >
                <q-tooltip>Восстановить</q-tooltip>
              </q-btn> -->
            </div>
          </q-item-section>
        </q-item>
      </div>

      <!-- Загрузка -->
      <div v-else class="text-center q-pa-xl">
        <q-spinner color="primary" size="3em" />
        <div class="q-mt-md text-grey-7">Загрузка списка пользователей...</div>
      </div>

      <!-- Пустое состояние -->
      <EmptyState
        v-if="!loading && users.length === 0 && !error"
        title="Пока нет пользователей"
        message="Добавьте первого пользователя, чтобы начать работу"
      />
    </div>
  </q-page>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EmptyState from 'widget/EmptyState.vue'
import { useUser } from '@/entities/user'
import { type User } from '@/entities/user'
import { useQuasar } from 'quasar'

const $q = useQuasar()
const router = useRouter()
const {
  items: users,
  loading,
  error,
  showDeleted,
  fetchItems: fetchUsers,
  toggleShowDeleted,
  updateItem: updateUser,
  deleteItem: deleteUser,
  // restoreItem: restoreUser, // закомментировано - нет на бэкенде
} = useUser()

// Load users on component mount
onMounted(() => {
  void fetchUsers(false)
})

// Confirm delete user
const confirmDeleteUser = (user: User) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Вы действительно хотите удалить пользователя ${user.auth_email}?`,
    cancel: true,
    persistent: true
  }).onOk(() => {
    deleteUser(user.id).then(() => {
      $q.notify({
        type: 'positive',
        message: 'Пользователь успешно удален'
      })
    }).catch(() => {
      $q.notify({
        type: 'negative',
        message: 'Ошибка при удалении пользователя'
      })
    })
  })
}

// Confirm restore user - закомментировано, нет на бэкенде
// const confirmRestoreUser = (user: User) => {
//   $q.dialog({
//     title: 'Подтверждение восстановления',
//     message: `Вы действительно хотите восстановить пользователя ${user.auth_email}?`,
//     cancel: true,
//     persistent: true
//   }).onOk(() => {
//     restoreUser(user.id).then(() => {
//       $q.notify({
//         type: 'positive',
//         message: 'Пользователь успешно восстановлен'
//       })
//     }).catch(() => {
//       $q.notify({
//         type: 'negative',
//         message: 'Ошибка при восстановлении пользователя'
//       })
//     })
//   })
// }

// Handle toggle access
const handleToggleAccess = async (userId: number, newValue: boolean) => {
  try {
    await updateUser(userId, { has_access: newValue })
    $q.notify({
      type: 'positive',
      message: `Доступ ${newValue ? 'предоставлен' : 'запрещен'}`
    })
  } catch (err) {
    $q.notify({
      type: 'negative',
      message: 'Ошибка при изменении доступа: ' + (err as Error).message
    })
  }
}

</script>

<style lang="scss" scoped>
.user-list-page {
  // Контент растягивается на всю ширину
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #e5e7eb;

  @media (max-width: 640px) {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
}

.page-title {
  font-size: 2rem;
  font-weight: 300;
}

.header-actions {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.users-container {
  display: flex;
  flex-direction: column;
}

.user-card {
  border-radius: 12px;
  border: 1px solid rgba(128, 128, 128, 0.4);
  &:hover {
    background-color: rgba(128, 128, 128, 0.15);
  }

  &--deleted {
    opacity: 0.6;
    border-left: 4px solid #f44336;

    &:hover {
      transform: none;
      box-shadow: none;
    }
  }
}
</style>
