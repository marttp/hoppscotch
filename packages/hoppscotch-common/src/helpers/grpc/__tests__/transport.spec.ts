import type { RelayRequest, RelayResponse } from "@hoppscotch/kernel"
import * as E from "fp-ts/Either"
import { describe, expect, test, vi } from "vitest"
import { parseGRPCProtoFiles } from "../proto"
import { frameGRPCMessage } from "../framing"
import { executeGRPCUnary } from "../transport"

const PROTO = `
syntax = "proto3";
package echo.v1;

message EchoRequest { string message = 1; }
message EchoResponse { string message = 1; }
service EchoService { rpc Echo(EchoRequest) returns (EchoResponse); }
`

describe("gRPC unary transport", () => {
  test("sends a binary HTTP/2 gRPC request and decodes its response", async () => {
    const schema = await parseGRPCProtoFiles([
      { name: "echo.proto", content: PROTO },
    ])
    const method = schema.services[0].methods[0]
    const responseMessage = method.responseType
      .encode(method.responseType.fromObject({ message: "hello" }))
      .finish()
    const responseBody = frameGRPCMessage(responseMessage)
    const relayResponse: RelayResponse = {
      id: 1,
      status: 200,
      statusText: "OK",
      version: "HTTP/2.0",
      headers: {
        "content-type": "application/grpc",
        "grpc-status": "0",
        "grpc-message": "OK",
      },
      body: {
        mediaType: "application/grpc",
        body: responseBody,
      },
      meta: {
        timing: { start: 10, end: 25 },
        size: {
          headers: 20,
          body: responseBody.byteLength,
          total: 20 + responseBody.byteLength,
        },
      },
    }
    const execute = vi.fn((_request: RelayRequest) => ({
      cancel: async () => {},
      response: Promise.resolve(E.right(relayResponse)),
    }))

    const execution = executeGRPCUnary({
      baseURL: "http://localhost:8080/",
      method,
      body: method.requestType
        .encode(method.requestType.fromObject({ message: "hello" }))
        .finish(),
      metadata: [
        { key: "authorization", value: "Bearer token", active: true },
        { key: "ignored", value: "value", active: false },
      ],
      execute,
    })
    const result = await execution.response

    expect(execute).toHaveBeenCalledOnce()
    const request = execute.mock.calls[0][0]
    expect(request.url).toBe("http://localhost:8080/echo.v1.EchoService/Echo")
    expect(request.version).toBe("HTTP/2.0")
    expect(request.content.kind).toBe("binary")
    expect(request.headers["content-type"]).toBe("application/grpc")
    expect(request.headers.te).toBe("trailers")
    expect(request.headers.authorization).toBe("Bearer token")
    expect(request.headers.ignored).toBeUndefined()
    expect(E.isRight(result)).toBe(true)
    if (E.isRight(result)) {
      expect(JSON.parse(result.right.message)).toEqual({ message: "hello" })
      expect(result.right.status).toBe(0)
      expect(result.right.duration).toBe(15)
    }
  })

  test("returns a decoded gRPC status error", async () => {
    const schema = await parseGRPCProtoFiles([
      { name: "echo.proto", content: PROTO },
    ])
    const method = schema.services[0].methods[0]
    const responseBody = new Uint8Array()
    const relayResponse = {
      id: 1,
      status: 200,
      statusText: "OK",
      version: "HTTP/2.0",
      headers: {
        "content-type": "application/grpc",
        "grpc-status": "7",
        "grpc-message": "permission%20denied",
      },
      body: { mediaType: "application/grpc", body: responseBody },
      meta: {
        timing: { start: 0, end: 1 },
        size: {
          headers: 0,
          body: responseBody.byteLength,
          total: responseBody.byteLength,
        },
      },
    } satisfies RelayResponse

    const result = await executeGRPCUnary({
      baseURL: "http://localhost:8080",
      method,
      body: new Uint8Array(),
      metadata: [],
      execute: () => ({
        cancel: async () => {},
        response: Promise.resolve(E.right(relayResponse)),
      }),
    }).response

    expect(E.isLeft(result)).toBe(true)
    if (E.isLeft(result)) {
      expect(result.left).toBeInstanceOf(Error)
      expect((result.left as Error).message).toBe(
        "PERMISSION_DENIED: permission denied"
      )
    }
  })
})
