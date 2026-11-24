import { describe, expect, it } from 'vitest';
import {
	bookTitleSummary,
	canCheckOutCopy,
	ccBesidesRecipient,
	loanNeedsNextReminder,
	nextReminderYmd,
	parseLoanInterval
} from '$lib/email/loans';
import {
	daysBetweenYmd,
	loanBooksHtml,
	loanDueLabel,
	reminderDateAfter,
	renderEmailTemplate,
	withLoanBookList
} from '$lib/email/render';
import { inlineEmailButtonStyles, sanitizeEmailHtml } from '$lib/email/sanitize';
import { unknownEmailTokens } from '$lib/email/variables';

describe('email templates', () => {
	it('renders known tokens and leaves unknown ones', () => {
		const html = renderEmailTemplate(
			'<p>Hi {{contact.first_name}}, {{book.title}} {{nope.thing}}</p>',
			{ 'contact.first_name': 'Ada <b>', 'book.title': 'Institutes' }
		);
		expect(html).toBe('<p>Hi Ada &lt;b&gt;, Institutes {{nope.thing}}</p>');
	});

	it('formats the due date and keeps line breaks in the body', () => {
		expect(loanDueLabel('2026-01-01', 30)).toBe('Jan 31, 2026');
		expect(
			renderEmailTemplate('{{invoice.message}}', { 'invoice.message': 'Line one\nLine two' }, { html: true })
		).toBe('Line one<br>Line two');
		expect(unknownEmailTokens('{{loan.due_on}}', '{{loan.reminder_lead}}')).toEqual([]);
		expect(renderEmailTemplate('{{loan.reminder_lead}} days before', { 'loan.reminder_lead': '7' })).toBe(
			'7 days before'
		);
	});

	it('rejects tokens outside the catalog', () => {
		expect(unknownEmailTokens('Hello {{contact.first_name}}', '<p>{{event.name}}</p>')).toEqual([
			'event.name'
		]);
	});

	it('strips scripts and keeps a button link', () => {
		const clean = sanitizeEmailHtml(
			'<p>Hi</p><script>alert(1)</script><a href="https://example.com" class="ppp-email-button">Open</a><a href="javascript:alert(1)">x</a>'
		);
		expect(clean).not.toContain('script');
		expect(clean).toContain('href="https://example.com" class="ppp-email-button"');
		expect(clean).not.toContain('javascript');
		expect(inlineEmailButtonStyles(clean)).toContain('background:#18181b');
	});
});

describe('loan schedule', () => {
	it('adds a month of calendar days', () => {
		expect(reminderDateAfter('2026-01-31', 30)).toBe('2026-03-02');
		expect(daysBetweenYmd('2026-01-01', '2026-01-31')).toBe(30);
	});

	it('caps open loans at copy_count and skips unowned books', () => {
		expect(canCheckOutCopy({ owned: true, copyCount: 2, openLoanCount: 1 })).toBe(true);
		expect(canCheckOutCopy({ owned: true, copyCount: 2, openLoanCount: 2 })).toBe(false);
		expect(canCheckOutCopy({ owned: false, copyCount: 1, openLoanCount: 0 })).toBe(false);
	});

	it('schedules one reminder from the earliest due date', () => {
		expect(nextReminderYmd(['2026-12-24', '2026-12-31'], 7, '2026-12-01')).toBe('2026-12-17');
		expect(nextReminderYmd(['2026-12-24'], 7, '2026-12-20')).toBe('2026-12-20');
		expect(nextReminderYmd([], 7, '2026-12-01')).toBeNull();
		expect(bookTitleSummary(['Institutes'])).toBe('Institutes');
		expect(bookTitleSummary(['Institutes', 'Romans'])).toBe('Institutes and 1 other');
		expect(bookTitleSummary(['Institutes', 'Romans', 'Galatians'])).toBe('Institutes and 2 others');
	});

	it('keeps the book list as html and appends it when the template omitted the token', () => {
		const list = loanBooksHtml([
			{ title: 'Institutes', authors: 'Calvin', dueOn: '2026-12-24' }
		]);
		expect(list).toBe('<ul><li><em>Institutes</em> by Calvin (due Dec 24, 2026)</li></ul>');
		expect(
			renderEmailTemplate('{{loan.books}}', { 'loan.books': list }, { html: true })
		).toBe(list);
		expect(withLoanBookList('Hello', '<p>Hello</p>', list)).toBe(`<p>Hello</p>${list}`);
		expect(withLoanBookList('{{loan.books}}', list, list)).toBe(list);
	});

	it('copies the profile CC and skips the person the message is already to', () => {
		expect(
			ccBesidesRecipient(
				['Parker.Neathery@gmail.com', 'friend@example.com', 'not-an-email'],
				'friend@example.com'
			)
		).toEqual(['Parker.Neathery@gmail.com']);
	});

	it('parses the standing interval and queues the next reminder only when none is open', () => {
		expect(parseLoanInterval('30')).toBe(30);
		expect(parseLoanInterval('0')).toBeNull();
		expect(parseLoanInterval('')).toBe(30);
		expect(
			loanNeedsNextReminder(false, [{ kind: 'reminder', status: 'sent' }])
		).toBe(true);
		expect(
			loanNeedsNextReminder(false, [{ kind: 'reminder', status: 'queued' }])
		).toBe(false);
		expect(
			loanNeedsNextReminder(false, [{ kind: 'reminder', status: 'failed' }])
		).toBe(false);
		expect(loanNeedsNextReminder(true, [])).toBe(false);
	});
});
