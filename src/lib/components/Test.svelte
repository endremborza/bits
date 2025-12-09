<script lang="ts">
	export let containerEl: HTMLElement;
	export let value = 50;
</script>


<div bind:this={containerEl} class="container">
	<div class="box box1" style="width: {value * 2}px;"></div>
	<div class="box box2" style="width: {(100 - value) * 2}px;"></div>
</div>

<style>
	.container {
		display: flex;
		gap: 1rem;
		height: 200px;
		width: 300px;	
		align-items: center;
		justify-content: center;
	}

	.box {
		transition: all 0.3s ease;
		height: 100px;
	}

	.box1 {
		background-color: #f77;
	}

	.box2 {
		background-color: #77f;
	}
</style>
