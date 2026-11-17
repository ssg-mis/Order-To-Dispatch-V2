"use client"

import { useEffect, useState } from "react"

/**
 * Local preview URLs for files the user has picked but that are not uploaded yet (uploads happen on submit),
 * one per file in the same order, so an upload field can show thumbnails. They are revoked when the files change.
 * Pass an array from state (its identity must only change when the files change).
 */
export function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([])
  useEffect(() => {
    const next = files.map((f) => URL.createObjectURL(f))
    setUrls(next)
    return () => next.forEach((u) => URL.revokeObjectURL(u))
  }, [files])
  return urls
}

/** Same for a single picked file; undefined until there is one. */
export function useObjectUrl(file: File | null | undefined): string | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (!file) { setUrl(undefined); return }
    const next = URL.createObjectURL(file)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [file])
  return url
}
