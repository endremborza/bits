<script lang="ts">
	import {base} from '$app/paths';
	import './styles.css';

	const NAME = 'Gibber';
</script>

<svelte:head>
	<title>{NAME}</title>
</svelte:head>

<header><a href={base + '/' }>{NAME}</a></header>
<container>
	<main>
		<slot />
	</main>
</container>

<style>
	container {
		display: flex;
		justify-content: center;
	}

	main {
		max-width: 800px;
	}

	header {
		background-color: #ffcdea;
		height: 40px;
		display: flex;
		justify-content: start;
		align-items: center;
		padding: 15px;
		width: 100%;
	}

	header>a {
		font-weight: 800;
		font-size: 20px;
		text-decoration: none;
	}

	:global(.row) {
		display: flex;
		justify-content: space-around;
	}

	:global(button) {
		padding: 8px;
		font-size: 20px;
	}
</style>
