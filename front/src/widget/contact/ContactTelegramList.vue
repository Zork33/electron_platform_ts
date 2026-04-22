<template>
  <div class="contact-telegram-list">
    <div class="list-header">
      <div class="list-title">Telegram</div>
      <q-space />
      <q-btn flat dense round icon="more_vert" size="sm">
        <q-menu>
          <q-list dense>
            <q-item clickable v-close-popup @click="handleAdd">
              <q-item-section avatar>
                <q-icon name="add" size="18px" />
              </q-item-section>
              <q-item-section>Добавить</q-item-section>
            </q-item>
            <q-item clickable v-close-popup @click="showDeleted = !showDeleted">
              <q-item-section avatar>
                <q-icon :name="showDeleted ? 'visibility_off' : 'visibility'" size="18px" />
              </q-item-section>
              <q-item-section>{{ showDeleted ? 'Скрыть удалённые' : 'Показать удалённые' }}</q-item-section>
            </q-item>
          </q-list>
        </q-menu>
      </q-btn>
    </div>

    <q-linear-progress v-if="loading" indeterminate color="primary" />

    <div v-if="error" class="error-message">
      <q-icon name="error" color="negative" size="20px" />
      <span>{{ error }}</span>
      <q-btn flat dense label="Повторить" @click="loadTelegrams" />
    </div>

    <div v-else-if="!loading && displayedTelegrams.length === 0" class="empty-state">
      <q-icon name="telegram" size="32px" color="grey-5" />
      <div class="empty-text">Нет Telegram аккаунтов</div>
    </div>

    <q-list v-else class="telegram-list">
      <q-item 
        v-for="item in displayedTelegrams" 
        :key="item.contactInfo.id" 
        clickable
        class="telegram-item"
        :class="{ 'deleted-item': !!item.contactInfo.deleted_at }"
        @click="handleEditItem(item)"
      >
        <q-item-section avatar class="telegram-icon" @click.stop="openTelegram(item.tgAcc.username)">
          <q-icon name="telegram" :color="item.contactInfo.deleted_at ? 'grey' : 'primary'" size="20px" style="cursor: pointer" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="telegram-username">
            @{{ item.tgAcc.username }}
            <q-badge v-if="item.contactInfo.is_primary" color="primary" label="Основной" class="q-ml-sm" />
            <q-badge v-if="item.contactInfo.deleted_at" color="grey" label="Удалён" class="q-ml-sm" />
          </q-item-label>
          <q-item-label v-if="item.tgAcc.first_name || item.tgAcc.last_name" caption class="telegram-name">
            {{ [item.tgAcc.first_name, item.tgAcc.last_name].filter(Boolean).join(' ') }}
          </q-item-label>
          <q-item-label v-if="item.contactInfo.description" caption class="telegram-description">
            {{ item.contactInfo.description }}
          </q-item-label>
        </q-item-section>

        <q-item-section side>
          <q-btn flat dense round icon="more_vert" size="sm" @click.stop>
            <q-menu>
              <q-list dense>
                <q-item clickable v-close-popup @click="handleEditItem(item)">
                  <q-item-section avatar><q-icon name="edit" size="18px" /></q-item-section>
                  <q-item-section>Редактировать</q-item-section>
                </q-item>
                <q-item v-if="!item.contactInfo.deleted_at" clickable v-close-popup @click="handleDelete(item)">
                  <q-item-section avatar><q-icon name="delete" color="negative" size="18px" /></q-item-section>
                  <q-item-section>Удалить</q-item-section>
                </q-item>
                <q-item v-else clickable v-close-popup @click="handleRestore(item)">
                  <q-item-section avatar><q-icon name="restore" color="positive" size="18px" /></q-item-section>
                  <q-item-section>Восстановить</q-item-section>
                </q-item>
              </q-list>
            </q-menu>
          </q-btn>
        </q-item-section>
      </q-item>
    </q-list>

    <ContactTelegramDialog ref="addDialogRef" v-model="showAddDialog" title="Добавить Telegram" @save="handleSaveTelegram" />
    <ContactTelegramDialog ref="editDialogRef" v-model="showEditDialog" title="Редактировать Telegram" :initial-data="editingTelegram" @save="handleUpdateTelegram" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { contactInfoApi, tgAccApi } from '@/shared/api'
import type { ContactInfo, TgAcc } from '@/shared/api'
import ContactTelegramDialog from './ContactTelegramDialog.vue'

interface TelegramItem {
  contactInfo: ContactInfo
  tgAcc: TgAcc
}

interface TelegramFormData {
  username: string
  first_name: string
  last_name: string
  description: string
  is_primary: boolean
}

const props = defineProps<{
  personId?: number | undefined
}>()

const emit = defineEmits<{
  update: []
}>()

const $q = useQuasar()
const loading = ref(false)
const error = ref<string | null>(null)
const contactInfos = ref<ContactInfo[]>([])
const tgAccs = ref<TgAcc[]>([])
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleted = ref(false)
const editingTelegram = ref<TelegramFormData | null>(null)
const editingItem = ref<TelegramItem | null>(null)
const addDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)
const editDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)

