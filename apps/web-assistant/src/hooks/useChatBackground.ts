import { useEffect, useState } from "react"
import { useStorage } from "@plasmohq/storage/hook"
import { Storage } from "@plasmohq/storage"
import {
  CHAT_BACKGROUND_ASSET_ID,
  deleteAsset,
  getAsset,
  putAsset
} from "@/db/dexie/assets"

const local = new Storage({ area: "local" })

export function useChatBackground() {
  const [chatBackgroundImage, setChatBackgroundImage] = useStorage({
    key: "chatBackgroundImage",
    instance: local
  })
  const [chatBackgroundImageId, setChatBackgroundImageId] = useStorage({
    key: "chatBackgroundImageId",
    instance: local
  })
  const [objectUrl, setObjectUrl] = useState<string | null>(null)

  useEffect(() => {
    let revoked: string | null = null
    let cancelled = false

    const load = async () => {
      const id = chatBackgroundImageId || CHAT_BACKGROUND_ASSET_ID
      if (chatBackgroundImageId) {
        const row = await getAsset(id)
        if (cancelled) return
        if (row?.blob) {
          const url = URL.createObjectURL(row.blob)
          revoked = url
          setObjectUrl(url)
          return
        }
      }
      if (
        typeof chatBackgroundImage === "string" &&
        chatBackgroundImage.startsWith("data:")
      ) {
        setObjectUrl(chatBackgroundImage)
        return
      }
      setObjectUrl(null)
    }

    load()
    return () => {
      cancelled = true
      if (revoked) URL.revokeObjectURL(revoked)
    }
  }, [chatBackgroundImage, chatBackgroundImageId])

  const setFromFile = async (file: File) => {
    await putAsset(CHAT_BACKGROUND_ASSET_ID, file)
    await setChatBackgroundImageId(CHAT_BACKGROUND_ASSET_ID)
    await setChatBackgroundImage(null)
  }

  const clear = async () => {
    await deleteAsset(CHAT_BACKGROUND_ASSET_ID)
    await setChatBackgroundImageId(null)
    await setChatBackgroundImage(null)
    setObjectUrl(null)
  }

  return { backgroundUrl: objectUrl, setFromFile, clear }
}
