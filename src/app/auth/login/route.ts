import { NextResponse, type NextRequest } from "next/server";
import { currentProvider } from "@/lib/auth/mock-sso";
import { randomState } from "@/lib/auth/provider";
import { setSsoState } from "@/lib/auth/session";

/**
 * Нэвтрэлтийн эхлэл — тайлангийн Зураг 3.3.
 * Хэрэглэгчийг SSO руу шилжүүлнэ. CSRF-ээс хамгаалах `state`-ийг
 * httpOnly cookie-д хадгалж, буцаж ирэхэд тулгана.
 */
export async function GET(req: NextRequest) {
  const state = randomState();
  await setSsoState(state);

  const redirectUri = new URL("/auth/callback", req.nextUrl.origin).toString();
  const url = currentProvider().authorizationUrl(state, redirectUri);

  return NextResponse.redirect(new URL(url, req.nextUrl.origin));
}
