<script lang="ts">
	export let values = [1, 2, 3];
	export let colors = ['red', 'green', 'blue'];
	export let labels: string[] = [];
	export let maxRate: undefined | number = undefined;

	$: vMax = values.reduce((l, r) => (l > r ? l : r));
	$: vSum = values.reduce((l, r) => l + r);

	function getHeightPct(value: number, vMax: number, vSum: number, maxRate: number | undefined) {
		if (maxRate == undefined) {
			return (value / vMax) * 100;
		}
		return (value / vSum / maxRate) * 100;
	}
</script>

<div class="bars">
	{#each values as v, i}
		<div
			class="dbar small-padded shrinking-font"
			style="height: {getHeightPct(v, vMax, vSum, maxRate).toFixed(2)}%;background-color: {colors[
				i
			]}"
		>
			{labels[i] || ''}
			<br />
			{((v / vSum) * 100).toFixed(1)}%
			<br />
			({v})
		</div>
	{/each}
</div>

<style>
	.bars {
		width: 100%;
		height: 100%;
		display: flex;
		gap: var(--small-pad);
		justify-content: stretch;
		align-items: end;
	}

	.dbar {
		flex: 1;
		transition: all 300ms;
		text-align: center;
	}
</style>
