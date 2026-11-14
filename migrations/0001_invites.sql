CREATE TABLE invites (
  email      TEXT PRIMARY KEY,
  origin     TEXT NOT NULL CHECK (origin IN ('arc','ai','firefox','other')),
  chip       TEXT CHECK (chip IN ('m1','m2','m3','m4','m5')),
  memory     INTEGER CHECK (memory IN (8,16,24,32,48,64,96,128)),
  hope       TEXT,
  lang       TEXT NOT NULL CHECK (lang IN ('en','fr')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
