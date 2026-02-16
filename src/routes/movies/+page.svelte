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

	const COLOR_OPTIONS = [
		{ value: 'none', label: 'None' },
		{ value: 'rating', label: 'Rating' },
		{ value: 'metacritic', label: 'Metascore' },
		{ value: 'log_rating_count', label: 'log(Votes)' }
	] as const;

	type ColorKey = (typeof COLOR_OPTIONS)[number]['value'];

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

	function clamp(v: number, lo: number, hi: number): number {
		return Math.max(lo, Math.min(hi, v));
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

	let colorBy = $state<ColorKey>('none');
	let highlightGenre = $state<GenreKey | 'none'>('none');

	let canvasEl = $state<HTMLCanvasElement | undefined>();

	let canvasW = $derived(containerW);
	let canvasH = $derived(Math.max(0, containerH - headerH));
	let plotW = $derived(canvasW - MARGIN.left - MARGIN.right);
	let plotH = $derived(canvasH - MARGIN.top - MARGIN.bottom);

	// Data domains (full extent)
	let xDomain: [number, number] = [0, 1];
	let yDomain: [number, number] = [0, 1];

	// View domains (current zoom)
	let viewXMin = $state(0);
	let viewXMax = $state(1);
	let viewYMin = $state(0);
	let viewYMax = $state(1);

	// Filter ranges
	let yearMin = $state(0);
	let yearMax = $state(0);
	let yearLo = $state(0);
	let yearHi = $state(0);
	let metascoreMin = $state(0);
	let metascoreMax = $state(0);
	let metascoreLo = $state(0);
	let metascoreHi = $state(0);
	let ratingMin = $state(0);
	let ratingMax = $state(0);
	let ratingLo = $state(0);
	let ratingHi = $state(0);
	let rcountMin = $state(0);
	let rcountMax = $state(0);
	let rcountLo = $state(0);
	let rcountHi = $state(0);

	let filteredMovies = $derived(
		movies.filter((m) => {
			if (m.year < yearLo || m.year > yearHi) return false;
			if (!isNaN(m.metacritic) && (m.metacritic < metascoreLo || m.metacritic > metascoreHi))
				return false;
			if (m.rating < ratingLo || m.rating > ratingHi) return false;
			if (m.rating_count < rcountLo || m.rating_count > rcountHi) return false;
			return true;
		})
	);

	// Box selection state
	let selecting = $state(false);
	let selStartX = $state(0);
	let selStartY = $state(0);
	let selCurX = $state(0);
	let selCurY = $state(0);

	function computePixelPositions() {
		if (!movies.length || plotW <= 0 || plotH <= 0) return;
		for (const m of movies) {
			m.px = MARGIN.left + lerp(0, plotW, invLerp(viewXMin, viewXMax, m.x));
			m.py = MARGIN.top + lerp(plotH, 0, invLerp(viewYMin, viewYMax, m.y));
		}
	}

	function getColorValue(m: Movie): number {
		if (colorBy === 'rating') return m.rating;
		if (colorBy === 'metacritic') return m.metacritic;
		if (colorBy === 'log_rating_count') return isNaN(m.rating_count) ? NaN : Math.log10(m.rating_count);
		return NaN;
	}

	function colorExtentForKey(): [number, number] {
		if (colorBy === 'none' || !movies.length) return [0, 1];
		const vals = movies.map((m) => getColorValue(m)).filter((v) => !isNaN(v));
		return vals.length ? extent(vals) : [0, 1];
	}

	function colorLabel(): string {
		return COLOR_OPTIONS.find((o) => o.value === colorBy)?.label ?? '';
	}

	function formatColorValue(v: number): string {
		if (colorBy === 'log_rating_count') return v.toFixed(1);
		if (colorBy === 'metacritic') return v.toFixed(0);
		return v.toFixed(1);
	}

	let colorExtent = $derived(colorExtentForKey());

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
		const genre = highlightGenre;
		const cBy = colorBy;

		for (const m of filteredMovies) {
			const highlighted = genre === 'none' || m.genres[genre];
			const alpha = genre === 'none' ? 0.8 : highlighted ? 1 : 0.15;

			let color = 'rgb(70,130,180)';
			if (cBy !== 'none') {
				const v = getColorValue(m);
				if (!isNaN(v)) color = viridis(invLerp(cExt[0], cExt[1], v));
				else color = 'rgb(85,85,85)';
			}

			ctx.globalAlpha = alpha;
			ctx.beginPath();
			ctx.arc(m.px, m.py, 3, 0, Math.PI * 2);
			ctx.fillStyle = color;
			ctx.fill();

			if (genre !== 'none' && highlighted) {
				ctx.strokeStyle = '#facc15';
				ctx.lineWidth = 2;
				ctx.stroke();
			}
		}

		// Draw selection rectangle
		if (selecting) {
			ctx.globalAlpha = 1;
			const sx = Math.min(selStartX, selCurX);
			const sy = Math.min(selStartY, selCurY);
			const sw = Math.abs(selCurX - selStartX);
			const sh = Math.abs(selCurY - selStartY);
			ctx.strokeStyle = '#60a5fa';
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.strokeRect(sx, sy, sw, sh);
			ctx.setLineDash([]);
			ctx.fillStyle = 'rgba(96, 165, 250, 0.1)';
			ctx.fillRect(sx, sy, sw, sh);
		}

		ctx.globalAlpha = 1;
	}

	$effect(() => {
		colorBy;
		highlightGenre;
		colorExtent;
		filteredMovies.length;
		selecting;
		selCurX;
		selCurY;
		scheduleRedraw();
	});

	$effect(() => {
		if (plotW > 0 && plotH > 0 && movies.length) {
			viewXMin;
			viewXMax;
			viewYMin;
			viewYMax;
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
			viewXMin = xDomain[0];
			viewXMax = xDomain[1];
			viewYMin = yDomain[0];
			viewYMax = yDomain[1];

			// Initialize filter extents
			const years = parsed.map((m) => m.year).filter((v) => !isNaN(v));
			const metas = parsed.map((m) => m.metacritic).filter((v) => !isNaN(v));
			const rats = parsed.map((m) => m.rating).filter((v) => !isNaN(v));
			const rcounts = parsed.map((m) => m.rating_count).filter((v) => !isNaN(v));

			const ye = years.length ? extent(years) : [0, 0];
			yearMin = ye[0]; yearMax = ye[1]; yearLo = ye[0]; yearHi = ye[1];

			const me = metas.length ? extent(metas) : [0, 0];
			metascoreMin = me[0]; metascoreMax = me[1]; metascoreLo = me[0]; metascoreHi = me[1];

			const re = rats.length ? extent(rats) : [0, 0];
			ratingMin = re[0]; ratingMax = re[1]; ratingLo = re[0]; ratingHi = re[1];

			const rce = rcounts.length ? extent(rcounts) : [0, 0];
			rcountMin = rce[0]; rcountMax = rce[1]; rcountLo = rce[0]; rcountHi = rce[1];

			movies = parsed;
		} catch (e: any) {
			error = e.message;
		} finally {
			loading = false;
		}
	});

	function findNearestMovie(cx: number, cy: number): Movie | null {
		let best: Movie | null = null;
		let bestDist = 20 * 20;
		for (const m of filteredMovies) {
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

	function pixelToData(px: number, py: number): [number, number] {
		const tx = invLerp(MARGIN.left, MARGIN.left + plotW, px);
		const ty = invLerp(MARGIN.top, MARGIN.top + plotH, py);
		const dx = lerp(viewXMin, viewXMax, tx);
		const dy = lerp(viewYMax, viewYMin, ty); // Y flipped
		return [dx, dy];
	}

	function onCanvasMove(e: MouseEvent) {
		const rect = canvasEl!.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;

		if (selecting) {
			selCurX = cx;
			selCurY = cy;
			return;
		}

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
		if (!selecting) hoveredMovie = null;
	}

	function onCanvasWheel(e: WheelEvent) {
		e.preventDefault();
		const rect = canvasEl!.getBoundingClientRect();
		const cx = e.clientX - rect.left;
		const cy = e.clientY - rect.top;

		const [dx, dy] = pixelToData(cx, cy);

		const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15;

		viewXMin = dx + (viewXMin - dx) * factor;
		viewXMax = dx + (viewXMax - dx) * factor;
		viewYMin = dy + (viewYMin - dy) * factor;
		viewYMax = dy + (viewYMax - dy) * factor;
	}

	function onCanvasDown(e: MouseEvent) {
		if (e.button !== 0) return;
		const rect = canvasEl!.getBoundingClientRect();
		selStartX = e.clientX - rect.left;
		selStartY = e.clientY - rect.top;
		selCurX = selStartX;
		selCurY = selStartY;
		selecting = true;
		hoveredMovie = null;
	}

	function onCanvasUp(e: MouseEvent) {
		if (!selecting) return;
		selecting = false;

		const rect = canvasEl!.getBoundingClientRect();
		const endX = e.clientX - rect.left;
		const endY = e.clientY - rect.top;

		const dx = Math.abs(endX - selStartX);
		const dy = Math.abs(endY - selStartY);

		// Only zoom if drag was meaningful (> 5px)
		if (dx < 5 || dy < 5) return;

		const [d1x, d1y] = pixelToData(Math.min(selStartX, endX), Math.min(selStartY, endY));
		const [d2x, d2y] = pixelToData(Math.max(selStartX, endX), Math.max(selStartY, endY));

		viewXMin = d1x;
		viewXMax = d2x;
		viewYMin = d2y; // flipped
		viewYMax = d1y; // flipped
	}

	function resetView() {
		viewXMin = xDomain[0];
		viewXMax = xDomain[1];
		viewYMin = yDomain[0];
		viewYMax = yDomain[1];
	}

	let isZoomed = $derived(
		viewXMin !== xDomain[0] ||
			viewXMax !== xDomain[1] ||
			viewYMin !== yDomain[0] ||
			viewYMax !== yDomain[1]
	);

	let colorGradient = $derived.by(() => {
		if (colorBy === 'none') return '';
		const stops = 10;
		const parts: string[] = [];
		for (let i = 0; i <= stops; i++) {
			parts.push(viridis(i / stops));
		}
		return `linear-gradient(to right, ${parts.join(', ')})`;
	});

	function formatFilterValue(key: string, v: number): string {
		if (key === 'year') return String(Math.round(v));
		if (key === 'rcount')
			return v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(Math.round(v));
		return v.toFixed(1);
	}
</script>

<div class="page" bind:clientWidth={containerW} bind:clientHeight={containerH}>
	<header
		class="controls"
		bind:clientHeight={headerH}
		role="toolbar"
		aria-label="Visualization controls"
	>
		<div class="controls-top">
			<div class="control">
				<label for="colorBy">Color</label>
				<select id="colorBy" bind:value={colorBy}>
					{#each COLOR_OPTIONS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			{#if isZoomed}
				<button class="reset-btn" onclick={resetView}>Reset View</button>
			{/if}

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
		</div>

		<div class="filters">
			<div class="filter">
				<span class="filter-label">Year</span>
				<span class="filter-value">{formatFilterValue('year', yearLo)}</span>
				<div class="range-wrap">
					<input
						type="range"
						min={yearMin}
						max={yearMax}
						step="1"
						bind:value={yearLo}
						oninput={() => { if (yearLo > yearHi) yearLo = yearHi; }}
					/>
					<input
						type="range"
						min={yearMin}
						max={yearMax}
						step="1"
						bind:value={yearHi}
						oninput={() => { if (yearHi < yearLo) yearHi = yearLo; }}
					/>
					<div
						class="range-track-fill"
						style="left:{invLerp(yearMin, yearMax, yearLo) * 100}%;right:{(1 - invLerp(yearMin, yearMax, yearHi)) * 100}%"
					></div>
				</div>
				<span class="filter-value">{formatFilterValue('year', yearHi)}</span>
			</div>

			<div class="filter">
				<span class="filter-label">Metascore</span>
				<span class="filter-value">{formatFilterValue('meta', metascoreLo)}</span>
				<div class="range-wrap">
					<input
						type="range"
						min={metascoreMin}
						max={metascoreMax}
						step="1"
						bind:value={metascoreLo}
						oninput={() => { if (metascoreLo > metascoreHi) metascoreLo = metascoreHi; }}
					/>
					<input
						type="range"
						min={metascoreMin}
						max={metascoreMax}
						step="1"
						bind:value={metascoreHi}
						oninput={() => { if (metascoreHi < metascoreLo) metascoreHi = metascoreLo; }}
					/>
					<div
						class="range-track-fill"
						style="left:{invLerp(metascoreMin, metascoreMax, metascoreLo) * 100}%;right:{(1 - invLerp(metascoreMin, metascoreMax, metascoreHi)) * 100}%"
					></div>
				</div>
				<span class="filter-value">{formatFilterValue('meta', metascoreHi)}</span>
			</div>

			<div class="filter">
				<span class="filter-label">Rating</span>
				<span class="filter-value">{formatFilterValue('rating', ratingLo)}</span>
				<div class="range-wrap">
					<input
						type="range"
						min={ratingMin}
						max={ratingMax}
						step="0.1"
						bind:value={ratingLo}
						oninput={() => { if (ratingLo > ratingHi) ratingLo = ratingHi; }}
					/>
					<input
						type="range"
						min={ratingMin}
						max={ratingMax}
						step="0.1"
						bind:value={ratingHi}
						oninput={() => { if (ratingHi < ratingLo) ratingHi = ratingLo; }}
					/>
					<div
						class="range-track-fill"
						style="left:{invLerp(ratingMin, ratingMax, ratingLo) * 100}%;right:{(1 - invLerp(ratingMin, ratingMax, ratingHi)) * 100}%"
					></div>
				</div>
				<span class="filter-value">{formatFilterValue('rating', ratingHi)}</span>
			</div>

			<div class="filter">
				<span class="filter-label">Votes</span>
				<span class="filter-value">{formatFilterValue('rcount', rcountLo)}</span>
				<div class="range-wrap">
					<input
						type="range"
						min={rcountMin}
						max={rcountMax}
						step="1"
						bind:value={rcountLo}
						oninput={() => { if (rcountLo > rcountHi) rcountLo = rcountHi; }}
					/>
					<input
						type="range"
						min={rcountMin}
						max={rcountMax}
						step="1"
						bind:value={rcountHi}
						oninput={() => { if (rcountHi < rcountLo) rcountHi = rcountLo; }}
					/>
					<div
						class="range-track-fill"
						style="left:{invLerp(rcountMin, rcountMax, rcountLo) * 100}%;right:{(1 - invLerp(rcountMin, rcountMax, rcountHi)) * 100}%"
					></div>
				</div>
				<span class="filter-value">{formatFilterValue('rcount', rcountHi)}</span>
			</div>
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
				onmousedown={onCanvasDown}
				onmouseup={onCanvasUp}
				onwheel={onCanvasWheel}
				style="cursor:crosshair"
			></canvas>

			<div class="legends">
				{#if colorBy !== 'none'}
					<div class="legend color-legend">
						<span class="legend-label">{colorLabel()}</span>
						<div class="gradient-bar" style="background:{colorGradient}"></div>
						<div class="legend-range">
							<span>{formatColorValue(colorExtent[0])}</span>
							<span>{formatColorValue(colorExtent[1])}</span>
						</div>
					</div>
				{/if}
			</div>

			<div class="movie-count">{filteredMovies.length.toLocaleString()} movies</div>
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
		flex-direction: column;
		background: #1e293b;
		border-bottom: 1px solid #334155;
		flex-shrink: 0;
	}

	.controls-top {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		flex-wrap: wrap;
	}

	.filters {
		display: flex;
		gap: 16px;
		padding: 4px 16px 8px;
		flex-wrap: wrap;
	}

	.filter {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 1;
		min-width: 180px;
	}

	.filter-label {
		font-size: 0.7rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: #94a3b8;
		width: 60px;
		flex-shrink: 0;
	}

	.filter-value {
		font-size: 0.7rem;
		color: #cbd5e1;
		min-width: 30px;
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	.range-wrap {
		position: relative;
		flex: 1;
		height: 20px;
	}

	.range-wrap input[type='range'] {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		margin: 0;
		padding: 0;
		-webkit-appearance: none;
		appearance: none;
		background: transparent;
		pointer-events: none;
		outline: none;
	}

	.range-wrap input[type='range']::-webkit-slider-thumb {
		-webkit-appearance: none;
		height: 14px;
		width: 14px;
		border-radius: 50%;
		background: #60a5fa;
		border: 2px solid #1e293b;
		cursor: pointer;
		pointer-events: all;
		position: relative;
		z-index: 2;
	}

	.range-wrap input[type='range']::-moz-range-thumb {
		height: 14px;
		width: 14px;
		border-radius: 50%;
		background: #60a5fa;
		border: 2px solid #1e293b;
		cursor: pointer;
		pointer-events: all;
		position: relative;
		z-index: 2;
	}

	.range-wrap input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		background: #334155;
		border-radius: 2px;
	}

	.range-wrap input[type='range']::-moz-range-track {
		height: 4px;
		background: #334155;
		border-radius: 2px;
	}

	.range-track-fill {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		height: 4px;
		background: #3b82f6;
		border-radius: 2px;
		pointer-events: none;
		z-index: 1;
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

	.reset-btn {
		background: #475569;
		color: #e2e8f0;
		border: 1px solid #64748b;
		border-radius: 4px;
		padding: 4px 10px;
		font-size: 0.75rem;
		cursor: pointer;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.reset-btn:hover {
		background: #64748b;
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

	.movie-count {
		position: absolute;
		bottom: 16px;
		left: 16px;
		font-size: 0.75rem;
		color: #64748b;
		pointer-events: none;
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
