<script lang="ts">
	import './style.css';
</script>

<head>
	<title>Bits</title>
</head>

<div class="container">
	<div class="content padded">
		<slot />
	</div>
</div>

<style>
	.container {
		display: flex;
		justify-content: center;
	}
	.content {
		max-width: 800px;
	}
</style>
