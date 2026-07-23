import { debounce } from "lodash-es"
import {
  onScopeDispose,
  shallowRef,
  watch,
  type Ref,
  type ShallowRef,
} from "vue"

export type GRPCRequestBodyBuffer = {
  editorValue: ShallowRef<string | undefined>
  flushEditorValue: () => void
}

/**
 * Keeps CodeMirror edits local while the user is actively typing.
 *
 * The gRPC request is part of the persisted tab graph and may contain multiple
 * proto sources. Updating that graph for every keystroke needlessly schedules
 * persistence work. A trailing commit keeps typing local, while blur/actions
 * can flush synchronously before the request is used.
 */
export function useGRPCRequestBodyBuffer(
  body: Ref<string>,
  wait = 150
): GRPCRequestBodyBuffer {
  const editorValue = shallowRef<string | undefined>(body.value)
  const commitEditorValue = debounce((value: string | undefined) => {
    if (value !== undefined && value !== body.value) body.value = value
  }, wait)

  watch(body, (newValue) => {
    if (newValue !== editorValue.value) {
      commitEditorValue.cancel()
      editorValue.value = newValue
    }
  })

  watch(editorValue, (newValue) => {
    if (newValue !== undefined && newValue !== body.value) {
      commitEditorValue(newValue)
    }
  })

  const flushEditorValue = () => {
    commitEditorValue.flush()
  }

  onScopeDispose(() => {
    commitEditorValue.flush()
    commitEditorValue.cancel()
  })

  return {
    editorValue,
    flushEditorValue,
  }
}
