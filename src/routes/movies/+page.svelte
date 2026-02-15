<script lang="ts">
	import { onMount } from 'svelte';
	import { csvParse } from 'd3-dsv';
	import { scaleLinear, scaleSequential } from 'd3-scale';
	// @ts-ignore missing types
	import { interpolateViridis } from 'd3-scale-chromatic';
	import { inflate } from 'pako';

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
	}

	const MARGIN = { top: 20, right: 20, bottom: 20, left: 20 };
	const TOOLTIP_OFFSET = 15;

	let movies = $state<Movie[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let hoveredMovie = $state<Movie | null>(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);
	let tooltipEl = $state<HTMLElement | undefined>();

	let containerW = $state(0);
	let containerH = $state(0);

	let colorBy = $state<MetricKey>('none');
	let sizeBy = $state<MetricKey>('none');
	let highlightGenre = $state<GenreKey | 'none'>('none');

	let svgW = $derived(containerW);
	let svgH = $derived(containerH - 56);
	let plotW = $derived(svgW - MARGIN.left - MARGIN.right);
	let plotH = $derived(svgH - MARGIN.top - MARGIN.bottom);

	function extent(arr: number[]): [number, number] {
		let lo = Infinity,
			hi = -Infinity;
		for (const v of arr) {
			if (v < lo) lo = v;
			if (v > hi) hi = v;
		}
		return [lo, hi];
	}

	let xDomain = $derived.by(() => {
		if (!movies.length) return [0, 1] as [number, number];
		return extent(movies.map((m) => m.x));
	});

	let yDomain = $derived.by(() => {
		if (!movies.length) return [0, 1] as [number, number];
		return extent(movies.map((m) => m.y));
	});

	let xScale = $derived(scaleLinear().domain(xDomain).range([0, plotW]));
	let yScale = $derived(scaleLinear().domain(yDomain).range([plotH, 0]));

	function metricValues(key: MetricKey): number[] {
		if (key === 'none') return [];
		return movies.map((m) => (m as any)[key]).filter((v: number) => !isNaN(v));
	}

	let colorScale = $derived.by(() => {
		if (colorBy === 'none' || !movies.length) return null;
		const vals = metricValues(colorBy);
		if (!vals.length) return null;
		return scaleSequential(interpolateViridis).domain(extent(vals));
	});

	let radiusScale = $derived.by(() => {
		if (sizeBy === 'none' || !movies.length) return null;
		const vals = metricValues(sizeBy);
		if (!vals.length) return null;
		return scaleLinear().domain(extent(vals)).range([2, 12]);
	});

	function dotColor(movie: Movie): string {
		if (!colorScale) return 'steelblue';
		const v = (movie as any)[colorBy];
		return isNaN(v) ? '#555' : String(colorScale(v));
	}

	function dotRadius(movie: Movie): number {
		if (!radiusScale) return 3;
		const v = (movie as any)[sizeBy];
		return isNaN(v) ? 3 : radiusScale(v);
	}

	function dotStroke(movie: Movie): string {
		return highlightGenre !== 'none' && movie.genres[highlightGenre] ? '#facc15' : 'none';
	}

	function dotStrokeWidth(movie: Movie): number {
		return highlightGenre !== 'none' && movie.genres[highlightGenre] ? 2 : 0;
	}

	function dotOpacity(movie: Movie): number {
		if (highlightGenre === 'none') return 0.8;
		return movie.genres[highlightGenre] ? 1 : 0.15;
	}

	function movieGenreLabels(movie: Movie): string {
		return GENRES.filter((g) => movie.genres[g.key])
			.map((g) => g.label)
			.join(', ');
	}

	function parseMovies(csv: string): Movie[] {
		return csvParse(csv)
			.map((d: any) => ({
				imdb_id: d.imdb_id,
				x: parseFloat(d.x),
				y: parseFloat(d.y),
				genres: Object.fromEntries(GENRES.map((g) => [g.key, d[g.key] === 'True'])) as Record<
					GenreKey,
					boolean
				>,
				metacritic: parseFloat(d.metacritic),
				plot: d.plot,
				title: d.title,
				rating: parseFloat(d.rating),
				rating_count: parseFloat(d.rating_count),
				year: parseInt(d.year),
				length_minutes: parseFloat(d.length_minutes),
				img_link: d.img_link
			}))
			.filter((m) => !isNaN(m.x) && !isNaN(m.y));
	}

	onMount(async () => {
		try {
			const res = await fetch('http://tmp-borza-public-cyx.s3.amazonaws.com/imdb-comp.csv.gz');
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const buf = await res.arrayBuffer();
			const text = inflate(new Uint8Array(buf), { to: 'string' });
			movies = parseMovies(text);
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});

	function onDotMove(e: MouseEvent, movie: Movie) {
		hoveredMovie = movie;
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
</script>

<div class="page" bind:clientWidth={containerW} bind:clientHeight={containerH}>
	<header class="controls" role="toolbar" aria-label="Visualization controls">
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
		<svg width={svgW} height={svgH}>
			<g transform="translate({MARGIN.left},{MARGIN.top})">
				{#each movies as movie (movie.imdb_id)}
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<circle
						cx={xScale(movie.x)}
						cy={yScale(movie.y)}
						r={dotRadius(movie) + 6}
						fill="transparent"
						onmousemove={(e: MouseEvent) => onDotMove(e, movie)}
						onmouseleave={() => (hoveredMovie = null)}
					/>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<circle
						class="dot"
						cx={xScale(movie.x)}
						cy={yScale(movie.y)}
						r={dotRadius(movie)}
						fill={dotColor(movie)}
						stroke={dotStroke(movie)}
						stroke-width={dotStrokeWidth(movie)}
						opacity={dotOpacity(movie)}
						onmousemove={(e: MouseEvent) => onDotMove(e, movie)}
						onmouseleave={() => (hoveredMovie = null)}
					/>
				{/each}
			</g>
		</svg>

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
		gap: 16px;
		padding: 8px 16px;
		background: #1e293b;
		border-bottom: 1px solid #334155;
		flex-shrink: 0;
		overflow-x: auto;
		min-height: 40px;
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
		flex-wrap: nowrap;
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

	svg {
		flex: 1;
		background: #0f172a;
	}

	.dot {
		cursor: pointer;
		transition:
			r 0.15s,
			fill 0.15s,
			opacity 0.25s;
	}

	.dot:hover {
		r: 8;
		fill: #f59e0b;
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
