PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Хэрэглэгч.
--   group_key = хэн болох (STUDENT | TEACHER | STAFF) — санал өгөх эрхийг тодорхойлно
--   role      = юу удирдах эрхтэй (MEMBER | MODERATOR | COUNCIL | ADMIN)
-- Энэ хоёр нь тусдаа: багш нэгэн зэрэг модератор байж болно.
CREATE TABLE IF NOT EXISTS users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  code        TEXT    NOT NULL UNIQUE,   -- оюутны код эсвэл ажилтны дугаар
  name        TEXT    NOT NULL,
  email       TEXT    NOT NULL,
  group_key   TEXT    NOT NULL DEFAULT 'STUDENT',
  division    TEXT    NOT NULL DEFAULT '',  -- салбар сургууль / албан нэгж
  position    TEXT    NOT NULL DEFAULT '',  -- мэргэжил / тэнхим / албан тушаал
  year        INTEGER NOT NULL DEFAULT 0,   -- зөвхөн оюутны курс
  role        TEXT    NOT NULL DEFAULT 'MEMBER',
  active      INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_group ON users(group_key, division, year);

CREATE TABLE IF NOT EXISTS otp_codes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code_for   TEXT    NOT NULL,
  code       TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  used       INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_otp_code ON otp_codes(code_for);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS initiatives (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  title             TEXT    NOT NULL,
  summary           TEXT    NOT NULL,
  body              TEXT    NOT NULL,
  category          TEXT    NOT NULL DEFAULT 'OTHER',
  audience          TEXT    NOT NULL DEFAULT 'ALL',  -- хэн санал өгөх вэ
  scope             TEXT    NOT NULL,                -- SCHOOL | DIVISION | CLASS
  scope_ref         TEXT    NOT NULL DEFAULT '',
  author_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name       TEXT    NOT NULL DEFAULT '',
  author_group      TEXT    NOT NULL DEFAULT 'STUDENT',
  status            TEXT    NOT NULL DEFAULT 'GATHERING',
  eligible_count    INTEGER NOT NULL DEFAULT 0,
  threshold_voters  INTEGER NOT NULL DEFAULT 0,
  threshold_score   INTEGER NOT NULL DEFAULT 0,
  created_at        TEXT    NOT NULL,
  submitted_at      TEXT,
  starts_at         TEXT,
  ends_at           TEXT,
  closed_at         TEXT,
  moderator_id      INTEGER REFERENCES users(id) ON DELETE SET NULL,
  moderated_at      TEXT,
  reason_code       TEXT,
  moderation_note   TEXT,
  final_score       INTEGER,
  final_stars       INTEGER,
  resubmit_after    TEXT,
  valid_until       TEXT
);
CREATE INDEX IF NOT EXISTS idx_init_status ON initiatives(status);
CREATE INDEX IF NOT EXISTS idx_init_audience ON initiatives(audience);

CREATE TABLE IF NOT EXISTS endorsements (
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (initiative_id, user_id)
);

-- Санал.
--   user_id нь NULL болж болно (хэрэглэгч бүртгэлээс хасагдсан ч өнгөрсөн
--   санал хураалтын тоо буурч болохгүй — нэргүйжүүлж хадгална).
--   voter_group нь санал өгөх үед хуулбарлагдана: хэрэглэгч устсан ч
--   бүлэг тус бүрийн задаргаа хадгалагдана.
CREATE TABLE IF NOT EXISTS votes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  voter_key     TEXT    NOT NULL,
  voter_group   TEXT    NOT NULL DEFAULT 'STUDENT',
  value         INTEGER NOT NULL,
  public_name   INTEGER NOT NULL DEFAULT 0,
  display_name  TEXT    NOT NULL DEFAULT '',
  created_at    TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_vote_once ON votes(initiative_id, voter_key);

CREATE TABLE IF NOT EXISTS comments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  user_id       INTEGER REFERENCES users(id) ON DELETE SET NULL,
  author_name   TEXT    NOT NULL DEFAULT '',
  author_group  TEXT    NOT NULL DEFAULT 'STUDENT',
  author_meta   TEXT    NOT NULL DEFAULT '',
  body          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL,
  edited_at     TEXT,
  deleted_at    TEXT,
  hidden_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_comment_init ON comments(initiative_id);

CREATE TABLE IF NOT EXISTS comment_reports (
  comment_id INTEGER NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (comment_id, user_id)
);

CREATE TABLE IF NOT EXISTS council_decisions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  initiative_id  INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  decision       TEXT    NOT NULL,
  reasoning      TEXT    NOT NULL,
  responder_id   INTEGER REFERENCES users(id) ON DELETE SET NULL,
  responder_name TEXT    NOT NULL DEFAULT '',
  assignee_name  TEXT    NOT NULL DEFAULT '',
  assignee_unit  TEXT    NOT NULL DEFAULT '',
  due_date       TEXT,
  created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS progress_updates (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  initiative_id INTEGER NOT NULL REFERENCES initiatives(id) ON DELETE CASCADE,
  author_name   TEXT    NOT NULL DEFAULT '',
  body          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL
);

-- Аудит лог. Дэмжлэгийн тоог гараар өөрчлөх боломжгүй байхын зэрэгцээ
-- бүх удирдлагын үйлдэл эргэж мөшгигдөх ёстой.
CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_name TEXT NOT NULL DEFAULT 'систем',
  action     TEXT NOT NULL,
  entity     TEXT NOT NULL,
  entity_id  INTEGER,
  detail     TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
