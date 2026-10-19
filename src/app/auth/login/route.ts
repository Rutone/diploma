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
  // Next.js-ийн <Link> холбоосыг урьдчилан ачаалдаг (prefetch). Тийм хүсэлт
  // бүр шинэ state үүсгэж cookie-г дарвал хэрэглэгчийн ЖИНХЭНЭ нэвтрэлтийн
  // state алдагдаж, callback дээр «хүсэлт хүчингүй» алдаа гарна. Иймд
  // prefetch хүсэлтэд юу ч тавихгүй, шууд татгалзана.
  if (req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch") {
    return new NextResponse(null, { status: 204 });
  }

  const state = randomState();
  await setSsoState(state);

  const redirectUri = new URL("/auth/callback", req.nextUrl.origin).toString();
  const url = currentProvider().authorizationUrl(state, redirectUri);

  return NextResponse.redirect(new URL(url, req.nextUrl.origin));
}
