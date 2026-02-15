<script lang="ts">
	import { onMount } from 'svelte';

	const GENRES = [
		{ key: 'action', label: 'Action' },
		{ key: 'adventure', label: 'Adventure' },
		{ key: 'animation', label: 'Animation' },
		{ key: 'biography', label: 'Biography' },
		{ key: 'comedy', label: 'Comedy' },
		{ key: 'crime', label: 'Crime' },
		{ key: 'documentary', label: 'Documentary' },
		{ key: 'drama', label: 'Drama' },
		{ key: 'family', label: 'Family' },
		{ key: 'fantasy', label: 'Fantasy' },
		{ key: 'film_noir', label: 'Film Noir' },
		{ key: 'history', label: 'History' },
		{ key: 'horror', label: 'Horror' },
		{ key: 'music', label: 'Music' },
		{ key: 'musical', label: 'Musical' },
		{ key: 'mystery', label: 'Mystery' },
		{ key: 'romance', label: 'Romance' },
		{ key: 'sci_fi', label: 'Sci-Fi' },
		{ key: 'sport', label: 'Sport' },
		{ key: 'thriller', label: 'Thriller' },
		{ key: 'war', label: 'War' },
		{ key: 'western', label: 'Western' }
	] as const;

	type GenreKey = (typeof GENRES)[number]['key'];

	const METRIC_OPTIONS = [
		{ value: 'none', label: 'None' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'metacritic', label: 'Metascore' },
		{ value: 'year', label: 'Year' },
		{ value: 'length_minutes', label: 'Length' },
		{ value: 'rating_count', label: 'Votes' }
	] as const;

	type MetricKey = (typeof METRIC_OPTIONS)[number]['value'];

	interface Movie {
		imdb_id: string;
		x: number;
		y: number;
		genres: Record<GenreKey, boolean>;
		metacritic: number;
		plot: string;
		title: string;
		rating: number;
		rating_count: number;
		year: number;
		length_minutes: number;
		img_link: string;
		px: number;
		py: number;
	}

	// Viridis colormap (11 stops sampled from matplotlib)
	const VIRIDIS: [number, number, number][] = [
		[68, 1, 84],
		[72, 35, 116],
		[64, 67, 135],
		[52, 94, 141],
		[41, 120, 142],
		[32, 144, 140],
		[34, 167, 132],
		[68, 190, 112],
		[121, 209, 81],
		[189, 222, 38],
		[253, 231, 37]
	];

	function viridis(t: number): string {
		t = Math.max(0, Math.min(1, t));
		const idx = t * (VIRIDIS.length - 1);
		const lo = Math.floor(idx);
		const hi = Math.min(lo + 1, VIRIDIS.length - 1);
		const f = idx - lo;
		const r = Math.round(VIRIDIS[lo][0] + f * (VIRIDIS[hi][0] - VIRIDIS[lo][0]));
		const g = Math.round(VIRIDIS[lo][1] + f * (VIRIDIS[hi][1] - VIRIDIS[lo][1]));
		const b = Math.round(VIRIDIS[lo][2] + f * (VIRIDIS[hi][2] - VIRIDIS[lo][2]));
		return `rgb(${r},${g},${b})`;
	}

	function lerp(a: number, b: number, t: number): number {
		return a + (b - a) * t;
	}

	function invLerp(a: number, b: number, v: number): number {
		return a === b ? 0 : (v - a) / (b - a);
	}

	function extent(arr: number[]): [number, number] {
		let lo = Infinity,
			hi = -Infinity;
		for (const v of arr) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		return [lo, hi];
	}

	const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
	const TOOLTIP_OFFSET = 15;
	const DPR = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;

	let movies = $state<Movie[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let hoveredMovie = $state<Movie | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipEl = $state<HTMLElement | undefined>();

	let containerW = $state(0);
	let containerH = $state(0);
	let headerH = $state(0);

	let colorBy = $state<MetricKey>('none');
	let sizeBy = $state<MetricKey>('none');
	let highlightGenre = $state<GenreKey | 'none'>('none');

	let canvasEl = $state<HTMLCanvasElement | undefined>();

	let canvasW = $derived(containerW);
	let canvasH = $derived(Math.max(0, containerH - headerH));
	let plotW = $derived(canvasW - MARGIN.left - MARGIN.right);
	let plotH = $derived(canvasH - MARGIN.top - MARGIN.bottom);

	let xDomain: [number, number] = [0, 1];
	let yDomain: [number, number] = [0, 1];

	function computePixelPositions() {
		if (!movies.length || plotW <= 0 || plotH <= 0) return;
		for (const m of movies) {
			m.px = MARGIN.left + lerp(0, plotW, invLerp(xDomain[0], xDomain[1], m.x));
			m.py = MARGIN.top + lerp(plotH, 0, invLerp(yDomain[0], yDomain[1], m.y));
		}
	}

	function metricExtent(key: MetricKey): [number, number] {
		if (key === 'none' || !movies.length) return [0, 1];
		const vals = movies.map((m) => (m as any)[key]).filter((v: number) => !isNaN(v));
		return vals.length ? extent(vals) : [0, 1];
	}

	function metricLabel(key: MetricKey): string {
		return METRIC_OPTIONS.find((o) => o.value === key)?.label ?? '';
	}

	function formatMetricValue(key: MetricKey, v: number): string {
		if (key === 'year') return String(Math.round(v));
		if (key === 'rating_count')
			return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
		if (key === 'length_minutes') return `${Math.round(v)}m`;
		return v.toFixed(1);
	}

	let colorExtent = $derived(metricExtent(colorBy));
	let sizeExtent = $derived(metricExtent(sizeBy));

	let rafId = 0;

	function scheduleRedraw() {
		cancelAnimationFrame(rafId);
		rafId = requestAnimationFrame(draw);
	}

	function draw() {
		const canvas = canvasEl;
		if (!canvas || canvasW <= 0 || canvasH <= 0) return;

		canvas.width = canvasW * DPR;
		canvas.height = canvasH * DPR;
		canvas.style.width = `${canvasW}px`;
		canvas.style.height = `${canvasH}px`;

		const ctx = canvas.getContext('2d')!;
		ctx.scale(DPR, DPR);
		ctx.clearRect(0, 0, canvasW, canvasH);

		const cExt = colorExtent;
		const sExt = sizeExtent;
		const genre = highlightGenre;
		const cBy = colorBy;
		const sby = sizeBy;

		for (const m of movies) {
			const highlighted = genre === 'none' || m.genres[genre];
			const alpha = genre === 'none' ? 0.8 : highlighted ? 1 : 0.15;

			let r = 3;
			if (sby !== 'none') {
				const v = (m as any)[sby];
				if (!isNaN(v)) r = lerp(2, 12, invLerp(sExt[0], sExt[1], v));
			}

			let color = 'rgb(70,130,180)'; // steelblue
			if (cBy !== 'none') {
				const v = (m as any)[cBy];
				if (!isNaN(v)) color = viridis(invLerp(cExt[0], cExt[1], v));
				else color = 'rgb(85,85,85)';
			}

			ctx.globalAlpha = alpha;
			ctx.beginPath();
			ctx.arc(m.px, m.py, r, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();

			if (genre !== 'none' && highlighted) {
				ctx.strokeStyle = '#facc15';
				ctx.lineWidth = 2;
				ctx.stroke();
			}
		}
		ctx.globalAlpha = 1;
	}

	$effect(() => {
		// Track reactive dependencies
		colorBy;
		sizeBy;
		highlightGenre;
		colorExtent;
		sizeExtent;
		movies.length;
		scheduleRedraw();
	});

	$effect(() => {
		if (plotW > 0 && plotH > 0 && movies.length) {
			computePixelPositions();
			scheduleRedraw();
		}
	});

	function movieGenreLabels(movie: Movie): string {
		return GENRES.filter((g) => movie.genres[g.key])
			.map((g) => g.label)
			.join(', ');
	}

	onMount(async () => {
		try {
			const res = await fetch('http://tmp-borza-public-cyx.s3.amazonaws.com/imdb-comp.json.gz');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data: any[] = await res.json();
			const parsed: Movie[] = [];
			for (const d of data) {
				const x = d.x,
					y = d.y;
				if (typeof x !== 'number' || typeof y !== 'number' || isNaN(x) || isNaN(y)) continue;
				parsed.push({
					imdb_id: d.imdb_id,
					x,
					y,
					genres: Object.fromEntries(GENRES.map((g) => [g.key, !!d[g.key]])) as Record<
						GenreKey,
						boolean
					>,
					metacritic: d.metacritic ?? NaN,
					plot: d.plot ?? '',
					title: d.title ?? '',
					rating: d.rating ?? NaN,
					rating_count: d.rating_count ?? NaN,
					year: d.year ?? NaN,
					length_minutes: d.length_minutes ?? NaN,
					img_link: d.img_link ?? '',
					px: 0,
					py: 0
				});
			}
			xDomain = extent(parsed.map((m) => m.x));
			yDomain = extent(parsed.map((m) => m.y));
			movies = parsed;
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});

	function findNearestMovie(cx: number, cy: number): Movie | null {
		let best: Movie | null = null;
		let bestDist = 20 * 20; // 20px max distance
		for (const m of movies) {
			const dx = m.px - cx;
			const dy = m.py - cy;
			const d2 = dx * dx + dy * dy;
			if (d2 < bestDist) {
				bestDist = d2;
				best = m;
			}
		}
		return best;
	}

	function onCanvasMove(e: MouseEvent) {
		const rect = canvasEl!.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;
		const movie = findNearestMovie(cx, cy);
		hoveredMovie = movie;
		if (movie) {
			let nx = e.clientX + TOOLTIP_OFFSET;
			let ny = e.clientY + TOOLTIP_OFFSET;
			if (tooltipEl) {
				if (nx + tooltipEl.offsetWidth > window.innerWidth)
					nx = e.clientX - TOOLTIP_OFFSET - tooltipEl.offsetWidth;
				if (ny + tooltipEl.offsetHeight > window.innerHeight)
					ny = e.clientY - TOOLTIP_OFFSET - tooltipEl.offsetHeight;
			}
			tooltipX = nx;
			tooltipY = ny;
		}
	}

	function onCanvasLeave() {
		hoveredMovie = null;
	}

	// Legend gradient: generate CSS gradient string
	let colorGradient = $derived.by(() => {
		if (colorBy === 'none') return '';
		const stops = 10;
		const parts: string[] = [];
		for (let i = 0; i <= stops; i++) {
			parts.push(viridis(i / stops));
		}
		return `linear-gradient(to right, ${parts.join(', ')})`;
	});
</script>

<div class="page" bind:clientWidth={containerW} bind:clientHeight={containerH}>
	<header
		class="controls"
		bind:clientHeight={headerH}
		role="toolbar"
		aria-label="Visualization controls"
	>
		<div class="control">
			<label for="colorBy">Color</label>
			<select id="colorBy" bind:value={colorBy}>
				{#each METRIC_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="control">
			<label for="sizeBy">Size</label>
			<select id="sizeBy" bind:value={sizeBy}>
				{#each METRIC_OPTIONS as opt}
					<option value={opt.value}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="control genre-pills">
			<span class="label">Genre</span>
			<button
				class="pill"
				class:active={highlightGenre === 'none'}
				onclick={() => (highlightGenre = 'none')}
			>
				All
			</button>
			{#each GENRES as g}
				<button
					class="pill"
					class:active={highlightGenre === g.key}
					onclick={() => (highlightGenre = highlightGenre === g.key ? 'none' : g.key)}
				>
					{g.label}
				</button>
			{/each}
		</div>
	</header>

	{#if loading}
		<div class="status">Loading movies...</div>
	{:else if error}
		<div class="status error">Error: {error}</div>
	{:else}
		<div class="canvas-container">
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<canvas
				bind:this={canvasEl}
				onmousemove={onCanvasMove}
				onmouseleave={onCanvasLeave}
				style="cursor:crosshair"
			></canvas>

			<div class="legends">
				{#if colorBy !== 'none'}
					<div class="legend color-legend">
						<span class="legend-label">{metricLabel(colorBy)}</span>
						<div class="gradient-bar" style="background:{colorGradient}"></div>
						<div class="legend-range">
							<span>{formatMetricValue(colorBy, colorExtent[0])}</span>
							<span>{formatMetricValue(colorBy, colorExtent[1])}</span>
						</div>
					</div>
				{/if}
				{#if sizeBy !== 'none'}
					<div class="legend size-legend">
						<span class="legend-label">{metricLabel(sizeBy)}</span>
						<div class="size-samples">
							<div class="size-sample">
								<svg width="28" height="28"><circle cx="14" cy="14" r="2" fill="#94a3b8" /></svg>
								<span>{formatMetricValue(sizeBy, sizeExtent[0])}</span>
							</div>
							<div class="size-sample">
								<svg width="28" height="28"><circle cx="14" cy="14" r="7" fill="#94a3b8" /></svg>
								<span>{formatMetricValue(sizeBy, (sizeExtent[0] + sizeExtent[1]) / 2)}</span>
							</div>
							<div class="size-sample">
								<svg width="28" height="28"><circle cx="14" cy="14" r="12" fill="#94a3b8" /></svg>
								<span>{formatMetricValue(sizeBy, sizeExtent[1])}</span>
							</div>
						</div>
					</div>
				{/if}
			</div>
		</div>

		{#if hoveredMovie}
			<div bind:this={tooltipEl} class="tooltip" style="left:{tooltipX}px;top:{tooltipY}px">
				<strong class="tt-title">{hoveredMovie.title}</strong>
				<span class="tt-year">{hoveredMovie.year}</span>
				<div class="tt-row">
					<span>{hoveredMovie.rating} / 10</span>
					<span class="tt-dim">{hoveredMovie.rating_count.toLocaleString()} votes</span>
				</div>
				{#if !isNaN(hoveredMovie.metacritic)}
					<div class="tt-row">Metascore {hoveredMovie.metacritic}</div>
				{/if}
				<div class="tt-row">{hoveredMovie.length_minutes} min</div>
				<div class="tt-genres">{movieGenreLabels(hoveredMovie)}</div>
				{#if hoveredMovie.plot}
					<p class="tt-plot">
						{hoveredMovie.plot.length > 150
							? hoveredMovie.plot.slice(0, 150) + '...'
							: hoveredMovie.plot}
					</p>
				{/if}
				{#if hoveredMovie.img_link && hoveredMovie.img_link !== 'nan'}
					<img src={hoveredMovie.img_link} alt={hoveredMovie.title} />
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	:global(body, html) {
		margin: 0;
		padding: 0;
		overflow: hidden;
	}

	.page {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #0f172a;
		color: #e2e8f0;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
	}

	.controls {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		background: #1e293b;
		border-bottom: 1px solid #334155;
		flex-shrink: 0;
		flex-wrap: wrap;
	}

	.control {
		display: flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.control label,
	.label {
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
	}

	select {
		background: #0f172a;
		color: #e2e8f0;
		border: 1px solid #475569;
		border-radius: 4px;
		padding: 4px 8px;
		font-size: 0.8rem;
		cursor: pointer;
	}

	select:focus {
		outline: 1px solid #60a5fa;
		border-color: #60a5fa;
	}

	.genre-pills {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-wrap: wrap;
	}

	.pill {
		background: #1e293b;
		color: #94a3b8;
		border: 1px solid #334155;
		border-radius: 12px;
		padding: 2px 10px;
		font-size: 0.7rem;
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s;
	}

	.pill:hover {
		border-color: #60a5fa;
		color: #e2e8f0;
	}

	.pill.active {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.status {
		flex: 1;
		display: grid;
		place-items: center;
		font-size: 1.1rem;
		color: #94a3b8;
	}

	.status.error {
		color: #f87171;
	}

	.canvas-container {
		flex: 1;
		position: relative;
		min-height: 0;
	}

	canvas {
		display: block;
	}

	.legends {
		position: absolute;
		bottom: 16px;
		right: 16px;
		display: flex;
		flex-direction: column;
		gap: 12px;
		pointer-events: none;
	}

	.legend {
		background: rgba(30, 41, 59, 0.9);
		border: 1px solid #334155;
		border-radius: 6px;
		padding: 8px 12px;
		font-size: 0.75rem;
	}

	.legend-label {
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		display: block;
		margin-bottom: 4px;
	}

	.gradient-bar {
		height: 10px;
		border-radius: 3px;
		width: 140px;
	}

	.legend-range {
		display: flex;
		justify-content: space-between;
		color: #cbd5e1;
		font-size: 0.7rem;
		margin-top: 2px;
	}

	.size-samples {
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}

	.size-sample {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		color: #cbd5e1;
		font-size: 0.65rem;
	}

	.tooltip {
		position: fixed;
		background: #1e293b;
		border: 1px solid #475569;
		color: #e2e8f0;
		padding: 10px 12px;
		border-radius: 8px;
		pointer-events: none;
		z-index: 100;
		max-width: 280px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
		font-size: 0.82rem;
		line-height: 1.5;
	}

	.tt-title {
		color: #facc15;
		font-size: 0.95rem;
	}

	.tt-year {
		color: #94a3b8;
		margin-left: 6px;
	}

	.tt-row {
		display: flex;
		gap: 8px;
	}

	.tt-dim {
		color: #64748b;
	}

	.tt-genres {
		color: #60a5fa;
		font-size: 0.75rem;
		margin-top: 2px;
	}

	.tt-plot {
		margin: 4px 0 0;
		color: #94a3b8;
		font-size: 0.78rem;
	}

	.tooltip img {
		max-width: 120px;
		border-radius: 4px;
		margin-top: 6px;
	}
</style>
