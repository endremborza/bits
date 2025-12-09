<script lang="ts">
	import phrases from '$lib/assets/phrases.json';
	import basis from '$lib/assets/id-basis.json';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
	import { base } from '$app/paths';
	import { GIBBER_DB_HOST as GIBBER_DB_HOST, getRng } from '$lib/common';

	function submit() {
		let ps = currentPhrase.split(', ');
		for (let i in ps) {
			let p = ps[i];
			if (!value.includes(p)) {
				errMsg = `${value} does not contain ${p}`;
				return;
			}
		}

		errMsg = undefined;

		let logObj = {
			time: Date.now(),
			currentPhrase,
			currentReq,
			content: value,
			name,
			pid,
			sid: Math.floor(Math.random() * Math.pow(2, 60))
		};
		fetch(GIBBER_DB_HOST + 'v1', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'ngrok-skip-browser-warning': '1'
			},
			body: JSON.stringify(logObj)
		}).then(reset);
	}

	function pick(l: string[]) {
		let rng = getRng(seed);
		rng();
		let iOne = rng();
		let out = l[Math.floor(iOne * l.length)];
		seed = Math.floor(rng() * Math.pow(2, 40));
		return out;
	}

	function reset() {
		fetch(`${GIBBER_DB_HOST}v1-past?pid=${pid}`, {
			headers: {
				'ngrok-skip-browser-warning': '1'
			}
		}).then((resp) => {
			resp
				.json()
				.then((d) => {
					past = d;
					for (let i of past) {
						console.log('past', i);
						console.log('would have', pick(phrases));
						console.log('would have', pick(['True', 'Bullshit']));
					}
					currentPhrase = pick(phrases);
					currentReq = pick(['True', 'Bullshit']);
					value = '';
				})
				.catch(() => {
					errMsg = 'backend not running';
				});
		});
	}

	let errMsg: undefined | string;

	let pid: number;
	let seed: number;
	let name: string;
	let currentPhrase: string;
	let currentReq: string;

	let past: { content: string; prompt_val: string }[] = [];

	onMount(() => {
		if ($page.params.pid == undefined) {
			let pid = Math.floor(Math.random() * Math.pow(2, 31));
			goto(`${base}/writer/${pid}`);
		}
	});

	afterNavigate(() => {
		seed = parseInt($page.params.pid);
		if (seed == undefined) {
			return;
		}
		pid = seed;
		name = [pick(basis.adjectives), pick(basis.colors), pick(basis.animals)].join(' ');

		reset();
	});

	let value: string;
</script>

{#if seed != undefined}
	<h1>Hello {name}</h1>
	{#if errMsg != undefined}
		<p id="err">{errMsg}</p>
	{/if}
	<p>Write a sentence with the phrases</p>
	<p>{currentPhrase}</p>
	<p>that is <b>{currentReq}</b></p>

	<textarea bind:value />

	<div class="row">
		<button on:click={submit}>Submit</button>
	</div>
	<h2>Past</h2>
	{#each past as pO}
		<p>{pO.content}</p>
	{/each}
{/if}

<style>
	#err {
		border: solid red 5px;
		padding: 10px;
		border-radius: 8px;
	}

	.row {
		margin-top: 40px;
	}

	textarea {
		height: 300px;
		width: 100%;
		padding: 18px;
		font-size: 20px;
	}
</style>
