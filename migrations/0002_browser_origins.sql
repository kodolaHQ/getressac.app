-- Origins become browsers (arc, zen, chrome, firefox, other); « ai » is dropped.
-- SQLite cannot alter a CHECK constraint, so the table is rebuilt. Rows with « ai » become « other ».
CREATE TABLE invites_new (
  email      TEXT PRIMARY KEY,
  origin     TEXT NOT NULL CHECK (origin IN ('arc','zen','chrome','firefox','other')),
  chip       TEXT CHECK (chip IN ('m1','m2','m3','m4','m5')),
  memory     INTEGER CHECK (memory IN (8,16,24,32,48,64,96,128)),
  hope       TEXT,
  lang       TEXT NOT NULL CHECK (lang IN ('en','fr')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO invites_new
  SELECT email, CASE origin WHEN 'ai' THEN 'other' ELSE origin END, chip, memory, hope, lang, created_at, updated_at
  FROM invites;
DROP TABLE invites;
ALTER TABLE invites_new RENAME TO invites;
