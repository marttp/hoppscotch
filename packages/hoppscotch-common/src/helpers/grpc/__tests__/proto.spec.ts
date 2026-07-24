import { describe, expect, test } from "vitest"
import {
  decodeGRPCResponseBody,
  encodeGRPCRequestBody,
  findGRPCMethod,
  getDefaultGRPCRequestBody,
  parseGRPCProtoFiles,
} from "../proto"

const SERVICE_PROTO = `
syntax = "proto3";
package echo.v1;

import "messages.proto";

service EchoService {
  rpc Echo(EchoRequest) returns (EchoResponse);
  rpc Watch(EchoRequest) returns (stream EchoResponse);
}
`

const MESSAGES_PROTO = `
syntax = "proto3";
package echo.v1;

message EchoRequest {
  string message = 1;
}

message EchoResponse {
  string message = 1;
  int64 sequence = 2;
}
`

describe("gRPC proto parsing and codec", () => {
  test("resolves imported messages and service methods", async () => {
    const schema = await parseGRPCProtoFiles([
      { name: "echo.proto", content: SERVICE_PROTO },
      { name: "messages.proto", content: MESSAGES_PROTO },
    ])

    expect(schema.services.map((service) => service.name)).toEqual([
      "echo.v1.EchoService",
    ])
    expect(
      schema.services[0].methods.map((method) => method.methodName)
    ).toEqual(["Echo", "Watch"])
    expect(schema.services[0].methods[1].responseStream).toBe(true)
  })

  test("prefers relative paths when duplicate basenames exist", async () => {
    const schema = await parseGRPCProtoFiles([
      {
        name: "services/echo.proto",
        content: SERVICE_PROTO.replace(
          'import "messages.proto";',
          'import "../types/messages.proto";'
        ),
      },
      { name: "types/messages.proto", content: MESSAGES_PROTO },
      {
        name: "legacy/messages.proto",
        content: MESSAGES_PROTO.replaceAll("Echo", "Legacy"),
      },
    ])

    const method = findGRPCMethod(schema, "echo.v1.EchoService", "Echo")
    expect(method?.requestType.name).toBe("EchoRequest")
  })

  test("encodes JSON and decodes protobuf with JSON-safe int64 values", async () => {
    const schema = await parseGRPCProtoFiles([
      { name: "echo.proto", content: SERVICE_PROTO },
      { name: "messages.proto", content: MESSAGES_PROTO },
    ])
    const method = findGRPCMethod(schema, "echo.v1.EchoService", "Echo")!

    expect(getDefaultGRPCRequestBody(method.requestType)).toBe(
      '{\n  "message": ""\n}'
    )

    const encodedRequest = encodeGRPCRequestBody(
      method.requestType,
      '{\n\u00a0 "message": "hello"\n}'
    )
    expect(method.requestType.decode(encodedRequest).message).toBe("hello")

    const responseBytes = method.responseType
      .encode(
        method.responseType.fromObject({
          message: "hello",
          sequence: "9007199254740993",
        })
      )
      .finish()
    expect(
      JSON.parse(decodeGRPCResponseBody(method.responseType, responseBytes))
    ).toEqual({
      message: "hello",
      sequence: "9007199254740993",
    })
  })
})
