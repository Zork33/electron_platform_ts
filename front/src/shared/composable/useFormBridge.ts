/**
 * Composable для связи контейнера (EntityDetailPage, q-dialog) с редактором формы.
 * Контейнер вызывает requestSave/requestDelete, редактор регистрирует обработчики.
 * Ни одна сторона не знает о другой — только об интерфейсе моста.
 */
import { ref, type Ref } from 'vue'

export interface FormBridge {
  saving: Ref<boolean>
  canSave: Ref<boolean>
  setSaving: (v: boolean) => void
  setCanSave: (v: boolean) => void
  onSave: (handler: () => Promise<void> | void) => void
  onDelete: (handler: () => Promise<void> | void) => void
  requestSave: () => Promise<void>
  requestDelete: () => Promise<void>
}

export function useFormBridge(): FormBridge {
  const saving = ref(false)
  const canSave = ref(true)

  let saveHandler: (() => Promise<void> | void) | null = null
  let deleteHandler: (() => Promise<void> | void) | null = null

  return {
    saving,
    canSave,

    setSaving(v: boolean) {
      saving.value = v
    },

    setCanSave(v: boolean) {
      canSave.value = v
    },

    onSave(handler: () => Promise<void> | void) {
      saveHandler = handler
    },

    onDelete(handler: () => Promise<void> | void) {
      deleteHandler = handler
    },

    async requestSave() {
      if (!saveHandler) return
      saving.value = true
      try {
        await saveHandler()
      } finally {
        saving.value = false
      }
    },

    // requestDelete не управляет saving — обработчик делает это сам через setSaving,
    // потому что удаление может ждать подтверждения в диалоге
    async requestDelete() {
      if (!deleteHandler) return
      await deleteHandler()
    },
  }
}
