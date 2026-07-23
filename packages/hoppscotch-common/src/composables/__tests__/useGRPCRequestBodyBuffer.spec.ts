import { effectScope, nextTick, ref, watch, type Ref } from "vue"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useGRPCRequestBodyBuffer } from "../useGRPCRequestBodyBuffer"

describe("useGRPCRequestBodyBuffer", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("consolidates a rapid typing burst into one model update", async () => {
    vi.useFakeTimers()
    const body = ref("{}")
    const updates: string[] = []
    const scope = effectScope()
    const buffer = scope.run(() => useGRPCRequestBodyBuffer(body, 150))!

    body.value = "{}"
    const stopWatching = scope.run(() =>
      watchBody(body, (value) => updates.push(value))
    )!

    buffer.editorValue.value = "{"
    await nextTick()
    buffer.editorValue.value = '{ "title"'
    await nextTick()
    buffer.editorValue.value = '{ "title": "" }'
    await nextTick()

    expect(body.value).toBe("{}")
    expect(updates).toEqual([])

    await vi.advanceTimersByTimeAsync(150)

    expect(body.value).toBe('{ "title": "" }')
    expect(updates).toEqual(['{ "title": "" }'])

    stopWatching()
    scope.stop()
  })

  it("flushes the latest editor value synchronously", async () => {
    vi.useFakeTimers()
    const body = ref("{}")
    const scope = effectScope()
    const buffer = scope.run(() => useGRPCRequestBodyBuffer(body, 150))!

    buffer.editorValue.value = '{ "isbn": "" }'
    await nextTick()
    buffer.flushEditorValue()

    expect(body.value).toBe('{ "isbn": "" }')
    scope.stop()
  })
})

function watchBody(body: Ref<string>, onChange: (value: string) => void) {
  return watch(body, onChange)
}