const telegramItems = computed<TelegramItem[]>(() => {
  return contactInfos.value
    .filter((ci: ContactInfo) => ci.tg_acc_id !== null)
    .map((ci: ContactInfo) => {
      const tgAcc = tgAccs.value.find((tg: TgAcc) => tg.id === ci.tg_acc_id)
      return tgAcc ? { contactInfo: ci, tgAcc } : null
    })
    .filter((item): item is TelegramItem => item !== null)
})

const displayedTelegrams = computed<TelegramItem[]>(() => {
  if (showDeleted.value) return telegramItems.value
  return telegramItems.value.filter((item: TelegramItem) => !item.contactInfo.deleted_at)
})

const loadTelegrams = async () => {
  loading.value = true
  error.value = null
  try {
    const allContactInfos = await contactInfoApi.list()
    contactInfos.value = allContactInfos.filter((ci: ContactInfo) => 
      props.personId && ci.person_id === props.personId
    )
    
    const tgAccIds = contactInfos.value.map((ci: ContactInfo) => ci.tg_acc_id).filter((id): id is number => id !== null)
    
    if (tgAccIds.length > 0) {
      tgAccs.value = await tgAccApi.list()
      tgAccs.value = tgAccs.value.filter((tg: TgAcc) => tgAccIds.includes(tg.id))
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке Telegram'
  } finally {
    loading.value = false
  }
}

const handleAdd = () => { showAddDialog.value = true }

const handleEditItem = (item: TelegramItem) => {
  editingItem.value = item
  editingTelegram.value = {
    username: item.tgAcc.username || '',
    first_name: item.tgAcc.first_name || '',
    last_name: item.tgAcc.last_name || '',
    description: item.contactInfo.description || '',
    is_primary: item.contactInfo.is_primary
  }
  showEditDialog.value = true
}

const handleSaveTelegram = async (data: TelegramFormData) => {
  if (!addDialogRef.value) return
  addDialogRef.value.setSaving(true)
  try {
    const tgAcc = await tgAccApi.create({
      username: data.username,
      first_name: data.first_name || null,
      last_name: data.last_name || null
    })
    await contactInfoApi.create({
      person_id: props.personId || null,
      tg_acc_id: tgAcc.id,
      description: data.description || null,
      is_primary: data.is_primary
    })
    $q.notify({ type: 'positive', message: 'Telegram успешно добавлен' })
    addDialogRef.value.close()
    await loadTelegrams()
    emit('update')
  } catch (err) {
    $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Ошибка при добавлении Telegram' })
  } finally {
    addDialogRef.value.setSaving(false)
  }
}

const handleUpdateTelegram = async (data: TelegramFormData) => {
  if (!editDialogRef.value || !editingItem.value) return
  editDialogRef.value.setSaving(true)
  try {
    await tgAccApi.update(editingItem.value.tgAcc.id, {
      username: data.username,
      first_name: data.first_name || null,
      last_name: data.last_name || null
    })
    await contactInfoApi.update(editingItem.value.contactInfo.id, {
      description: data.description || null,
      is_primary: data.is_primary
    })
    $q.notify({ type: 'positive', message: 'Telegram успешно обновлён' })
    editDialogRef.value.close()
    await loadTelegrams()
    emit('update')
  } catch (err) {
    $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Ошибка при обновлении Telegram' })
  } finally {
    editDialogRef.value.setSaving(false)
  }
}

const handleDelete = (item: TelegramItem) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить Telegram @${item.tgAcc.username}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await contactInfoApi.deleteById(item.contactInfo.id)
        $q.notify({ type: 'positive', message: 'Telegram успешно удалён' })
        await loadTelegrams()
        emit('update')
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
      }
    })()
  })
}

const handleRestore = async (item: TelegramItem) => {
  try {
    await contactInfoApi.update(item.contactInfo.id, { deleted_at: null })
    $q.notify({ type: 'positive', message: 'Telegram успешно восстановлен' })
    await loadTelegrams()
    emit('update')
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при восстановлении' })
  }
}

const openTelegram = (username: string | null) => {
  if (username) window.open(`https://t.me/${username}`, '_blank')
}

const openAddDialog = () => { showAddDialog.value = true }

defineExpose({ openAddDialog })

onMounted(() => { void loadTelegrams() })
</script>

<style scoped lang="scss">
.contact-telegram-list { padding: 0; }
.list-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem 0; }
.list-title { font-size: 1rem; font-weight: 500; }
.error-message { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; color: var(--q-negative); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center; }
.empty-text { margin-top: 0.5rem; color: var(--q-grey-6); font-size: 0.9rem; }
.telegram-list { border: none; }
.telegram-item { padding: 0.5rem 0; min-height: auto; border-radius: 8px; margin: 0 -0.75rem; padding-left: 0.75rem; padding-right: 0.75rem; &:hover { background-color: rgba(0, 0, 0, 0.05); } }
.telegram-icon { cursor: pointer; &:hover { opacity: 0.7; } }
.deleted-item { opacity: 0.6; }
.telegram-username { font-size: 0.95rem; font-weight: 500; display: flex; align-items: center; }
.telegram-name, .telegram-description { font-size: 0.85rem; margin-top: 0.125rem; }
</style>
