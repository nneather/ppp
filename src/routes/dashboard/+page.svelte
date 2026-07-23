<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { page } from '$app/state';
	import Receipt from '@lucide/svelte/icons/receipt';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Plus from '@lucide/svelte/icons/plus';
	import DashboardLibraryTileFooter from '$lib/components/dashboard-library-tile-footer.svelte';
	import DashboardInvoicingTileFooter from '$lib/components/dashboard-invoicing-tile-footer.svelte';
	import DashboardUpcomingSermons from '$lib/components/dashboard-upcoming-sermons.svelte';
	import ProjectStatusStrip from '$lib/components/project-status-strip.svelte';
	import ProjectTaskList from '$lib/components/project-task-list.svelte';
	import ProjectTaskSheet from '$lib/components/project-task-sheet.svelte';
	import { Button } from '$lib/components/ui/button';
	import { cn } from '$lib/utils';
	import { formatWeekLabel } from '$lib/projects/week';
	import type { ProjectTaskView } from '$lib/types/projects';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	let sheetOpen = $state(false);
	let sheetMode = $state<'create' | 'edit'>('create');
	let editingTask = $state<ProjectTaskView | null>(null);

	const f = $derived(form ?? null);

	const sheetError = $derived.by(() => {
		if (!f || f.success) return null;
		if (f.kind === 'createTask' || f.kind === 'updateTask') {
			return f.message ?? 'Something went wrong.';
		}
		return null;
	});

	const editingSeries = $derived.by(() => {
		if (!editingTask?.series_id) return null;
		return data.seriesById[editingTask.series_id] ?? null;
	});

	const taskCountsLoaded = $derived(
		data.criticalNowTaskCount != null && data.opportunityNowTaskCount != null
	);

	const taskBreakdown = $derived.by(() => {
		if (!taskCountsLoaded) return null;
		const parts: { label: string; count: number; tone: 'critical' | 'opportunity' }[] = [];
		const critical = data.criticalNowTaskCount ?? 0;
		const opportunity = data.opportunityNowTaskCount ?? 0;
		if (critical > 0) parts.push({ label: 'Critical', count: critical, tone: 'critical' });
		if (opportunity > 0) {
			parts.push({ label: 'Opportunity', count: opportunity, tone: 'opportunity' });
		}
		return parts;
	});

	const cardClass = cn(
		'flex h-full flex-col rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-colors hover:border-ring/50 focus-within:border-ring/50'
	);

	const innerLinkClass = cn(
		'flex flex-1 flex-col rounded-t-xl p-4 outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-5'
	);

	function openCreate() {
		sheetMode = 'create';
		editingTask = null;
		sheetOpen = true;
	}

	function openEdit(task: ProjectTaskView) {
		sheetMode = 'edit';
		editingTask = task;
		sheetOpen = true;
	}

	async function onTaskSaved() {
		await invalidate('app:projects:tasks');
	}
</script>

