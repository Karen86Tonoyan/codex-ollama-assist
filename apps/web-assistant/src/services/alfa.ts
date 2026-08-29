import { Storage } from "@plasmohq/storage"

const storage = new Storage()

const DEFAULT_GATEWAY = "http://127.0.0.1:8080"

export const isAlfaSecureMode = async (): Promise<boolean> => {
  const enabled = await storage.get<boolean | undefined>("alfaSecureMode")
  return enabled ?? true
}

export const setAlfaSecureMode = async (enabled: boolean): Promise<void> => {
  await storage.set("alfaSecureMode", enabled)
}

export const getAlfaGatewayUrl = async (): Promise<string> => {
  const url = await storage.get<string | undefined>("alfaGatewayUrl")
  if (!url || url.trim() === "") {
    return DEFAULT_GATEWAY
  }
  return url.replace(/\/$/, "")
}
