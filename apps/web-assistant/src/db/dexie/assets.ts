import { db } from "./schema"

export const CHAT_BACKGROUND_ASSET_ID = "chat-background"

export type AssetRow = {
  id: string
  blob: Blob
  mime: string
  updatedAt: number
}

export async function putAsset(id: string, blob: Blob): Promise<void> {
  await db.table("assets").put({
    id,
    blob,
    mime: blob.type || "application/octet-stream",
    updatedAt: Date.now()
  } satisfies AssetRow)
}

export async function getAsset(id: string): Promise<AssetRow | undefined> {
  return db.table("assets").get(id)
}

export async function deleteAsset(id: string): Promise<void> {
  await db.table("assets").delete(id)
}