<div class="mx-auto max-w-7xl px-4 py-6 pb-tabbar md:px-6 md:py-8">
	{#if data.dashboardError}
		<p
			class="mb-4 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
		>
			{data.dashboardError}
		</p>
	{/if}

	<div
		class="md:grid md:grid-cols-[minmax(0,1fr)_20rem] md:items-start md:gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8"
	>
		<div class="min-w-0 space-y-6">
			<section
				class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm md:p-5"
				aria-labelledby="project-status-heading"
			>
				<div class="mb-3 flex flex-wrap items-baseline justify-between gap-2">
					<h2
						id="project-status-heading"
						class="text-sm font-semibold tracking-tight text-foreground"
					>
						Project status
					</h2>
					<a
						href="/projects"
						class="text-sm font-medium text-primary underline-offset-4 hover:underline"
					>
						Edit Status
					</a>
				</div>
				{#key page.url.pathname}
					<ProjectStatusStrip tree={data.projectTree} latestHealth={data.latestHealth} />
				{/key}
			</section>

			{#if data.missingCheckInCount > 0}
				<a
					href="/projects"
					class="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-950 transition-colors hover:border-amber-500/60 dark:text-amber-100"
				>
					<span class="font-medium">
						{data.missingCheckInCount === 1
							? '1 project needs this week’s check-in'
							: `${data.missingCheckInCount} projects need this week’s check-in`}
					</span>
					<span class="text-xs text-amber-900/80 dark:text-amber-200/80">
						Week of {formatWeekLabel(data.weekOf)} →
					</span>
				</a>
			{/if}

			<section aria-labelledby="modules-heading">
				<h2 id="modules-heading" class="sr-only">Modules</h2>
				<ul class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					<li>
						<div class={cardClass}>
							<a href="/invoicing" class={innerLinkClass}>
								<div class="mb-3 flex items-center gap-2 text-muted-foreground">
									<Receipt class="size-4 shrink-0 md:size-5" />
									<span class="text-sm font-semibold tracking-tight text-foreground md:text-base"
										>Invoicing</span
									>
								</div>
								<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
									Unbilled (prior weeks)
								</p>
								<p
									class="mt-1.5 text-2xl font-semibold text-foreground tabular-nums md:text-3xl"
									aria-live="polite"
								>
									{data.unbilledPriorCount == null ? '–' : data.unbilledPriorCount}
								</p>
							</a>
							{#if data.lastWeekInvoiceCandidates.length > 0}
								<DashboardInvoicingTileFooter candidates={data.lastWeekInvoiceCandidates} />
							{/if}
						</div>
					</li>

					<li>
						<div class={cardClass}>
							<a href="/library" class={innerLinkClass}>
								<div class="mb-3 flex items-center gap-2 text-muted-foreground">
									<BookOpen class="size-4 shrink-0 md:size-5" />
									<span class="text-sm font-semibold tracking-tight text-foreground md:text-base"
										>Library</span
									>
								</div>
								<p class="text-sm text-muted-foreground">Open library</p>
							</a>
							{#if data.libraryNeedsReviewCount != null}
								<DashboardLibraryTileFooter
									needsReviewCount={data.libraryNeedsReviewCount}
									criticalRemaining={data.libraryCriticalRemaining ?? 0}
									backlogRemaining={data.libraryBacklogRemaining ?? 0}
								/>
							{:else}
								<div class="border-t border-border px-4 pb-3 pt-2.5 md:px-5 md:pb-4 md:pt-3">
									<span class="text-sm text-muted-foreground">Review queue: –</span>
								</div>
							{/if}
						</div>
					</li>

					<!-- Mobile / narrow: task counts only — desktop Now list is the right column -->
					<li class="md:hidden">
						<a
							href="/tasks"
							class={cn(
								cardClass,
								'p-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
							)}
						>
							<div class="mb-3 flex items-center gap-2 text-muted-foreground">
								<ListChecks class="size-4 shrink-0" />
								<span class="text-sm font-semibold tracking-tight text-foreground">Tasks</span>
							</div>
							<p class="text-xs font-medium tracking-wide text-muted-foreground uppercase">
								Open now
							</p>
							{#if !taskCountsLoaded}
								<p class="mt-1.5 text-2xl font-semibold text-foreground tabular-nums" aria-live="polite">
									–
								</p>
							{:else if taskBreakdown && taskBreakdown.length === 0}
								<p class="mt-1.5 text-2xl font-semibold text-foreground tabular-nums" aria-live="polite">
									0
								</p>
								<p class="mt-1 text-sm text-muted-foreground">No Critical or Opportunity</p>
							{:else if taskBreakdown && taskBreakdown.length === 1}
								{@const only = taskBreakdown[0]}
								<p
									class={cn(
										'mt-1.5 text-2xl font-semibold tabular-nums',
										only.tone === 'critical'
											? 'text-red-700 dark:text-red-400'
											: 'text-amber-800 dark:text-amber-400'
									)}
									aria-live="polite"
								>
									{only.count}
									<span class="ml-1.5 text-sm font-medium tracking-normal">{only.label}</span>
								</p>
							{:else if taskBreakdown}
								<div class="mt-2 flex flex-wrap items-end gap-x-5 gap-y-1" aria-live="polite">
									{#each taskBreakdown as part (part.tone)}
										<div class="min-w-0">
											<p
												class={cn(
													'text-2xl font-semibold tabular-nums',
													part.tone === 'critical'
														? 'text-red-700 dark:text-red-400'
														: 'text-amber-800 dark:text-amber-400'
												)}
											>
												{part.count}
											</p>
											<p
												class="mt-0.5 text-xs font-medium tracking-wide text-muted-foreground uppercase"
											>
												{part.label}
											</p>
										</div>
									{/each}
								</div>
							{/if}
							<p class="mt-3 text-sm font-medium text-primary">Open tasks →</p>
						</a>
					</li>
				</ul>
			</section>

			<DashboardUpcomingSermons sermons={data.upcomingSermons} />
		</div>

		<aside
			class="mt-6 hidden min-h-0 md:sticky md:top-0 md:mt-0 md:block md:max-h-[calc(100dvh-5rem)] md:overflow-y-auto"
			aria-labelledby="now-tasks-heading"
		>
			<div class="rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div class="min-w-0">
						<h2
							id="now-tasks-heading"
							class="text-sm font-semibold tracking-tight text-foreground"
						>
							Now
						</h2>
						<a
							href="/tasks"
							class="text-xs font-medium text-primary underline-offset-4 hover:underline"
						>
							Open full list
						</a>
					</div>
					<Button type="button" size="sm" class="gap-1" hotkey="b" onclick={openCreate}>
						<Plus class="size-3.5" />
						New
					</Button>
				</div>

				<ProjectTaskList
					zones={data.nowZones}
					compact={true}
					showProjectLabel={true}
					todayYmd={data.todayYmd}
					onEdit={openEdit}
					onInvalidate={onTaskSaved}
				/>
			</div>
		</aside>
	</div>
</div>

<ProjectTaskSheet
	bind:open={sheetOpen}
	mode={sheetMode}
	task={editingTask}
	series={editingSeries}
	projectOptions={data.projectOptions}
	defaultProjectId={data.defaultTaskProjectId}
	errorMessage={sheetError}
	onSaved={onTaskSaved}
/>
