import { NextResponse, type NextRequest } from "next/server";
import { runDailyCheck } from "@/lib/domain/timer";

/**
 * Өдөр тутмын хугацаа шалгах цэг — FR-27, тайлангийн Зураг 3.6.
 *
 * Шөнө 01:00 цагт гадны хуваарьлагчаас дуудагдана. Жишээ нь:
 *
 *   Linux (cron):
 *     0 1 * * *  curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
 *                  https://<хост>/api/cron/daily
 *
 *   Windows (Task Scheduler):
 *     curl.exe -fsS -H "Authorization: Bearer %CRON_SECRET%" ^
 *       http://localhost:3000/api/cron/daily
 *
 * CRON_SECRET тохируулагдсан үед Authorization толгойг заавал шалгана.
 * Тохируулаагүй бол зөвхөн хөгжүүлэлтийн горимд ажиллана.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Эрх хүрэхгүй байна." }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "CRON_SECRET тохируулаагүй байна." },
      { status: 503 }
    );
  }

  const report = await runDailyCheck();
  return NextResponse.json(report);
}
