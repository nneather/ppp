import { describe, expect, it } from 'vitest';
import {
	cleanEmailSubject,
	emailBodyToNotes,
	extractEmailAddress,
	isAllowedSender,
	isInboundTaskRecipient,
	stripHtmlToText,
	TASK_TITLE_MAX
} from '$lib/projects/email-inbound';

describe('cleanEmailSubject', () => {
	it('strips Fwd/Re prefixes', () => {
		expect(cleanEmailSubject('Fwd: Hello')).toBe('Hello');
		expect(cleanEmailSubject('FW: Re: Hello')).toBe('Hello');
		expect(cleanEmailSubject('Re: Re: Bill sync')).toBe('Bill sync');
	});

	it('falls back when empty', () => {
		expect(cleanEmailSubject('')).toBe('(no subject)');
		expect(cleanEmailSubject('   ')).toBe('(no subject)');
		expect(cleanEmailSubject(null)).toBe('(no subject)');
	});

	it('truncates to title max', () => {
		const long = 'a'.repeat(TASK_TITLE_MAX + 20);
		expect(cleanEmailSubject(long).length).toBe(TASK_TITLE_MAX);
	});
});

describe('extractEmailAddress / allowlist', () => {
	it('parses angle-bracket addresses', () => {
		expect(extractEmailAddress('Parker <parker@npneathery.com>')).toBe('parker@npneathery.com');
		expect(extractEmailAddress('parker@npneathery.com')).toBe('parker@npneathery.com');
	});

	it('allowlists senders case-insensitively', () => {
		expect(
			isAllowedSender('Parker <Parker@Npneathery.com>', 'parker@npneathery.com, other@x.com')
		).toBe(true);
		expect(isAllowedSender('evil@example.com', 'parker@npneathery.com')).toBe(false);
		expect(isAllowedSender('parker@npneathery.com', '')).toBe(false);
	});
});

describe('isInboundTaskRecipient', () => {
	it('matches to / received_for', () => {
		expect(isInboundTaskRecipient(['tasks@zeneoldai.resend.app'])).toBe(true);
		expect(isInboundTaskRecipient(['Tasks <tasks@zeneoldai.resend.app>'])).toBe(true);
		expect(isInboundTaskRecipient(['other@example.com'])).toBe(false);
		expect(
			isInboundTaskRecipient(['tasks@in.npneathery.com'], 'tasks@in.npneathery.com')
		).toBe(true);
	});
});

describe('emailBodyToNotes', () => {
	it('prefers plain text', () => {
		expect(emailBodyToNotes({ text: 'plain', html: '<p>html</p>' })).toBe('plain');
	});

	it('strips html when no text', () => {
		expect(emailBodyToNotes({ html: '<p>Hello <b>world</b></p>' })).toBe('Hello world');
		expect(stripHtmlToText('<br>a<br/>b')).toContain('a');
	});

	it('returns null when empty', () => {
		expect(emailBodyToNotes({})).toBeNull();
	});
});
