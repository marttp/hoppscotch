import { getDefaultGRPCRequest } from "@hoppscotch/data"
import * as E from "fp-ts/Either"
import { ref } from "vue"
import { describe, expect, it, vi } from "vitest"
import type { HoppGRPCDocument } from "~/helpers/grpc/document"

const interceptor = vi.hoisted(() => ({
  execute: vi.fn(),
  current: {
    value: {
      capabilities: {
        content: new Set(["binary"]),
        advanced: new Set(["http2"]),
      },
    },
  },
}))
const executeMock = interceptor.execute

vi.mock("dioc/vue", () => ({
  useService: () => interceptor,
}))

vi.mock("~/helpers/utils/environments", () => ({
  getCombinedEnvVariables: () => ({
    temp: [],
    selected: [],
    global: [],
  }),
}))

import { useGRPCRequest } from "../useGRPCRequest"

const PROTO = `
syntax = "proto3";
package echo.v1;
message EchoRequest { string message = 1; }
message EchoResponse { string message = 1; }
service EchoService { rpc Echo(EchoRequest) returns (EchoResponse); }
`

describe("useGRPCRequest", () => {
  it("keeps unary invocation and cancellation single-flight", async () => {
    let resolveExecution:
      | ((result: E.Either<"cancellation", never>) => void)
      | undefined
    const response = new Promise<E.Either<"cancellation", never>>((resolve) => {
      resolveExecution = resolve
    })
    const cancel = vi.fn(async () => {})
    executeMock.mockReturnValue({ cancel, response })

    const request = getDefaultGRPCRequest()
    request.protoFiles = [{ name: "echo.proto", content: PROTO }]
    const document = ref<HoppGRPCDocument>({
      request,
      isDirty: false,
    })
    const grpc = useGRPCRequest(document)

    await vi.waitFor(() => {
      expect(grpc.services.value).toHaveLength(1)
      expect(document.value.request.method).toBe("Echo")
    })

    const firstSend = grpc.send()
    const secondSend = grpc.send()

    expect(document.value.error).toBeNull()
    expect(executeMock).toHaveBeenCalledOnce()
    expect(grpc.isLoading.value).toBe(true)

    await grpc.cancel()
    expect(cancel).toHaveBeenCalledOnce()

    resolveExecution?.(E.left("cancellation"))
    await firstSend
    await secondSend

    expect(grpc.isLoading.value).toBe(false)
    expect(document.value.response).toBeNull()
    expect(document.value.error).toBeNull()
  })
})
