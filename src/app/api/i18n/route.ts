import { NextResponse } from "next/server"
import en from "@/lib/i18n/en.json"
import fr from "@/lib/i18n/fr.json"

const translations: Record<string, Record<string, string>> = {
  en,
  fr,
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const locale = searchParams.get("locale") || "en"
  
  return NextResponse.json(translations[locale] || translations.en)
}