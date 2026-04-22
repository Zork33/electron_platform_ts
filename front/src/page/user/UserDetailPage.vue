<template>
  <EntityDetailPage
    :title="user ? (user.auth_email || `Пользователь #${user.id}`) : 'Пользователь'"
    :loading="loading"
    :error="error"
    :deleted-at="user?.deleted_at"
    list-path="/user"
    hide-save
    :hide-info="!user"
    :hide-delete="!user || !!user.deleted_at"
    :info-data="user"
    @delete="handleDelete"
    @retry="loadUser"
  >
    <template v-if="user">
      <div class="user-detail-layout">

        <!-- Аватарка -->
        <div class="avatar-section">
          <div class="avatar-container">
            <q-avatar size="120px" class="avatar-img">
              <img v-if="avatarUrl" :src="avatarUrl" alt="Аватар" />
              <q-icon v-else name="person" size="60px" color="grey-5" />
            </q-avatar>

            <div class="avatar-actions q-mt-sm">
              <q-btn
                v-if="avatarUrl"
                flat
                dense
                icon="delete"
                color="negative"
                label="Удалить"
                size="sm"
                :loading="avatarDeleting"
                @click="handleDeleteAvatar"
              />
              <q-btn
                flat
                dense
                icon="upload"
                color="primary"
                :label="avatarUrl ? 'Заменить' : 'Загрузить'"
                size="sm"
                :loading="avatarUploading"
                @click="triggerFileInput"
              />
            </div>

            <input
              ref="fileInputRef"
              type="file"
              accept=".jpg,.jpeg,.png,.webp"
              style="display: none"
              @change="handleAvatarFileSelected"
            />
          </div>
        </div>

        <!-- Информация -->
        <div class="info-section">
          <div class="row q-col-gutter-md">
            <div class="col-12">
              <q-input
                :model-value="user.auth_email"
                label="Email"
                filled
                readonly
                hide-bottom-space
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="user.person_id != null ? String(user.person_id) : '—'"
                label="Person ID"
                filled
                readonly
                hide-bottom-space
              />
            </div>
            <div class="col-12 col-sm-6">
              <q-input
                :model-value="user.created_at ? new Date(user.created_at).toLocaleString('ru-RU') : '—'"
                label="Создан"
                filled
                readonly
                hide-bottom-space
              />
            </div>
          </div>

          <div class="row q-col-gutter-md q-mt-sm">
            <div class="col-auto">
              <q-toggle
                :model-value="user.has_access"
                label="Доступ"
                :disable="!!user.deleted_at"
                color="primary"
                @update:model-value="handleToggleAccess"
              />
            </div>
            <div class="col-auto">
              <q-badge v-if="user.is_admin" color="purple" class="self-center">Admin</q-badge>
            </div>
          </div>
        </div>

      </div>
    </template>
  </EntityDetailPage>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useQuasar } from 'quasar'
import EntityDetailPage from '@/shared/ui/EntityDetailPage.vue'
import { userApi } from '@/shared/api'
import type { User } from '@/shared/api/user'

const router = useRouter()
const route = useRoute()
const $q = useQuasar()

const user = ref<User | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)

const avatarUrl = ref<string | null>(null)
const avatarUploading = ref(false)
const avatarDeleting = ref(false)
const fileInputRef = ref<HTMLInputElement | null>(null)
let avatarObjectUrl: string | null = null

const clearAvatarObjectUrl = () => {
  if (avatarObjectUrl) {
    URL.revokeObjectURL(avatarObjectUrl)
    avatarObjectUrl = null
  }
}

const loadAvatarBlob = async (userId: number, cacheBuster?: string) => {
  try {
    clearAvatarObjectUrl()
    const blob = await userApi.getAvatarContentBlob(userId, cacheBuster)
    avatarObjectUrl = URL.createObjectURL(blob)
    avatarUrl.value = avatarObjectUrl
  } catch {
    avatarUrl.value = null
  }
}

const loadUser = async (
  options: {
    showPageLoader?: boolean
    avatarCacheBuster?: string
  } = {}
) => {
  const { showPageLoader = false, avatarCacheBuster } = options
  const userId = Number(route.params.id)
  if (isNaN(userId)) { error.value = 'Некорректный ID'; return }

  if (showPageLoader) {
    loading.value = true
  }
  error.value = null
  try {
    user.value = await userApi.getById(userId)
    if (user.value?.avatar_id) {
      await loadAvatarBlob(
        userId,
        avatarCacheBuster ?? user.value.avatar?.updated_at ?? user.value.updated_at ?? String(Date.now())
      )
    } else {
      clearAvatarObjectUrl()
      avatarUrl.value = null
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке данных'
  } finally {
    if (showPageLoader) {
      loading.value = false
    }
  }
}

const triggerFileInput = () => {
  fileInputRef.value?.click()
}

const handleAvatarFileSelected = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !user.value) return

  avatarUploading.value = true
  try {
    let updatedUser: User
    if (user.value.avatar_id) {
      updatedUser = await userApi.replaceAvatar(user.value.id, file)
    } else {
      updatedUser = await userApi.uploadAvatar(user.value.id, file)
    }
    user.value = updatedUser

    $q.notify({ type: 'positive', message: 'Аватарка успешно обновлена' })
    if (updatedUser.avatar_id) {
      await loadAvatarBlob(updatedUser.id, String(Date.now()))
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Ошибка при загрузке аватарки: ' + (err instanceof Error ? err.message : String(err)) })
  } finally {
    avatarUploading.value = false
    input.value = ''
  }
}

const handleDeleteAvatar = () => {
  if (!user.value?.avatar_id) return

  const doDelete = async () => {
    avatarDeleting.value = true
    try {
      const updatedUser = await userApi.deleteAvatar(user.value!.id)
      user.value = updatedUser
      clearAvatarObjectUrl()
      avatarUrl.value = null
      $q.notify({ type: 'positive', message: 'Аватарка удалена' })
    } catch {
      $q.notify({ type: 'negative', message: 'Ошибка при удалении аватарки' })
    } finally {
      avatarDeleting.value = false
    }
  }

  $q.dialog({
    title: 'Удалить аватарку?',
    message: 'Аватарка будет удалена.',
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDelete()
  })
}

const handleToggleAccess = async (newValue: boolean) => {
  if (!user.value) return
  try {
    await userApi.update(user.value.id, { has_access: newValue })
    user.value = { ...user.value, has_access: newValue }
    $q.notify({ type: 'positive', message: `Доступ ${newValue ? 'предоставлен' : 'запрещён'}` })
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при изменении доступа' })
  }
}

const handleDelete = () => {
  if (!user.value) return

  const doDelete = async () => {
    try {
      await userApi.deleteById(user.value!.id)
      $q.notify({ type: 'positive', message: 'Пользователь удалён' })
      void router.push('/user')
    } catch {
      $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
    }
  }

  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить пользователя ${user.value.auth_email}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void doDelete()
  })
}

onMounted(() => void loadUser({ showPageLoader: true }))
onBeforeUnmount(() => {
  clearAvatarObjectUrl()
})
</script>

<style scoped lang="scss">
.user-detail-layout {
  display: flex;
  gap: 2rem;
  align-items: flex-start;

  @media (max-width: 600px) {
    flex-direction: column;
    align-items: center;
  }
}

.avatar-section {
  flex-shrink: 0;
}

.avatar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.avatar-img {
  border: 3px solid rgba(128, 128, 128, 0.25);
  background: rgba(128, 128, 128, 0.08);
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.info-section {
  flex: 1;
  min-width: 0;
}
</style>
