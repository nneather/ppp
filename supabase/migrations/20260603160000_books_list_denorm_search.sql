-- List denormalization + full-text search (PWA perf pass).
-- Maintains author_display, publisher_*_display, search_vector on books.

ALTER TABLE books
  ADD COLUMN IF NOT EXISTS author_display text,
  ADD COLUMN IF NOT EXISTS publisher_canonical_display text,
  ADD COLUMN IF NOT EXISTS publisher_location_display text,
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

CREATE INDEX IF NOT EXISTS idx_books_search_vector
  ON books USING gin (search_vector)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION library_compute_author_display(p_book_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH ranked AS (
    SELECT
      ba.sort_order,
      ba.role,
      trim(
        concat_ws(
          ' ',
          nullif(trim(p.first_name), ''),
          CASE
            WHEN nullif(trim(p.middle_name), '') IS NOT NULL THEN left(trim(p.middle_name), 1) || '.'
            ELSE NULL
          END,
          p.last_name
        )
      ) AS label
    FROM book_authors ba
    INNER JOIN people p ON p.id = ba.person_id AND p.deleted_at IS NULL
    WHERE ba.book_id = p_book_id
  ),
  author_line AS (
    SELECT string_agg(label, ', ' ORDER BY sort_order) AS lbl
    FROM ranked
    WHERE role = 'author' AND label IS NOT NULL AND label <> ''
  ),
  editor_agg AS (
    SELECT string_agg(label, ', ' ORDER BY sort_order) AS lbl, count(*)::int AS n
    FROM ranked
    WHERE role = 'editor' AND label IS NOT NULL AND label <> ''
  )
  SELECT coalesce(
    (SELECT lbl FROM author_line),
    (
      SELECT CASE
        WHEN n = 1 THEN lbl || ' (ed)'
        ELSE lbl || ' (eds)'
      END
      FROM editor_agg
      WHERE lbl IS NOT NULL
    ),
    NULL
  );
$$;

CREATE OR REPLACE FUNCTION library_refresh_book_list_denorm(p_book_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b record;
  pub record;
  v_author text;
  v_canonical text;
  v_location text;
BEGIN
  SELECT
    id,
    title,
    subtitle,
    publisher,
    publisher_location,
    publisher_id,
    deleted_at
  INTO b
  FROM books
  WHERE id = p_book_id;

  IF NOT FOUND OR b.deleted_at IS NOT NULL THEN
    RETURN;
  END IF;

  v_author := library_compute_author_display(p_book_id);

  SELECT p.canonical_name, p.default_location, parent.default_location AS parent_loc
  INTO pub
  FROM publishers p
  LEFT JOIN publishers parent ON parent.id = p.parent_id AND parent.deleted_at IS NULL
  WHERE p.id = b.publisher_id AND p.deleted_at IS NULL;

  v_canonical := coalesce(nullif(trim(pub.canonical_name), ''), nullif(trim(b.publisher), ''));
  v_location := coalesce(
    nullif(trim(b.publisher_location), ''),
    nullif(trim(pub.default_location), ''),
    nullif(trim(pub.parent_loc), '')
  );

  UPDATE books
  SET
    author_display = v_author,
    publisher_canonical_display = v_canonical,
    publisher_location_display = v_location,
    search_vector =
      setweight(to_tsvector('simple', coalesce(b.title, '')), 'A')
      || setweight(to_tsvector('simple', coalesce(b.subtitle, '')), 'B')
      || setweight(to_tsvector('simple', coalesce(v_author, '')), 'A')
      || setweight(to_tsvector('simple', coalesce(v_canonical, '')), 'C')
  WHERE id = p_book_id;
END;
$$;

CREATE OR REPLACE FUNCTION library_refresh_book_list_denorm_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bid uuid;
  pub_book_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'books' THEN
    PERFORM library_refresh_book_list_denorm(NEW.id);
    RETURN NEW;
  ELSIF TG_TABLE_NAME = 'book_authors' THEN
    PERFORM library_refresh_book_list_denorm(COALESCE(NEW.book_id, OLD.book_id));
    RETURN COALESCE(NEW, OLD);
  ELSIF TG_TABLE_NAME = 'people' THEN
    FOR bid IN
      SELECT DISTINCT ba.book_id
      FROM book_authors ba
      WHERE ba.person_id = COALESCE(NEW.id, OLD.id)
    LOOP
      PERFORM library_refresh_book_list_denorm(bid);
    END LOOP;
    RETURN COALESCE(NEW, OLD);
  ELSIF TG_TABLE_NAME = 'publishers' THEN
    FOR pub_book_id IN
      SELECT id FROM books
      WHERE deleted_at IS NULL
        AND (publisher_id = COALESCE(NEW.id, OLD.id) OR reprint_publisher_id = COALESCE(NEW.id, OLD.id))
    LOOP
      PERFORM library_refresh_book_list_denorm(pub_book_id);
    END LOOP;
    RETURN COALESCE(NEW, OLD);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS books_list_denorm_refresh ON books;
CREATE TRIGGER books_list_denorm_refresh
  AFTER INSERT OR UPDATE OF title, subtitle, publisher, publisher_location, publisher_id, deleted_at
  ON books
  FOR EACH ROW
  EXECUTE FUNCTION library_refresh_book_list_denorm_trigger();

DROP TRIGGER IF EXISTS book_authors_list_denorm_refresh ON book_authors;
CREATE TRIGGER book_authors_list_denorm_refresh
  AFTER INSERT OR UPDATE OR DELETE ON book_authors
  FOR EACH ROW
  EXECUTE FUNCTION library_refresh_book_list_denorm_trigger();

DROP TRIGGER IF EXISTS people_list_denorm_refresh ON people;
CREATE TRIGGER people_list_denorm_refresh
  AFTER UPDATE OF first_name, middle_name, last_name, deleted_at ON people
  FOR EACH ROW
  EXECUTE FUNCTION library_refresh_book_list_denorm_trigger();

DROP TRIGGER IF EXISTS publishers_list_denorm_refresh ON publishers;
CREATE TRIGGER publishers_list_denorm_refresh
  AFTER UPDATE OF canonical_name, default_location, parent_id, deleted_at ON publishers
  FOR EACH ROW
  EXECUTE FUNCTION library_refresh_book_list_denorm_trigger();

-- Backfill live books (one-time; safe to re-run)
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM books WHERE deleted_at IS NULL
  LOOP
    PERFORM library_refresh_book_list_denorm(r.id);
  END LOOP;
END;
$$;
