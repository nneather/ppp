import { describe, expect, it } from 'vitest';
import { isUserBusy, type BusyDocument } from './user-busy';

type StubEl = Element & {
	tagName: string;
	isContentEditable?: boolean;
	disabled?: boolean;
	readOnly?: boolean;
	type?: string;
};

function stubEl(attrs: Record<string, string>, props: Partial<StubEl> = {}): StubEl {
	return {
		tagName: props.tagName ?? 'DIV',
		isContentEditable: props.isContentEditable ?? false,
		disabled: props.disabled,
		readOnly: props.readOnly,
		type: props.type,
		hasAttribute: (name: string) => Object.prototype.hasOwnProperty.call(attrs, name),
		getAttribute: (name: string) => (Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null)
	} as StubEl;
}

function stubDoc(overlays: StubEl[], active: StubEl | null = null): BusyDocument {
	return {
		querySelectorAll: (selectors: string) =>
			overlays.filter((el) => {
				if (selectors.includes('data-ppp-recording') && el.hasAttribute('data-ppp-recording')) {
					return true;
				}
				if (selectors.includes('sheet-content') && el.getAttribute('data-slot') === 'sheet-content') {
					return true;
				}
				if (selectors.includes('dialog-content') && el.getAttribute('data-slot') === 'dialog-content') {
					return true;
				}
				if (selectors.includes('role="dialog"') && el.getAttribute('role') === 'dialog') return true;
				return false;
			}),
		activeElement: active
	};
}

describe('isUserBusy', () => {
	it('is false with empty document', () => {
		expect(isUserBusy(stubDoc([]))).toBe(false);
	});

	it('is false when document is null', () => {
		expect(isUserBusy(null)).toBe(false);
	});

	it('detects open sheet content', () => {
		const sheet = stubEl({ 'data-slot': 'sheet-content', 'data-open': '' });
		expect(isUserBusy(stubDoc([sheet]))).toBe(true);
	});

	it('detects open dialog content', () => {
		const dialog = stubEl({
			'data-slot': 'dialog-content',
			role: 'dialog',
			'data-open': ''
		});
		expect(isUserBusy(stubDoc([dialog]))).toBe(true);
	});

	it('ignores closed sheet content', () => {
		const sheet = stubEl({ 'data-slot': 'sheet-content', 'data-closed': '' });
		expect(isUserBusy(stubDoc([sheet]))).toBe(false);
	});

	it('ignores aria-hidden dialogs', () => {
		const dialog = stubEl({ role: 'dialog', 'aria-hidden': 'true' });
		expect(isUserBusy(stubDoc([dialog]))).toBe(false);
	});

	it('detects an in-progress recording', () => {
		const recording = stubEl({ 'data-ppp-recording': '' });
		expect(isUserBusy(stubDoc([recording]))).toBe(true);
	});

	it('detects focused text input', () => {
		const input = stubEl({}, { tagName: 'INPUT', type: 'text' });
		expect(isUserBusy(stubDoc([], input))).toBe(true);
	});

	it('detects focused textarea', () => {
		const textarea = stubEl({}, { tagName: 'TEXTAREA' });
		expect(isUserBusy(stubDoc([], textarea))).toBe(true);
	});

	it('ignores focused button-type input', () => {
		const input = stubEl({}, { tagName: 'INPUT', type: 'submit' });
		expect(isUserBusy(stubDoc([], input))).toBe(false);
	});

	it('ignores disabled text input', () => {
		const input = stubEl({}, { tagName: 'INPUT', type: 'text', disabled: true });
		expect(isUserBusy(stubDoc([], input))).toBe(false);
	});
});
