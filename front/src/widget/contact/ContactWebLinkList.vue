<template>
  <div class="contact-weblink-list">
    <div class="list-header">
      <div class="list-title">Веб-ссылки</div>
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
      <q-btn flat dense label="Повторить" @click="loadWebLinks" />
    </div>

    <div v-else-if="!loading && displayedWebLinks.length === 0" class="empty-state">
      <q-icon name="link" size="32px" color="grey-5" />
      <div class="empty-text">Нет веб-ссылок</div>
    </div>

    <q-list v-else class="weblink-list">
      <q-item 
        v-for="item in displayedWebLinks" 
        :key="item.contactInfo.id" 
        clickable
        class="weblink-item"
        :class="{ 'deleted-item': !!item.contactInfo.deleted_at }"
        @click="handleEditItem(item)"
      >
        <q-item-section avatar class="weblink-icon" @click.stop="openLink(item.webLink.url)">
          <q-icon name="link" :color="item.contactInfo.deleted_at ? 'grey' : 'primary'" size="20px" style="cursor: pointer" />
        </q-item-section>

        <q-item-section>
          <q-item-label class="weblink-url">
            {{ item.webLink.title || item.webLink.url }}
            <q-badge v-if="item.contactInfo.is_primary" color="primary" label="Основная" class="q-ml-sm" />
            <q-badge v-if="item.contactInfo.deleted_at" color="grey" label="Удалена" class="q-ml-sm" />
          </q-item-label>
          <q-item-label v-if="item.webLink.title" caption class="weblink-title">
            {{ item.webLink.url }}
          </q-item-label>
          <q-item-label v-if="item.contactInfo.description" caption class="weblink-description">
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

    <ContactWebLinkDialog ref="addDialogRef" v-model="showAddDialog" title="Добавить ссылку" @save="handleSaveWebLink" />
    <ContactWebLinkDialog ref="editDialogRef" v-model="showEditDialog" title="Редактировать ссылку" :initial-data="editingWebLink" @save="handleUpdateWebLink" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useQuasar } from 'quasar'
import { contactInfoApi, webLinkApi } from '@/shared/api'
import type { ContactInfo, WebLink } from '@/shared/api'
import ContactWebLinkDialog from './ContactWebLinkDialog.vue'

interface WebLinkItem {
  contactInfo: ContactInfo
  webLink: WebLink
}

interface WebLinkFormData {
  url: string
  title: string
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
const webLinks = ref<WebLink[]>([])
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const showDeleted = ref(false)
const editingWebLink = ref<WebLinkFormData | null>(null)
const editingItem = ref<WebLinkItem | null>(null)
const addDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)
const editDialogRef = ref<{ setSaving: (v: boolean) => void; close: () => void } | null>(null)

const webLinkItems = computed<WebLinkItem[]>(() => {
  return contactInfos.value
    .filter((ci: ContactInfo) => ci.web_link_id !== null)
    .map((ci: ContactInfo) => {
      const webLink = webLinks.value.find((wl: WebLink) => wl.id === ci.web_link_id)
      return webLink ? { contactInfo: ci, webLink } : null
    })
    .filter((item): item is WebLinkItem => item !== null)
})

const displayedWebLinks = computed<WebLinkItem[]>(() => {
  if (showDeleted.value) return webLinkItems.value
  return webLinkItems.value.filter((item: WebLinkItem) => !item.contactInfo.deleted_at)
})

