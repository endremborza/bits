<script lang="ts">
	import { delay } from '$lib/common';
	import BarDivs from '$lib/components/BarDivs.svelte';
	import { onMount, tick } from 'svelte';
	import { flip } from 'svelte/animate';
	import { fade, scale, slide } from 'svelte/transition';

	let url = 'https://tmp-borza-public-cyx.s3.amazonaws.com/assets/data/pl-fixtures.json';

	type FixtType = {
		sid: number[];
		date: string[];
		HG: number[];
		AG: number[];
		team: string[];
		opposition: string[];
		points_got: number[];
		goaldiff: number[];
		side: string[];
		fixt: number[];
		season_end_rank: number[];
		did: number[];
	};

	let data: FixtType = {
		sid: [],
		date: [],
		HG: [],
		AG: [],
		team: [],
		opposition: [],
		points_got: [],
		goaldiff: [],
		side: [],
		fixt: [],
		season_end_rank: [],
		did: []
	};

	function procFixtureData(fData: FixtType) {
		//sorted sid, fixt, date, team
		let lastSeason = undefined;
		let seasons = [];
		let positions: Record<number, number[]>[] = [];
		let gameMap: Record<
			number,
			{ team: string; opposition: string; side: string; HG: number; AG: number }[]
		>[] = [];
		for (let i = 0; i < data.sid.length; i++) {
			let season = data.sid[i];
			if (season != lastSeason) {
				seasons.push(season);
				lastSeason = season;
			}
			let pos = data.season_end_rank[i];
			if (positions[pos] == undefined) positions[pos] = {};
			if (positions[pos][season] == undefined) positions[pos][season] = [];
			positions[pos][season].push(data.did[i]);

			if (gameMap[pos] == undefined) gameMap[pos] = {};
			if (gameMap[pos][season] == undefined) gameMap[pos][season] = [];
			gameMap[pos][season].push({
				team: data.team[i],
				opposition: data.opposition[i],
				side: data.side[i],
				HG: data.HG[i],
				AG: data.AG[i]
			});
		}
		return { seasons, positions, gameMap };
	}

	function getBarBases(oData, posSplit: number, n0: number, len: number) {
		const out = [];
		for (let [posId, pDic] of Object.entries(oData.positions)) {
			let oInd = parseInt(posId) <= posSplit ? 0 : 1;
			if (out.length <= oInd) out.push(breakpoints.map(() => 0));
			let skipped = false;
			for (let [sid, pvals] of Object.entries(pDic)) {
				if (skipped) {
					let { catI } = posParser(pvals, n0, len);
					out[oInd][catI] += 1;
				} else {
					skipped = true;
				}
			}
		}
		return out;
	}

	function sNamer(s: number) {
		return String(s % 100).padStart(2, '0') + '/' + String((s + 1) % 100).padStart(2, '0');
	}

	function getPiClass(pi: number) {
		if (pi == 1) return 'champ';
		if (pi < 5) return 'top4';
		if (pi > 17) return 'relegated';
		return '';
	}

	function numNamer(s: number) {
		let suff = 'th';
		if (s == 1) suff = 'st';
		if (s == 2) suff = 'nd';
		if (s == 3) suff = 'rd';
		return `${s}${suff}`;
	}

	function rangeMeaner(ns: number[], n0: number, len: number) {
		let s = 0;
		for (let i = 0; i < len; i++) {
			s += ns[n0 + i];
		}
		return s / len;
	}

	function posParser(ns: number[], n0: number, len: number) {
		let difficulty = rangeMeaner(ns, n0 - 1, len);
		let i = 0;
		while (i < catNames.length && difficulty > breakpoints[i]) i++;
		let cat = catNames[i];
		return { cat, difficulty, color: catColors[i], catI: i };
	}

	function hoverShow(oData, hoverSeason, hoverPosition, startFixt, rangeLen) {
		let sid = hoverSeason;
		let pid = hoverPosition;
		let sfInd = startFixt - 1;
		if (hoverSeason == undefined) {
			let highest = 0;
			for (let [cpid, pDics] of oData.positions.entries()) {
				if (pDics == undefined) continue;
				for (let [csid, fixts] of Object.entries(pDics)) {
					let cand = 0;
					for (let pi = 0; pi < rangeLen; pi++) {
						cand += fixts[sfInd + pi];
					}
					if (cand > highest) {
						highest = cand;
						pid = cpid;
						sid = parseInt(csid);
					}
				}
			}
		}
		if (oData == undefined || pid == undefined || sid == undefined) return undefined;
		let team = oData.gameMap[pid][sid][0].team;
		let recs = [];
		let mean = 0;

		for (let i = 0; i < rangeLen; i++) {
			let did = oData.positions[pid][sid][sfInd];
			mean += did / rangeLen;
			recs.push({
				opp: oData.gameMap[pid][sid][sfInd].opposition,
				side: oData.gameMap[pid][sid][sfInd].side,
				did
			});
			sfInd += 1;
		}

		return { sid, pid, team, recs, mean };
	}

	function splitSem(split: number, i: number) {
		if (split == maxPos) return 'all teams, all seasons';
		if (i == 0)
			return split == 1
				? 'eventual champions'
				: `teams finishing top ${split} at the end of the season`;
		return `bottom ${maxPos - split}`;
	}

	async function startAnim() {
		for (const frameObj of FRAMES) {
			posSplit = frameObj.split;
			await delay(frameObj.ms);
		}
	}

	async function recordFrames() {
		let frame = 0;
		for (let v = 0; v <= 100; v++) {
			value = v;
			await tick(); // ensure DOM updates
			await delay(30); // wait a bit for smoother transitions (30ms ≈ 33fps)
			const canvas = await html2canvas(containerEl);
			const dataUrl = canvas.toDataURL('image/png');
			downloadFrame(dataUrl, frame);
			frame++;
		}
	}

	const FRAMES = [
		{ split: 20, ms: 1600 },
		{ split: 10, ms: 1600 },
		{ split: 4, ms: 1600 },
		{ split: 17, ms: 1600 },
		{ split: 1, ms: 1600 }
	];
	const FLIP_MS = 500;
	const TRANS_MS = 300;

	let catNames = ['easy', 'mild', 'hard', 'brutal'];
	let catColors = ['#ADE792', '#49BEB7', '#FACF5A', '#FF5959'];
	let breakpoints = [7.2, 8.9, 10.4, 20];

	onMount(async () => {
		data = await fetch(url).then((r) => r.json());
	});

	const nFixtures = 38;
	let startFixt = 1;
	let rangeLen = 5;
	let posSplit = 1;
	let maxPos = 20;

	let hoverSeason: number;
	let hoverTeamRank: number;
	let maxRate = 0.45;

	$: pMax = Math.min(nFixtures - startFixt, 8);
	$: fMax = nFixtures - rangeLen + 1;
	$: oData = procFixtureData(data);
	$: barBases = getBarBases(oData, posSplit, startFixt, rangeLen);
	$: hoverDic = hoverShow(oData, hoverSeason, hoverTeamRank, startFixt, rangeLen);
