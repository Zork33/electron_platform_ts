<template>
  <div class="markdown-editor-wrapper">
    <div v-if="label || showToggle" class="markdown-editor-header">
      <div v-if="label" class="text-caption">{{ label }}</div>
      <q-btn
        v-if="showToggle"
        flat
        dense
        round
        size="xs"
        :icon="isEditing ? 'visibility' : 'edit'"
        @click="toggleEditing"
      />
    </div>
    <template v-if="!isEditing">
      <MdPreview
        v-if="internalValue"
        :model-value="internalValue"
        :theme="editorTheme"
        v-bind="language ? { language } : {}"
      />
      <div v-else class="markdown-editor-empty" />
    </template>
    <MdEditor
      v-else
      v-model="internalValue"
      v-bind="editorProps"
      :style="editorStyle"
      @on-change="handleChange"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useQuasar } from 'quasar'
import { MdEditor, MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'

interface Props {
  modelValue: string
  label?: string
  language?: 'en-US' | 'ru-RU' | 'zh-CN'
  theme?: 'light' | 'dark' | 'auto'
  preview?: boolean
  editing?: boolean
  showToggle?: boolean
  placeholder?: string
  height?: string | number
  minHeight?: string | number
  maxHeight?: string | number
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: '',
  language: 'en-US',
  theme: 'auto',
  preview: false,
  editing: false,
  showToggle: true,
  placeholder: '',
  height: '500px',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:editing': [value: boolean]
  'change': [value: string]
}>()

const $q = useQuasar()

const internalValue = ref(props.modelValue)
const isEditing = ref(props.editing)

watch(() => props.modelValue, (newValue) => {
  if (newValue !== internalValue.value) {
    internalValue.value = newValue
  }
})

watch(() => props.editing, (val) => {
  isEditing.value = val
})

const toggleEditing = () => {
  isEditing.value = !isEditing.value
  emit('update:editing', isEditing.value)
}

const editorTheme = computed(() => {
  if (props.theme === 'auto') {
    return $q.dark.isActive ? 'dark' : 'light'
  }
  return props.theme
})

const editorProps = computed(() => {
  const result: Record<string, string | boolean> = {
    theme: editorTheme.value,
  }

  if (props.language !== undefined) {
    result.language = props.language
  }

  if (props.preview !== undefined) {
    result.preview = props.preview
  }

  if (props.placeholder !== undefined) {
    result.placeholder = props.placeholder
  }

  return result
})

const editorStyle = computed(() => {
  const styles: Record<string, string> = {}

  if (props.height) {
    styles.height = typeof props.height === 'number' ? `${props.height}px` : props.height
  }

  if (props.minHeight) {
    styles.minHeight = typeof props.minHeight === 'number' ? `${props.minHeight}px` : props.minHeight
  }

  if (props.maxHeight) {
    styles.maxHeight = typeof props.maxHeight === 'number' ? `${props.maxHeight}px` : props.maxHeight
  }

  return styles
})

const handleChange = (value: string) => {
  internalValue.value = value
  emit('update:modelValue', value)
  emit('change', value)
}
</script>

<style lang="scss" scoped>
.markdown-editor-wrapper {
  width: 100%;
  border: 1px solid rgba(0, 0, 0, 0.24);
  border-radius: 4px;
  padding: 12px;

  .body--dark & {
    border-color: rgba(255, 255, 255, 0.28);
  }

  :deep(.md-editor) {
    border-radius: 4px;

    .body--dark & {
      border-color: rgba(255, 255, 255, 0.28);
    }
  }

  :deep(.md-editor-previewOnly) {
    background-color: transparent !important;
    padding: 0 !important;
  }
}

.markdown-editor-header {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  opacity: 0.7;
}

.markdown-editor-empty {
  padding: 16px 0;
}
</style>
