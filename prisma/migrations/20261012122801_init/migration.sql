-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberType" AS ENUM ('STUDENT', 'TEACHER', 'STAFF');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('MEMBER', 'UNIT_STAFF', 'MODERATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "RequestKind" AS ENUM ('SUGGESTION', 'COMPLAINT');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('SUBMITTED', 'ROUTED', 'AT_MODERATOR', 'IN_PROGRESS', 'ANSWERED', 'OVERDUE', 'CLOSED', 'CONVERTED');

-- CreateEnum
CREATE TYPE "InitiativeStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'COLLECTING', 'PAUSED', 'REJECTED', 'THRESHOLD_MET', 'EXPIRED', 'ANSWERED', 'OVERDUE', 'HIDDEN', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Scope" AS ENUM ('UNIVERSITY', 'SCHOOL', 'CLASS');

-- CreateEnum
CREATE TYPE "Audience" AS ENUM ('ALL', 'STUDENT', 'TEACHER', 'STAFF', 'EMPLOYEE');

-- CreateEnum
CREATE TYPE "ResponseOutcome" AS ENUM ('ACCEPTED', 'EXPLAINED', 'SCHEDULED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NotificationKind" AS ENUM ('STATUS_CHANGED', 'RESPONSE_POSTED', 'THRESHOLD_MET', 'DUE_SOON', 'OVERDUE', 'MODERATION_NEEDED', 'REQUEST_ROUTED');

-- CreateTable
CREATE TABLE "school" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "school_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hint" TEXT NOT NULL DEFAULT '',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "unit_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "sso_sub" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "member_type" "MemberType" NOT NULL DEFAULT 'STUDENT',
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "school_id" UUID,
    "unit_id" UUID,
    "position" TEXT NOT NULL DEFAULT '',
    "year" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "consent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_login_at" TIMESTAMPTZ(6),

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "token" TEXT NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("token")
);

