-- Invoice email joins the template store. The seeded reminder mentions the
-- due date only while its body is still the original seed.

insert into public.email_template_folders (id, name, sort_order)
select 'c1a01100-0000-4000-8000-000000000010', 'Invoicing', 20
where not exists (
  select 1 from public.email_template_folders
  where id = 'c1a01100-0000-4000-8000-000000000010'
);

insert into public.email_templates (id, folder_id, name, subject, html_body)
select
  'c1a01100-0000-4000-8000-000000000011',
  'c1a01100-0000-4000-8000-000000000010',
  'Invoice',
  'Invoice {{invoice.number}} — {{client.name}}',
  $html$<p>{{invoice.message}}</p><p><strong>Invoice {{invoice.number}}</strong></p><p>{{client.name}}</p><p>{{invoice.period}}</p><p>Total {{invoice.total}}</p><p>The detailed invoice is attached as a PDF.</p><p>{{owner.first_name}}</p>$html$
where not exists (
  select 1 from public.email_templates
  where id = 'c1a01100-0000-4000-8000-000000000011'
);

insert into public.email_template_bindings (id, binding_key, template_id)
select
  'c1a01100-0000-4000-8000-000000000012',
  'invoicing.invoice',
  'c1a01100-0000-4000-8000-000000000011'
where not exists (
  select 1 from public.email_template_bindings
  where binding_key = 'invoicing.invoice' and deleted_at is null
);

update public.email_templates
set html_body = $html$<p>Hi {{contact.first_name}},</p><p>A reminder that you have <em>{{book.title}}</em>, checked out on {{loan.checked_out_on}} ({{loan.days_out}} days ago). Please send it back by {{loan.due_on}}.</p><p>{{owner.first_name}}</p>$html$
where id = 'c1a01100-0000-4000-8000-000000000003'
  and deleted_at is null
  and html_body = $html$<p>Hi {{contact.first_name}},</p><p>A reminder that you have <em>{{book.title}}</em>, checked out on {{loan.checked_out_on}} ({{loan.days_out}} days ago). Let me know when I can pick it up.</p><p>{{owner.first_name}}</p>$html$;
