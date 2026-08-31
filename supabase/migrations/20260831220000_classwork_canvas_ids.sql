-- Classwork Canvas one-shot import — persist Canvas ids for idempotent re-pull.
-- Decision: docs/decisions/216-canvas-classwork-import.md (follows 173).

begin;

alter table public.courses
  add column if not exists canvas_course_id bigint;

alter table public.assignments
  add column if not exists canvas_assignment_id bigint;

create unique index if not exists courses_canvas_course_id_uidx
  on public.courses (canvas_course_id)
  where canvas_course_id is not null and deleted_at is null;

create unique index if not exists assignments_canvas_assignment_id_uidx
  on public.assignments (canvas_assignment_id)
  where canvas_assignment_id is not null and deleted_at is null;

commit;
