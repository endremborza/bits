<script lang="ts">
	import { onMount } from 'svelte';
	import { csvParse } from 'd3-dsv';
	import { scaleLinear } from 'd3-scale';
	import { inflate } from 'pako';

	interface Movie {
		imdb_id: string;
		x: number;
		y: number;
		drama: boolean;
		history: boolean;
		musical: boolean;
		comedy: boolean;
		music: boolean;
		romance: boolean;
		family: boolean;
		adventure: boolean;
		fantasy: boolean;
		mystery: boolean;
		thriller: boolean;
		sci_fi: boolean;
		biography: boolean;
		crime: boolean;
		horror: boolean;
		documentary: boolean;
		western: boolean;
		action: boolean;
		war: boolean;
		animation: boolean;
		sport: boolean;
		film_noir: boolean;
		metacritic: number;
		plot: string;
		title: string;
		rating: number;
		rating_count: number;
		rating1: string; // Renamed from 'rating.1' for TS compatibility
		year: number;
		length_minutes: number;
		img_link: string;
	}

	let movies: Movie[] = [];
	let loading = true;
	let error: string | null = null;
	let hoveredMovie: Movie | null = null;
	let tooltipX = 0;
	let tooltipY = 0;

	let containerWidth: number;
	let containerHeight: number;

	const margin = { top: 20, right: 20, bottom: 20, left: 20 };

	$: width = containerWidth - margin.left - margin.right;
	$: height = containerHeight - margin.top - margin.bottom;

	// D3 scales for positioning
	let xScale = scaleLinear();
	let yScale = scaleLinear();

	onMount(async () => {
		try {
			const response = await fetch('http://tmp-borza-public-cyx.s3.amazonaws.com/imdb-comp.csv.gz');
			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const decompressed = inflate(new Uint8Array(arrayBuffer), { to: 'string' });
			const parsedCsv = csvParse(decompressed);

			const parsedMovies: Movie[] = parsedCsv.map((d: any) => ({
				imdb_id: d.imdb_id,
				x: parseFloat(d.x),
				y: parseFloat(d.y),
				drama: d.drama === 'True',
				history: d.history === 'True',
				musical: d.musical === 'True',
				comedy: d.comedy === 'True',
				music: d.music === 'True',
				romance: d.romance === 'True',
				family: d.family === 'True',
				adventure: d.adventure === 'True',
				fantasy: d.fantasy === 'True',
				mystery: d.mystery === 'True',
				thriller: d.thriller === 'True',
				sci_fi: d.sci_fi === 'True',
				biography: d.biography === 'True',
				crime: d.crime === 'True',
				horror: d.horror === 'True',
				documentary: d.documentary === 'True',
				western: d.western === 'True',
				action: d.action === 'True',
				war: d.war === 'True',
				animation: d.animation === 'True',
				sport: d.sport === 'True',
				film_noir: d.film_noir === 'True',
				metacritic: parseFloat(d.metacritic),
				plot: d.plot,
				title: d.title,
				rating: parseFloat(d.rating),
				rating_count: parseFloat(d.rating_count),
				rating1: d['rating.1'],
				year: parseInt(d.year),
				length_minutes: parseFloat(d.length_minutes),
				img_link: d.img_link
			}));

			movies = parsedMovies.filter((d) => !isNaN(d.x) && !isNaN(d.y)); // Filter out any invalid coordinate movies

			const minX = Math.min(...movies.map((m) => m.x));
			const maxX = Math.max(...movies.map((m) => m.x));
			const minY = Math.min(...movies.map((m) => m.y));
			const maxY = Math.max(...movies.map((m) => m.y));

			xScale.domain([minX, maxX]);
			yScale.domain([minY, maxY]);
		} catch (e: any) {
			console.error('Failed to load movie data:', e);
			error = e.message;
		} finally {
			loading = false;
		}
	});

	// Update scales when width or height changes
	$: {
		xScale.range([0, width]);
		yScale.range([height, 0]); // Invert y-axis for SVG
	}

	const genreKeys = [
		'drama', 'history', 'musical', 'comedy', 'music', 'romance', 'family', 'adventure', 'fantasy',
		'mystery', 'thriller', 'sci_fi', 'biography', 'crime', 'horror', 'documentary', 'western',
		'action', 'war', 'animation', 'sport', 'film_noir'
	];

	function getGenres(movie: Movie): string[] {
		return genreKeys.filter(key => (movie as any)[key] === true);
	}

	function handleMouseMove(event: MouseEvent, movie: Movie) {
		hoveredMovie = movie;
		tooltipX = event.clientX + 10; // Offset from mouse pointer
		tooltipY = event.clientY + 10;
	}

	function handleMouseLeave() {
		hoveredMovie = null;
	}
</script>

<div class="movies-container" bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
	{#if loading}
		<p>Loading movies...</p>
	{:else if error}
		<p style="color: red;">Error: {error}</p>
	{:else}
		<svg width={containerWidth} height={containerHeight}>
			<g transform="translate({margin.left}, {margin.top})">
				{#each movies as movie (movie.imdb_id)}
					<circle
						cx={xScale(movie.x)}
						cy={yScale(movie.y)}
						r={2}
						fill="steelblue"
						class="movie-dot"
						on:mousemove={(e) => handleMouseMove(e, movie)}
						on:mouseleave={handleMouseLeave}
					/>
				{/each}
			</g>
		</svg>

		{#if hoveredMovie}
			<div class="tooltip" style="left: {tooltipX}px; top: {tooltipY}px;">
				<h3>{hoveredMovie.title} ({hoveredMovie.year})</h3>
				<p><strong>Rating:</strong> {hoveredMovie.rating} ({hoveredMovie.rating_count} votes)</p>
				<p><strong>Metascore:</strong> {hoveredMovie.metacritic}</p>
				<p><strong>Length:</strong> {hoveredMovie.length_minutes} min</p>
				<p><strong>Genres:</strong> {getGenres(hoveredMovie).map(g => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}</p>
				<p>{hoveredMovie.plot.length > 150 ? hoveredMovie.plot.substring(0, 150) + '...' : hoveredMovie.plot}</p>
				{#if hoveredMovie.img_link && hoveredMovie.img_link !== 'nan'}
					<img src={hoveredMovie.img_link} alt={hoveredMovie.title} style="max-width: 150px;" />
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.movies-container {
		width: 100vw;
		height: 100vh;
		position: relative;
		overflow: hidden;
	}

	.movie-dot {
		cursor: pointer;
		transition: r 0.1s ease-in-out, fill 0.1s ease-in-out;
	}

	.movie-dot:hover {
		r: 4;
		fill: orange;
	}

	.tooltip {
		position: fixed; /* Changed to fixed for positioning relative to viewport */
		background-color: rgba(0, 0, 0, 0.8);
		color: white;
		padding: 10px;
		border-radius: 5px;
		pointer-events: none; /* Allows mouse events to pass through to the dots */
		z-index: 100;
		max-width: 300px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	}

	.tooltip h3 {
		margin-top: 0;
		margin-bottom: 5px;
		font-size: 1.1em;
	}

	.tooltip p {
		margin-bottom: 3px;
		font-size: 0.9em;
		line-height: 1.3;
	}
</style>
