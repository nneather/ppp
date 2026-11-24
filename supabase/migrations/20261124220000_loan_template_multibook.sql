-- Checkout and reminder copy lists every book. The reminder lead is a merge field.

update public.email_templates
set html_body = $html$<p>Hey {{contact.first_name}},</p><p>I checked this out to you on {{loan.checked_out_on}}. I hope you enjoy it!</p>{{loan.books}}<p>I'll shoot you a reminder {{loan.reminder_lead}} days before the due date. Let me know if you need more time, and tell me what you think.</p><p>Sincerely,</p><p>{{owner.first_name}}</p>$html$
where id = 'c1a01100-0000-4000-8000-000000000002'
  and deleted_at is null;

update public.email_templates
set html_body = $html$<p>Hey {{contact.first_name}},</p><p>A reminder about what you still have. The soonest due date is {{loan.due_on}}.</p>{{loan.books}}<p>Let me know if you need more time.</p><p>{{owner.first_name}}</p>$html$
where id = 'c1a01100-0000-4000-8000-000000000003'
  and deleted_at is null;
