/**
 * Per-request Server-Timing segments (see hooks.server.ts).
 */
export type PerfSegment = { name: string; dur: number };

export type PerfCollector = {
	segments: PerfSegment[];
	measure<T>(name: string, fn: () => Promise<T>): Promise<T>;
	formatServerTiming(): string;
};

export function createPerfCollector(): PerfCollector {
	const segments: PerfSegment[] = [];
	return {
		segments,
		async measure<T>(name: string, fn: () => Promise<T>): Promise<T> {
			const t0 = performance.now();
			try {
				return await fn();
			} finally {
				segments.push({ name, dur: Math.round(performance.now() - t0) });
			}
		},
		formatServerTiming(): string {
			return segments.map((s) => `${s.name};dur=${s.dur}`).join(', ');
		}
	};
}

export function mergeServerTimingHeaders(...parts: string[]): string {
	return parts.filter((p) => p.length > 0).join(', ');
}
