<script setup lang="ts">
import type {
  GRPCMethodDefinition,
  GRPCServiceDefinition,
} from "~/helpers/grpc"
import IconSend from "~icons/lucide/send"
import IconX from "~icons/lucide/x"

defineProps<{
  url: string
  service: string
  method: string
  services: GRPCServiceDefinition[]
  methods: GRPCMethodDefinition[]
  loading: boolean
}>()

defineEmits<{
  (event: "update:url", value: string): void
  (event: "update:service", value: string): void
  (event: "update:method", value: string): void
  (event: "send"): void
  (event: "cancel"): void
}>()
</script>

<template>
  <div class="flex min-h-[4rem] items-center gap-2 border-b border-divider p-2">
    <input
      :value="url"
      class="flex-1 bg-primaryLight px-4 py-2 text-secondaryDark"
      placeholder="http://localhost:8080"
      aria-label="gRPC server URL"
      @input="$emit('update:url', ($event.target as HTMLInputElement).value)"
      @keydown.enter="$emit('send')"
    />
    <select
      :value="service"
      class="max-w-56 bg-primaryLight px-3 py-2"
      aria-label="Service"
      @change="
        $emit('update:service', ($event.target as HTMLSelectElement).value)
      "
    >
      <option value="" disabled>Service</option>
      <option v-for="item in services" :key="item.name" :value="item.name">
        {{ item.name }}
      </option>
    </select>
    <select
      :value="method"
      class="max-w-48 bg-primaryLight px-3 py-2"
      aria-label="Method"
      @change="
        $emit('update:method', ($event.target as HTMLSelectElement).value)
      "
    >
      <option value="" disabled>Method</option>
      <option
        v-for="item in methods"
        :key="item.methodName"
        :value="item.methodName"
        :disabled="item.requestStream || item.responseStream"
      >
        {{ item.methodName
        }}{{ item.requestStream || item.responseStream ? " (streaming)" : "" }}
      </option>
    </select>
    <HoppButtonPrimary
      v-if="!loading"
      label="Invoke"
      :icon="IconSend"
      :disabled="!service || !method"
      @click="$emit('send')"
    />
    <HoppButtonSecondary
      v-else
      label="Cancel"
      :icon="IconX"
      @click="$emit('cancel')"
    />
  </div>
</template>