const loadWebLinks = async () => {
  loading.value = true
  error.value = null
  try {
    const allContactInfos = await contactInfoApi.list()
    contactInfos.value = allContactInfos.filter((ci: ContactInfo) => 
      props.personId && ci.person_id === props.personId
    )
    
    const webLinkIds = contactInfos.value.map((ci: ContactInfo) => ci.web_link_id).filter((id): id is number => id !== null)
    
    if (webLinkIds.length > 0) {
      webLinks.value = await webLinkApi.list()
      webLinks.value = webLinks.value.filter((wl: WebLink) => webLinkIds.includes(wl.id))
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Ошибка при загрузке ссылок'
  } finally {
    loading.value = false
  }
}

const handleAdd = () => { showAddDialog.value = true }

const handleEditItem = (item: WebLinkItem) => {
  editingItem.value = item
  editingWebLink.value = {
    url: item.webLink.url,
    title: item.webLink.title || '',
    description: item.contactInfo.description || '',
    is_primary: item.contactInfo.is_primary
  }
  showEditDialog.value = true
}

const handleSaveWebLink = async (data: WebLinkFormData) => {
  if (!addDialogRef.value) return
  addDialogRef.value.setSaving(true)
  try {
    const webLink = await webLinkApi.create({
      url: data.url,
      title: data.title || null,
      type_id: 1
    })
    await contactInfoApi.create({
      person_id: props.personId || null,
      web_link_id: webLink.id,
      description: data.description || null,
      is_primary: data.is_primary
    })
    $q.notify({ type: 'positive', message: 'Ссылка успешно добавлена' })
    addDialogRef.value.close()
    await loadWebLinks()
    emit('update')
  } catch (err) {
    $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Ошибка при добавлении ссылки' })
  } finally {
    addDialogRef.value.setSaving(false)
  }
}

const handleUpdateWebLink = async (data: WebLinkFormData) => {
  if (!editDialogRef.value || !editingItem.value) return
  editDialogRef.value.setSaving(true)
  try {
    await webLinkApi.update(editingItem.value.webLink.id, {
      url: data.url,
      title: data.title || null
    })
    await contactInfoApi.update(editingItem.value.contactInfo.id, {
      description: data.description || null,
      is_primary: data.is_primary
    })
    $q.notify({ type: 'positive', message: 'Ссылка успешно обновлена' })
    editDialogRef.value.close()
    await loadWebLinks()
    emit('update')
  } catch (err) {
    $q.notify({ type: 'negative', message: err instanceof Error ? err.message : 'Ошибка при обновлении ссылки' })
  } finally {
    editDialogRef.value.setSaving(false)
  }
}

const handleDelete = (item: WebLinkItem) => {
  $q.dialog({
    title: 'Подтверждение удаления',
    message: `Удалить ссылку ${item.webLink.title || item.webLink.url}?`,
    cancel: true,
    persistent: true,
  }).onOk(() => {
    void (async () => {
      try {
        await contactInfoApi.deleteById(item.contactInfo.id)
        $q.notify({ type: 'positive', message: 'Ссылка успешно удалена' })
        await loadWebLinks()
        emit('update')
      } catch {
        $q.notify({ type: 'negative', message: 'Ошибка при удалении' })
      }
    })()
  })
}

const handleRestore = async (item: WebLinkItem) => {
  try {
    await contactInfoApi.update(item.contactInfo.id, { deleted_at: null })
    $q.notify({ type: 'positive', message: 'Ссылка успешно восстановлена' })
    await loadWebLinks()
    emit('update')
  } catch {
    $q.notify({ type: 'negative', message: 'Ошибка при восстановлении' })
  }
}

const openLink = (url: string) => { window.open(url, '_blank') }

const openAddDialog = () => { showAddDialog.value = true }

defineExpose({ openAddDialog })

onMounted(() => { void loadWebLinks() })
</script>

<style scoped lang="scss">
.contact-weblink-list { padding: 0; }
.list-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; padding: 0.5rem 0; }
.list-title { font-size: 1rem; font-weight: 500; }
.error-message { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; color: var(--q-negative); }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem 1rem; text-align: center; }
.empty-text { margin-top: 0.5rem; color: var(--q-grey-6); font-size: 0.9rem; }
.weblink-list { border: none; }
.weblink-item { padding: 0.5rem 0; min-height: auto; border-radius: 8px; margin: 0 -0.75rem; padding-left: 0.75rem; padding-right: 0.75rem; &:hover { background-color: rgba(0, 0, 0, 0.05); } }
.weblink-icon { cursor: pointer; &:hover { opacity: 0.7; } }
.deleted-item { opacity: 0.6; }
.weblink-url { font-size: 0.95rem; font-weight: 500; display: flex; align-items: center; }
.weblink-title, .weblink-description { font-size: 0.85rem; margin-top: 0.125rem; }
</style>
