<script setup lang="ts">
import type { GRPCUnaryResponse } from "~/helpers/grpc"
defineProps<{
  response?: GRPCUnaryResponse | null
  error?: string | null
  loading?: boolean
}>()
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="border-b border-divider px-4 py-3 font-semibold">Response</div>
    <div v-if="loading" class="p-4 text-secondaryLight">
      Waiting for response…
    </div>
    <div v-else-if="error" class="whitespace-pre-wrap p-4 text-red-500">
      {{ error }}
    </div>
    <template v-else-if="response">
      <div
        class="flex gap-4 border-b border-divider px-4 py-2 text-secondaryLight"
      >
        <span class="text-green-500"
          >{{ response.status }} {{ response.statusText }}</span
        >
        <span>{{ response.duration.toFixed(0) }} ms</span>
        <span>{{ response.size }} B</span>
      </div>
      <pre class="h-full overflow-auto whitespace-pre-wrap p-4 font-mono">{{
        response.message
      }}</pre>
    </template>
    <div v-else class="p-4 text-secondaryLight">
      Invoke a unary method to see its response.
    </div>
  </div>
</template>
