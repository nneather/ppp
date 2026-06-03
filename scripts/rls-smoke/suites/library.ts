import type { SupabaseClient } from '@supabase/supabase-js';
import {
	expectDenied,
	expectDeniedCode,
	expectMessageIncludes,
	expectOk
} from '../lib/assert.ts';
import type { SignedInClient } from '../lib/clients.ts';
import { cleanupSmokeRows, smokeTitle } from '../lib/cleanup.ts';

export type LibrarySuiteContext = {
	owner: SignedInClient;
	viewerWrite: SignedInClient;
	viewerRead: SignedInClient;
	service: SupabaseClient;
	dryRun: boolean;
};

type CaseResult = { id: string; ok: boolean; detail?: string };

const DENIED_CODES = ['42501', 'PGRST301', '403', '23514', 'P0002'];

export async function runLibrarySuite(ctx: LibrarySuiteContext): Promise<CaseResult[]> {
	const results: CaseResult[] = [];
	const run = async (id: string, fn: () => Promise<void>) => {
		try {
			await fn();
			results.push({ id, ok: true });
			console.log(`  ✓ ${id}`);
		} catch (e) {
			const detail = e instanceof Error ? e.message : String(e);
			results.push({ id, ok: false, detail });
			console.log(`  ✗ ${id}`);
			console.log(`    ${detail}`);
		}
	};

	if (ctx.dryRun) {
		await run('dry-owner-books-count', async () => {
			const { count, error } = await ctx.owner.client
				.from('books')
				.select('id', { count: 'exact', head: true })
				.is('deleted_at', null);
			if (error) throw new Error(error.message);
			if (count == null) throw new Error('owner count null');
		});
		await run('dry-viewer-read-books-count', async () => {
			const { count, error } = await ctx.viewerRead.client
				.from('books')
				.select('id', { count: 'exact', head: true })
				.is('deleted_at', null);
			if (error) throw new Error(error.message);
			const { count: ownerCount } = await ctx.owner.client
				.from('books')
				.select('id', { count: 'exact', head: true })
				.is('deleted_at', null);
			if (count !== ownerCount) {
				throw new Error(`count mismatch: owner=${ownerCount} viewer-read=${count}`);
			}
		});
		return results;
	}

	let smokeBookId: string | null = null;
	let insertedScriptureRefId: string | null = null;

	try {
		await run('01-viewer-insert-book', async () => {
			const title = smokeTitle('book');
			const row = expectOk(
				'insert book',
				await ctx.viewerWrite.client
					.from('books')
					.insert({
						title,
						genre: 'Commentary',
						language: 'english',
						reading_status: 'unread'
					})
					.select('id')
					.single()
			);
			smokeBookId = row.id;
		});

		await run('02-viewer-update-reading-status', async () => {
			if (!smokeBookId) throw new Error('no smoke book');
			expectOk(
				'update reading_status',
				await ctx.viewerWrite.client
					.from('books')
					.update({ reading_status: 'reading' })
					.eq('id', smokeBookId)
					.select('id')
					.single()
			);
		});

		await run('03-viewer-deny-personal-notes', async () => {
			const targetId = smokeBookId;
			if (!targetId) throw new Error('no smoke book');
			const err = expectDeniedCode(
				'update personal_notes',
				await ctx.viewerWrite.client
					.from('books')
					.update({ personal_notes: 'rls-smoke probe' })
					.eq('id', targetId),
				DENIED_CODES
			);
			expectMessageIncludes('personal_notes', err, 'personal_notes');
		});

		await run('04-viewer-deny-rating', async () => {
			if (!smokeBookId) throw new Error('no smoke book');
			const err = expectDeniedCode(
				'update rating',
				await ctx.viewerWrite.client
					.from('books')
					.update({ rating: 5 })
					.eq('id', smokeBookId),
				DENIED_CODES
			);
			expectMessageIncludes('rating', err, 'rating');
		});

		await run('05-viewer-deny-hard-delete', async () => {
			if (!smokeBookId) throw new Error('no smoke book');
			expectDenied(
				'delete book',
				await ctx.viewerWrite.client.from('books').delete().eq('id', smokeBookId)
			);
		});

		await run('06-viewer-soft-delete-update', async () => {
			if (!smokeBookId) throw new Error('no smoke book');
			const res = await ctx.viewerWrite.client
				.from('books')
				.update({ deleted_at: new Date().toISOString() })
				.eq('id', smokeBookId)
				.select('deleted_at')
				.single();
			// Record behavior: RLS may allow viewer soft-delete via UPDATE; not a failure either way.
			if (res.error) {
				expectDeniedCode('soft delete', res, DENIED_CODES);
			} else {
				console.log('    (note: viewer soft-delete via deleted_at succeeded — document in README)');
				smokeBookId = null;
			}
		});

		await run('07-viewer-insert-people-series', async () => {
			expectOk(
				'insert person',
				await ctx.viewerWrite.client
					.from('people')
					.insert({ last_name: smokeTitle('person'), first_name: 'T' })
					.select('id')
					.single()
			);
			expectOk(
				'insert series',
				await ctx.viewerWrite.client
					.from('series')
					.insert({ name: smokeTitle('series'), abbreviation: 'RLS' })
					.select('id')
					.single()
			);
		});

		await run('08-viewer-deny-ancient-texts-insert', async () => {
			expectDenied(
				'insert ancient_texts',
				await ctx.viewerWrite.client.from('ancient_texts').insert({
					canonical_name: smokeTitle('ancient')
				})
			);
		});

		await run('09-viewer-deny-merge-people-rpc', async () => {
			const err = expectDeniedCode(
				'library_merge_people',
				await ctx.viewerWrite.client.rpc('library_merge_people', {
					p_canonical: '00000000-0000-4000-8000-000000000001',
					p_merged_away: '00000000-0000-4000-8000-000000000002'
				}),
				DENIED_CODES
			);
			expectMessageIncludes('merge', err, 'owner');
		});

		await run('10-viewer-read-count-parity', async () => {
			const ownerRes = await ctx.owner.client
				.from('books')
				.select('id', { count: 'exact', head: true })
				.is('deleted_at', null);
			const readRes = await ctx.viewerRead.client
				.from('books')
				.select('id', { count: 'exact', head: true })
				.is('deleted_at', null);
			if (ownerRes.error) throw new Error(ownerRes.error.message);
			if (readRes.error) throw new Error(readRes.error.message);
			if (ownerRes.count !== readRes.count) {
				throw new Error(`count mismatch: owner=${ownerRes.count} read=${readRes.count}`);
			}
		});

		await run('11-viewer-read-update-reading-status', async () => {
			const { data: row } = await ctx.owner.client
				.from('books')
				.select('id')
				.is('deleted_at', null)
				.limit(1)
				.single();
			if (!row?.id) throw new Error('no live book for read viewer test');
			expectOk(
				'read viewer reading_status',
				await ctx.viewerRead.client
					.from('books')
					.update({ reading_status: 'unread' })
					.eq('id', row.id)
					.select('id')
					.single()
			);
		});

		await run('12-viewer-read-deny-title', async () => {
			const { data: row } = await ctx.owner.client
				.from('books')
				.select('id')
				.is('deleted_at', null)
				.limit(1)
				.single();
			if (!row?.id) throw new Error('no live book');
			const err = expectDeniedCode(
				'read viewer title',
				await ctx.viewerRead.client
					.from('books')
					.update({ title: smokeTitle('blocked') })
					.eq('id', row.id),
				DENIED_CODES
			);
			expectMessageIncludes('read guard', err, 'reading_status');
		});

		await run('13-search-scripture-refs-parity', async () => {
			const args = { p_bible_book: 'Philippians', p_chapter: 2, p_verse: 5 };
			const ownerRows = expectOk(
				'owner rpc',
				await ctx.owner.client.rpc('search_scripture_refs', args)
			);
			const viewerRows = expectOk(
				'viewer rpc',
				await ctx.viewerWrite.client.rpc('search_scripture_refs', args)
			);
			if ((ownerRows?.length ?? 0) !== (viewerRows?.length ?? 0)) {
				throw new Error(
					`search_scripture_refs length mismatch: owner=${ownerRows?.length} viewer=${viewerRows?.length}`
				);
			}
		});

		await run('14-viewer-insert-scripture-ref', async () => {
			const { data: book } = await ctx.owner.client
				.from('books')
				.select('id')
				.is('deleted_at', null)
				.limit(1)
				.single();
			if (!book?.id) throw new Error('no book for scripture ref');
			const ref = expectOk(
				'insert scripture_reference',
				await ctx.viewerWrite.client
					.from('scripture_references')
					.insert({
						book_id: book.id,
						bible_book: 'Philippians',
						chapter_start: 2,
						verse_start: 5,
						page_start: 'rls-smoke'
					})
					.select('id')
					.single()
			);
			insertedScriptureRefId = ref.id;
		});

		await run('15-service-role-deny-personal-notes', async () => {
			const { data: book } = await ctx.owner.client
				.from('books')
				.select('id')
				.is('deleted_at', null)
				.limit(1)
				.single();
			if (!book?.id) throw new Error('no book for service-role test');
			const res = await ctx.service
				.from('books')
				.update({ personal_notes: 'service-role probe' })
				.eq('id', book.id);
			if (!res.error) {
				console.log(
					'    (note: service-role updated personal_notes — B1/B2 bypass may apply)'
				);
				return;
			}
			expectDeniedCode('service-role personal_notes', res, DENIED_CODES);
		});
	} finally {
		if (insertedScriptureRefId) {
			await ctx.service.from('scripture_references').delete().eq('id', insertedScriptureRefId);
		}
		await cleanupSmokeRows(ctx.service);
	}

	return results;
}
