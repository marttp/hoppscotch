<script setup lang="ts">
import type { GRPCProtoFile } from "@hoppscotch/data"
import IconTrash from "~icons/lucide/trash-2"

const props = defineProps<{
  modelValue: GRPCProtoFile[]
  error?: string
  loading?: boolean
}>()
const emit = defineEmits<{
  (event: "update:modelValue", value: GRPCProtoFile[]): void
}>()

const importFiles = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  const imported = await Promise.all(
    files.map(async (file) => ({
      name: file.webkitRelativePath || file.name,
      content: await file.text(),
    }))
  )
  const merged = new Map(props.modelValue.map((file) => [file.name, file]))
  imported.forEach((file) => merged.set(file.name, file))
  emit("update:modelValue", [...merged.values()])
  input.value = ""
}

const removeFile = (name: string) =>
  emit(
    "update:modelValue",
    props.modelValue.filter((file) => file.name !== name)
  )
</script>

<template>
  <div class="flex h-full flex-col gap-3 p-4">
    <label
      class="inline-flex w-fit cursor-pointer rounded bg-accent px-4 py-2 text-accentContrast"
    >
      Import .proto files
      <input
        class="hidden"
        type="file"
        accept=".proto"
        multiple
        @change="importFiles"
      />
    </label>
    <p class="text-secondaryLight">
      Import every local dependency used by your root proto.
    </p>
    <p v-if="loading" class="text-secondaryLight">Parsing proto files…</p>
    <p v-if="error" class="text-red-500">{{ error }}</p>
    <div
      v-for="file in modelValue"
      :key="file.name"
      class="flex items-center border-b border-divider py-2"
    >
      <span class="flex-1 truncate">{{ file.name }}</span>
      <HoppButtonSecondary
        :icon="IconTrash"
        title="Remove proto"
        @click="removeFile(file.name)"
      />
    </div>
  </div>
</template>
