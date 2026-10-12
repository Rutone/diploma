import { NextResponse, type NextRequest } from "next/server";
import { currentProvider } from "@/lib/auth/mock-sso";
import { startSession, takeSsoState, upsertFromSso } from "@/lib/auth/session";

/**
 * SSO-гийн буцаах цэг — «authorization code» урсгалын хоёр дахь алхам.
 *
 * Backend нэг удаагийн кодыг ID токеноор солиж, гарын үсгийг шалгаад
 * хэрэглэгчийн мэдээллийг авна. Хэрэглэгчийн нууц үг энэ системд
 * хэзээ ч дамжихгүй (тайлангийн Бүлэг 3.1).
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expected = await takeSsoState();

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/auth/sso?error=${encodeURIComponent(reason)}`, req.nextUrl.origin));

  if (!code) return fail("Нэвтрэлт цуцлагдсан байна.");
  if (!state || !expected || state !== expected)
    return fail("Нэвтрэлтийн хүсэлт хүчингүй болсон байна. Дахин оролдоно уу.");

  const claims = await currentProvider().exchange(code);
  if (!claims) return fail("Баталгаажуулалт амжилтгүй боллоо. Дахин оролдоно уу.");

  const userId = await upsertFromSso(claims);
  await startSession(userId);

  return NextResponse.redirect(new URL("/", req.nextUrl.origin));
}