</script>

<svelte:head>
	<title>PL Fixture Bits</title>
</svelte:head>
<!-- <div><button on:click={startAnim}> Play</button></div> -->
<div class="controls">
	<div>
		A period of
		<br />
		<input type="range" min="3" max={pMax} bind:value={rangeLen} />
		{rangeLen}
		<br />
		fixtures
	</div>
	<div>
		starting with fixture
		<br />
		<input type="range" min="1" max={nFixtures - rangeLen + 1} bind:value={startFixt} />
		{startFixt}
	</div>
	<div>
		Compare teams finishing above and below position
		<br />
		<input type="range" min="1" max={maxPos} bind:value={posSplit} />
		{posSplit}
	</div>
	<br />
</div>
<h3>
	Difficulty of fixtures {startFixt}-{startFixt + rangeLen - 1} based on results of last seasons and
	home/away
</h3>
<div class="barcontainer">
	{#each barBases as values, i (i)}
		<div
			animate:flip={{ duration: FLIP_MS }}
			in:fade={{ duration: TRANS_MS, delay: FLIP_MS / 2 }}
			out:fade={{ duration: TRANS_MS }}
		>
			<div class="barhead">
				{splitSem(posSplit, i)}
			</div>
			<div class="barmeat">
				<BarDivs labels={catNames} colors={catColors} {values} {maxRate} />
			</div>
		</div>
	{/each}
</div>
<div
	on:mouseleave={() => {
		hoverTeamRank = undefined;
		hoverSeason = undefined;
	}}
>
	<table>
		<thead>
			<tr class="ulrow"
				><th class="mini-font">Head</th>
				{#each oData.positions as pos, pi}
					{#if pi > 0}
						<th class="{getPiClass(pi)} mini-font">{numNamer(pi)} </th>
					{/if}
				{/each}
			</tr>
		</thead>
		<tbody>
			{#each oData.seasons.reverse() as sid, si}
				{#if si < oData.seasons.length - 1}
					<tr>
						<td class="micro-font">{sNamer(sid)}</td>
						{#each oData.positions.map( (pos) => posParser(pos[sid], startFixt, rangeLen) ) as pos, pi}
							{#if pi > 0}
								<td
									class="micro-font"
									style="background-color: {pos.color};"
									on:mouseover={() => {
										hoverSeason = sid;
										hoverTeamRank = pi;
									}}>{pos.difficulty.toFixed(1)}</td
								>
							{/if}
						{/each}
					</tr>
				{/if}
			{/each}
		</tbody>
	</table>
</div>
<div class="hover-table">
	{#if hoverDic != undefined}
		<p>
			{sNamer(hoverDic.sid)}
			- {hoverDic.pid}. {hoverDic.team} <b>{hoverDic.mean.toFixed(1)}</b>
			{#if hoverSeason == undefined}
				(the hardest)
			{/if}
		</p>
		<table>
			<thead>
				<tr class="mini-font"
					><th>Fixture number</th>
					<th id="opphead">Opponent</th>
					<th>Ground</th>
					<th>Difficulty</th>
				</tr>
			</thead>
			<tbody>
				{#each hoverDic.recs as rec, i}
					<tr>
						<td>{startFixt + i}.</td>
						<td>{rec.opp}</td>
						<td>{rec.side}</td>
						<td>{rec.did}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

<!-- <div> -->
<!-- 	<input type="range" min="1" max={fMax} bind:value={startFixt} /> start: {startFixt} -->
<!-- 	<input type="range" min="3" max={pMax} bind:value={rangeLen} /> len: {rangeLen} -->
<!-- 	<input type="range" min="1" max={maxPos} bind:value={posSplit} /> split: {posSplit} -->
<!-- </div> -->

<style>
	table,
	th,
	td {
		border-right: 1px solid;
		border-collapse: collapse;
	}

	td {
		padding: min(3px, 0.3vw);
		font-family: monospace;
		text-align: right;
	}

	h3 {
		text-align: center;
		width: 100%;
	}

	.micro-font {
		font-size: min(0.7rem, 1.3vw);
	}

	.mini-font {
		width: min(45px, 5.18vw);
		font-size: min(0.8rem, 1.3vw);
	}

	.d1 {
		width: 2em;
	}

	.d2 {
		width: 3em;
	}

	.controls {
		display: flex;
		gap: var(--big-pad);
		flex-wrap: wrap;
	}

	.controls > div {
		flex: 1;
		padding: var(--small-pad);
	}

	.barcontainer {
		width: 100%;
		height: 400px;
		display: flex;
		justify-content: stretch;
		gap: var(--xxl-pad);
		margin-bottom: 40px;
	}

	.barcontainer > div {
		flex: 1;
		transition: all 300ms;
		display: flex;
		flex-direction: column;
		justify-content: stretch;
	}

	.barhead {
		flex: 1;
		padding: 16px;
		text-align: center;
	}

	.barmeat {
		flex: 8;
	}

	.hover-table {
		display: flex;
		justify-content: center;
		flex-direction: column;
		align-items: center;
		margin-bottom: 40px;
		margin-top: 20px;
	}
	.hover-table > table {
		width: 100%;
	}

	.ulrow {
		border-bottom: 2px solid;
	}

	.champ {
		background-color: gold;
		color: black;
	}

	.top4 {
		background-color: silver;
		color: black;
	}
	.relegated {
		background-color: tan;
		color: black;
	}

	#opphead {
		width: 70%;
	}
</style>
