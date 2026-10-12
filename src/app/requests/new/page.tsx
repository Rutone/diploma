import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/auth/session";
import { Notice } from "@/components/ui";
import { RequestForm } from "@/components/client";

export const dynamic = "force-dynamic";

export default async function NewRequestPage() {
  const user = await currentUser();
  if (!user) redirect("/auth/login");

  const categories = await prisma.category.findMany({
    where: { active: true },
    include: { unit: true },
    orderBy: { sortOrder: "asc" },
  });

  return (
    <div className="mx-auto max-w-[760px] space-y-4">
      <div className="card p-5 sm:p-6">
        <h2 className="text-[19px] font-medium mb-1">Санал, гомдол илгээх</h2>
        <p className="text-[14px] text-ink2 leading-relaxed mb-5">
          Хувийн шинжтэй асуудлыг энд илгээнэ. Хариуцах нэгжийг та сонгохгүй — ангиллаа сонгоход
          систем автоматаар чиглүүлнэ. Хүсэлтийг зөвхөн та, хариуцсан нэгж, модератор харна.
        </p>

        <RequestForm
          categories={categories.map((c) => ({
            id: c.id,
            name: c.name,
            hint: c.hint,
            unitName: c.unit?.name ?? null,
          }))}
        />
      </div>

      <Notice tone="blue" title="Олон хүнд хамаатай асуудал бол">
        Нийтэд хамаарах өөрчлөлтийг{" "}
        <Link href="/initiatives/new" className="link">
          нийтийн санаачилга
        </Link>{" "}
        болгож дэвшүүлбэл дэмжлэг цуглуулж, босго давсны дараа албан хариу авах эрх нээгдэнэ.
      </Notice>

      <Notice tone="gray" title="Хуулийн хугацаа">
        «Иргэдээс төрийн байгууллага, албан тушаалтанд гаргасан өргөдөл, гомдлыг шийдвэрлэх тухай
        хууль»-ийн 16.1, 16.2-т заасны дагуу гомдлыг 30 хоногт (нэг удаа 30 хүртэл хоногоор
        сунгаж болно), саналыг 90 хоногт шийдвэрлэнэ. Хугацааг систем автоматаар хянаж, хэтэрсэн
        тохиолдолд нэгж, модератор, удирдлагад мэдэгдэнэ.
      </Notice>
    </div>
  );
}