-- CreateTable
CREATE TABLE "request" (
    "id" SERIAL NOT NULL,
    "kind" "RequestKind" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'SUBMITTED',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "unit_id" UUID,
    "author_id" UUID,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6) NOT NULL,
    "extended" BOOLEAN NOT NULL DEFAULT false,
    "extended_at" TIMESTAMPTZ(6),
    "opened_at" TIMESTAMPTZ(6),
    "answered_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "rating" INTEGER,
    "converted_initiative_id" INTEGER,

    CONSTRAINT "request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_message" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "initiative" (
    "id" SERIAL NOT NULL,
    "status" "InitiativeStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category_id" UUID NOT NULL,
    "scope" "Scope" NOT NULL DEFAULT 'UNIVERSITY',
    "audience" "Audience" NOT NULL DEFAULT 'ALL',
    "school_id" UUID,
    "class_year" INTEGER,
    "author_id" UUID,
    "unit_id" UUID,
    "scope_size_n" INTEGER NOT NULL DEFAULT 0,
    "threshold" INTEGER NOT NULL DEFAULT 0,
    "support_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),
    "published_at" TIMESTAMPTZ(6),
    "collect_until" TIMESTAMPTZ(6),
    "threshold_at" TIMESTAMPTZ(6),
    "response_due_at" TIMESTAMPTZ(6),
    "answered_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "moderator_id" UUID,
    "moderated_at" TIMESTAMPTZ(6),
    "reason_code" TEXT,
    "moderator_note" TEXT,

    CONSTRAINT "initiative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support" (
    "initiative_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_pkey" PRIMARY KEY ("initiative_id","user_id")
);

-- CreateTable
CREATE TABLE "comment" (
    "id" SERIAL NOT NULL,
    "initiative_id" INTEGER NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMPTZ(6),
    "deleted_at" TIMESTAMPTZ(6),
    "hidden_at" TIMESTAMPTZ(6),

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_report" (
    "comment_id" INTEGER NOT NULL,
    "user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_report_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateTable
CREATE TABLE "response" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER,
    "initiative_id" INTEGER,
    "outcome" "ResponseOutcome" NOT NULL,
    "body" TEXT NOT NULL,
    "due_date" TIMESTAMPTZ(6),
    "responder_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "status_history" (
    "id" SERIAL NOT NULL,
    "request_id" INTEGER,
    "initiative_id" INTEGER,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "actor_id" UUID,
    "actor_label" TEXT NOT NULL DEFAULT 'систем',
    "reason" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "href" TEXT NOT NULL DEFAULT '',
    "read_at" TIMESTAMPTZ(6),
    "emailed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "academic_break" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "starts_on" DATE NOT NULL,
    "ends_on" DATE NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_break_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" SERIAL NOT NULL,
    "actor_label" TEXT NOT NULL DEFAULT 'систем',
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL DEFAULT '',
    "detail" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "school_code_key" ON "school"("code");

-- CreateIndex
CREATE UNIQUE INDEX "unit_code_key" ON "unit"("code");

-- CreateIndex
CREATE UNIQUE INDEX "category_code_key" ON "category"("code");

-- CreateIndex
CREATE INDEX "category_active_sort_order_idx" ON "category"("active", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_sso_sub_key" ON "app_user"("sso_sub");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_code_key" ON "app_user"("code");

-- CreateIndex
CREATE INDEX "app_user_active_member_type_school_id_year_idx" ON "app_user"("active", "member_type", "school_id", "year");

-- CreateIndex
CREATE INDEX "session_expires_at_idx" ON "session"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "request_converted_initiative_id_key" ON "request"("converted_initiative_id");

-- CreateIndex
CREATE INDEX "request_unit_id_status_due_at_idx" ON "request"("unit_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "request_author_id_idx" ON "request"("author_id");

-- CreateIndex
CREATE INDEX "request_message_request_id_idx" ON "request_message"("request_id");

-- CreateIndex
CREATE INDEX "initiative_status_collect_until_idx" ON "initiative"("status", "collect_until");

-- CreateIndex
CREATE INDEX "initiative_status_response_due_at_idx" ON "initiative"("status", "response_due_at");

-- CreateIndex
CREATE INDEX "initiative_author_id_idx" ON "initiative"("author_id");

-- CreateIndex
CREATE INDEX "comment_initiative_id_idx" ON "comment"("initiative_id");

-- CreateIndex
CREATE INDEX "response_request_id_idx" ON "response"("request_id");

-- CreateIndex
CREATE INDEX "response_initiative_id_idx" ON "response"("initiative_id");

-- CreateIndex
CREATE INDEX "status_history_request_id_idx" ON "status_history"("request_id");

-- CreateIndex
CREATE INDEX "status_history_initiative_id_idx" ON "status_history"("initiative_id");

-- CreateIndex
CREATE INDEX "notification_user_id_read_at_idx" ON "notification"("user_id", "read_at");

-- CreateIndex
CREATE INDEX "academic_break_starts_on_ends_on_idx" ON "academic_break"("starts_on", "ends_on");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- AddForeignKey
ALTER TABLE "category" ADD CONSTRAINT "category_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request" ADD CONSTRAINT "request_converted_initiative_id_fkey" FOREIGN KEY ("converted_initiative_id") REFERENCES "initiative"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_message" ADD CONSTRAINT "request_message_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_message" ADD CONSTRAINT "request_message_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "school"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative" ADD CONSTRAINT "initiative_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support" ADD CONSTRAINT "support_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support" ADD CONSTRAINT "support_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_report" ADD CONSTRAINT "comment_report_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response" ADD CONSTRAINT "response_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response" ADD CONSTRAINT "response_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "response" ADD CONSTRAINT "response_responder_id_fkey" FOREIGN KEY ("responder_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiative"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "status_history" ADD CONSTRAINT "status_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════
-- Тайлангийн Бүлэг 3.4-д тодорхойлсон логик хязгаарлалтууд.
-- Prisma эдгээрийг схемээс үүсгэдэггүй тул гараар нэмэв.
-- ═══════════════════════════════════════════════════════════════════

-- Босго нь нийтлэгдсэн санаачилгад заавал 1-ээс багагүй байна.
-- (Ноорог ба хяналтын шатанд босго хараахан тооцогдоогүй байдаг —
--  тайлангийн 2.11.1: «босгыг санаачилга батлагдах үед нэг удаа тооцно».)
ALTER TABLE "initiative"
  ADD CONSTRAINT "chk_threshold"
  CHECK ("status" IN ('DRAFT', 'IN_REVIEW', 'REJECTED') OR "threshold" >= 1);

-- Дэмжлэгийн тоолуур сөрөг болохгүй.
ALTER TABLE "initiative"
  ADD CONSTRAINT "chk_support" CHECK ("support_count" >= 0);

-- Нийтлэгдсэн санаачилгад хамрах хүрээний гишүүдийн тоо N > 0 байна.
ALTER TABLE "initiative"
  ADD CONSTRAINT "chk_scope_size"
  CHECK ("status" IN ('DRAFT', 'IN_REVIEW', 'REJECTED') OR "scope_size_n" > 0);

-- Хариу нь хүсэлт ЭСВЭЛ санаачилгын яг нэгтэй холбогдоно.
ALTER TABLE "response"
  ADD CONSTRAINT "chk_target"
  CHECK (("request_id" IS NULL) <> ("initiative_id" IS NULL));

-- Төлөвийн түүх мөн адил яг нэг обьектод хамаарна.
ALTER TABLE "status_history"
  ADD CONSTRAINT "chk_history_target"
  CHECK (("request_id" IS NULL) <> ("initiative_id" IS NULL));

-- Илгээгчийн сэтгэл ханамжийн үнэлгээ 1..3.
ALTER TABLE "request"
  ADD CONSTRAINT "chk_rating" CHECK ("rating" IS NULL OR "rating" BETWEEN 1 AND 3);

-- Хичээлийн амралтын эхлэл төгсгөлөөсөө хойш байж болохгүй.
ALTER TABLE "academic_break"
  ADD CONSTRAINT "chk_break_range" CHECK ("starts_on" <= "ends_on");
