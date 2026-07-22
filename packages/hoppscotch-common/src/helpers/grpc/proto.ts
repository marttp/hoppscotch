import type { GRPCProtoFile } from "@hoppscotch/data"
import { NamespaceBase, Root, Service, Type } from "protobufjs"
import type {
  GRPCMethodDefinition,
  GRPCServiceDefinition,
  ParsedGRPCSchema,
} from "./types"

const normalizePath = (path: string): string => {
  const parts: string[] = []

  for (const part of path.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }

  return parts.join("/")
}

const dirname = (path: string): string => {
  const normalized = normalizePath(path)
  const separator = normalized.lastIndexOf("/")
  return separator === -1 ? "" : normalized.slice(0, separator)
}

const collectServices = (
  namespace: NamespaceBase,
  services: GRPCServiceDefinition[]
): void => {
  for (const nested of Object.values(namespace.nested ?? {})) {
    if (nested instanceof Service) {
      const serviceName = nested.fullName.replace(/^\./, "")
      const methods = Object.values(nested.methods).map(
        (method): GRPCMethodDefinition => {
          method.resolve()

          if (!(method.resolvedRequestType instanceof Type)) {
            throw new Error(
              `Unable to resolve request type for ${serviceName}.${method.name}`
            )
          }

          if (!(method.resolvedResponseType instanceof Type)) {
            throw new Error(
              `Unable to resolve response type for ${serviceName}.${method.name}`
            )
          }

          return {
            serviceName,
            methodName: method.name,
            path: `/${serviceName}/${method.name}`,
            requestStream: method.requestStream ?? false,
            responseStream: method.responseStream ?? false,
            method,
            requestType: method.resolvedRequestType,
            responseType: method.resolvedResponseType,
          }
        }
      )

      services.push({ name: serviceName, service: nested, methods })
    }

    if ("nested" in nested) {
      collectServices(nested as NamespaceBase, services)
    }
  }
}

export async function parseGRPCProtoFiles(
  protoFiles: GRPCProtoFile[]
): Promise<ParsedGRPCSchema> {
  if (protoFiles.length === 0) {
    throw new Error("Import at least one .proto file")
  }

  const files = new Map(
    protoFiles.map((file) => [normalizePath(file.name), file.content])
  )
  const root = new Root()

  root.resolvePath = (origin, target) => {
    const normalizedTarget = normalizePath(target)
    if (files.has(normalizedTarget)) return normalizedTarget

    const relativeTarget = normalizePath(`${dirname(origin)}/${target}`)
    if (files.has(relativeTarget)) return relativeTarget

    const suffixMatch = [...files.keys()].find((fileName) =>
      fileName.endsWith(`/${normalizedTarget}`)
    )

    return suffixMatch ?? normalizedTarget
  }

  root.fetch = (filename, callback) => {
    const content = files.get(normalizePath(filename))
    if (content === undefined) {
      callback(new Error(`Imported proto file not found: ${filename}`))
      return
    }

    callback(null, content)
  }

  await root.load([...files.keys()], { keepCase: true })
  root.resolveAll()

  const services: GRPCServiceDefinition[] = []
  collectServices(root, services)
  services.sort((left, right) => left.name.localeCompare(right.name))

  if (services.length === 0) {
    throw new Error("The imported proto files do not define a service")
  }

  return { root, services }
}

export const isUnaryGRPCMethod = (method: GRPCMethodDefinition): boolean =>
  !method.requestStream && !method.responseStream

export const findGRPCMethod = (
  schema: ParsedGRPCSchema,
  serviceName: string,
  methodName: string
): GRPCMethodDefinition | null =>
  schema.services
    .find((service) => service.name === serviceName)
    ?.methods.find((method) => method.methodName === methodName) ?? null

export const getDefaultGRPCRequestBody = (type: Type): string =>
  JSON.stringify(
    type.toObject(type.create(), {
      defaults: true,
      enums: String,
      longs: String,
      bytes: String,
      oneofs: true,
      json: true,
    }),
    null,
    2
  )

export function encodeGRPCRequestBody(type: Type, body: string): Uint8Array {
  let input: unknown

  try {
    input = JSON.parse(body)
  } catch (error) {
    throw new Error(
      `Invalid JSON request body: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("The gRPC request body must be a JSON object")
  }

  const message = type.fromObject(input)
  const validationError = type.verify(message)
  if (validationError) throw new Error(validationError)

  return type.encode(message).finish()
}

export const decodeGRPCResponseBody = (type: Type, body: Uint8Array): string =>
  JSON.stringify(
    type.toObject(type.decode(body), {
      defaults: true,
      enums: String,
      longs: String,
      bytes: String,
      oneofs: true,
      json: true,
    }),
    null,
    2
  )
