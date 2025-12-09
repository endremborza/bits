<script lang="ts">
	import basis from '$lib/assets/id-basis.json';
	import {page} from '$app/stores';
	import {onMount} from 'svelte';
	import {afterNavigate, goto} from '$app/navigation';
	import {base} from '$app/paths';
	import {DB_HOST, getRng} from '$lib/common';

	function submit(value: number) {
		if (currentPhrase != '') {
			currentPhrase = '';
			let logObj = {
				time: Date.now(),
				rid: pid,
				name,
				sid: phraseId,
				res: value
			};
			fetch(DB_HOST + 'v1-review', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'ngrok-skip-browser-warning': '1'
				},
				body: JSON.stringify(logObj)
			}).then(() => {
				refresh();
			});
		}
	}

	function refresh() {
		fetch(`${DB_HOST}v1?rid=${pid}`, {
			headers: {
				'ngrok-skip-browser-warning': '1'
			}
		}).then((resp) => {
			resp.json().then((d) => {
				if (d.length > 0) {
					let i = Math.floor(getRng(seed)() * d.length);
					currentPhrase = d[i].content;
					phraseId = d[i].id;
				}
			});
		});
	}

	let pid: number;
	let currentPhrase: string = '';
	let phraseId: number;
	let name: string;
	let seed: number;

	onMount(() => {
		if ($page.params.pid == undefined) {
			let pid = Math.floor(Math.random() * Math.pow(2, 31));
			goto(`${base}/reader/${pid}`);
		}
	});

	afterNavigate(() => {
		pid = parseInt($page.params.pid);
		seed = pid;

		let basisLs = [basis.adjectives, basis.items, basis.geo];
		let nameBase = [];

		for (let i in basisLs) {
			let l = basisLs[i];
			let rng = getRng(seed);
			nameBase.push(l[Math.floor(rng() * l.length)]);
			seed = Math.floor(rng() * Math.pow(2, 40));
		}
		name = `${nameBase[0]} ${nameBase[1]} of ${nameBase[2]}`;

		refresh();
	});
</script>

{#if pid != undefined}
<h1>Hello Reviewer {name}</h1>
<p>Evaluate the following</p>
<div id="res">
	<p>{currentPhrase}</p>
</div>
<hr />
<div class="row">
	<button id="bull" on:click={()=> submit(0)}>Bullshit</button>
	<button id="ok" on:click={()=> submit(1)}>True</button>
</div>
{/if}

<style>
	button {
		width: 240px;
	}

	#ok {
		background-color: #66aa66;
	}

	#bull {
		background-color: #aa6666;
	}

	#res {
		border: solid teal 8px;
		padding: 25px;
		border-radius: 10px;
		height: 300px;
		width: 100%;
		font-size: 20px;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
