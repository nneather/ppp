-- One waiting reminder per loan so a double drain cannot queue two.
create unique index if not exists book_loan_messages_one_open_reminder_idx
  on public.book_loan_messages (loan_id)
  where deleted_at is null
    and kind = 'reminder'
    and status in ('queued', 'sending', 'failed');
