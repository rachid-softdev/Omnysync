import { describe, it, expect } from "vitest"
import * as errorsModule from "../errors"
import en from "../i18n/en.json"
import fr from "../i18n/fr.json"

const errorCodes = [
  "ERR_DOC_NOT_FOUND",
  "ERR_DOC_NOT_PUBLISHED",
  "ERR_SYNC_NO_CHANGES",
  "ERR_SYNC_SUCCESS",
  "ERR_SYNC_STARTED",
  "ERR_API_FAILED",
  "ERR_UPLOAD_MEDIA",
  "ERR_FETCH_CONTENT",
]

describe("error codes", () => {
  it("all error codes are defined", () => {
    for (const code of errorCodes) {
      expect(errorsModule[code as keyof typeof errorsModule]).toBe(code)
    }
  })

  it("all error codes have corresponding i18n keys in en.json", () => {
    for (const code of errorCodes.filter((c) => c.startsWith("ERR_"))) {
      expect((en as Record<string, string>)[code]).toBeDefined()
    }
  })
})

describe("i18n", () => {
  it("en.json and fr.json have the same keys", () => {
    const enKeys = Object.keys(en).sort()
    const frKeys = Object.keys(fr).sort()

    expect(enKeys).toEqual(frKeys)
  })

  it("has no duplicate keys in source files", () => {
    const enKeys = Object.keys(en)
    const frKeys = Object.keys(fr)

    const enUnique = new Set(enKeys)
    const frUnique = new Set(frKeys)

    expect(enUnique.size).toBe(enKeys.length)
    expect(frUnique.size).toBe(frKeys.length)
  })
})
