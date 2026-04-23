# Decision log

One file per build session, filed at session end. Used as input to the *next* session's Session 0 audit.

## Naming

`NNN-short-slug.md` — zero-padded sequence, kebab-case slug.

- `001-app-shell.md`
- `002-time-entries.md`
- `010-library-books-vertical-slice.md`

Numbers are global across modules (not per-module) so the log reads chronologically.

## Template

See [AGENTS.md](../../AGENTS.md#template) for the canonical template. Copy it into a new file and fill in.

## What goes here vs. the tracker

- **Tracker** = forward-looking plan: what we will build, in what order, with what acceptance criteria.
- **Decision log** = backward-looking record: what we actually shipped, what we decided, and what bit us.

The decision log captures the *delta* between the tracker and reality. That delta is the most valuable input the next module has.

## Reading order at session start

Read the latest 3 entries before starting a new session. They contain the schema gotchas, RLS surprises, and component patterns that the rule files have not yet absorbed.
