<script lang="ts">
	import Test from '$lib/components/Test.svelte';
	import html2canvas from 'html2canvas';
	// https://www.npmjs.com/package/html2canvas-pro

	let value = 50;

	let recording = false;

	let containerEl: HTMLElement;

	const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

	async function recordFrames() {
		recording = true;
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

		recording = false;
	}

	function downloadFrame(dataUrl: string, frame: number) {
		const a = document.createElement('a');
		a.href = dataUrl;
		a.download = `frame_${String(frame).padStart(3, '0')}.png`;
		a.click();
	}

	import { tick } from 'svelte';
</script>

<h2>Animated Box Recorder</h2>
<input type="range" min="0" max="100" bind:value disabled={recording} />

<button on:click={recordFrames} disabled={recording}>
	{recording ? 'Recording...' : 'Start Recording'}
</button>
<Test bind:value bind:containerEl />
