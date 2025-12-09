<script lang="ts">
	import { GIBBER_DB_HOST } from '$lib/common';
	import { onMount } from 'svelte';

	let res = [];

	let reviewers = {};
	let includeRevs = {};

	function refresh() {
		fetch(`${GIBBER_DB_HOST}v1-results`, {
			headers: {
				'ngrok-skip-browser-warning': '1'
			}
		}).then((resp) => {
			resp.json().then((d) => {
				for (let i in d) {
					let rec = d[i];
					let rid = rec.rname;
					if (Object.keys(reviewers).includes(rid)) {
						reviewers[rid].push(rec);
					} else {
						reviewers[rid] = [rec];
						includeRevs[rid] = false;
					}
				}
				res = d;
			});
		});
	}

	function getSum(revs, incs) {
		let out = {};
		Object.entries(revs).map(([k, vlist]) => {
			if (incs[k]) {
				vlist.map((v) => {
					let pid = v.name;
					if (!Object.keys(out).includes(pid)) {
						out[pid] = { 0: { 0: 0, 1: 0 }, 1: { 0: 0, 1: 0 } };
					}
					out[pid][v.res][v.prompt_val == 'Bullshit' ? 0 : 1] += 1;
				});
			}
		});
		return out;
	}

	onMount(refresh);

	$: revSum = getSum(reviewers, includeRevs);
</script>

<h1>Results</h1>

<h2>Include reviewers</h2>
<div class="row">
	<ul>
		{#each Object.keys(reviewers) as rev}
			<li><input type="checkbox" bind:checked={includeRevs[rev]} />{rev}</li>
		{/each}
	</ul>
</div>

{#each Object.entries(revSum) as [k, o]}
	<h3>{k}</h3>
	<div class="row">
		<table>
			<tr>
				<th></th>
				<th>Intended as Bullshit</th>
				<th>Intended as True</th>
			</tr>
			<tr>
				<td>Reviewed as Bullshit</td>
				<td>{o[0][0]} </td>
				<td>{o[0][1]} </td>
			</tr>
			<tr>
				<td>Reviewed as True</td>
				<td>{o[1][0]} </td>
				<td>{o[1][1]} </td>
			</tr>
		</table>
	</div>
{/each}

<style>
	table {
		border: solid darkgray 5px;
		border-radius: 8px;
		background-color: #d1d8d1;
		padding: 16px;
	}

	td {
		padding: 10px;
		text-align: center;
	}

	th {
		text-align: center;
		padding-left: 30px;
	}
</style>
