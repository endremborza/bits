<script lang="ts">
	let d = 'M 20 80 Q 50 93 70 80 Q 78 50 47 20 Q 47 60 20 80 z';
	let svgEl: SVGSVGElement;

	// Normalize paint values: rgba(..., 0) → 'none'
	function normalizePaint(v: string) {
		if (!v) return '';
		if (v === 'none') return 'none';
		const m = v.match(/^rgba?\(([^)]+)\)$/);
		if (m) {
			const parts = m[1].split(',').map((s) => s.trim());
			if (parts.length === 4 && parseFloat(parts[3]) === 0) return 'none';
		}
		return v;
	}
	const stripPx = (v: string) => {
		if (!v) return '';
		const n = parseFloat(v);
		return Number.isFinite(n) ? String(n) : v;
	};

	// Inline computed styles from the *original* DOM SVG into a deep clone.
	function inlineSVG(svg: SVGSVGElement): SVGSVGElement {
		// Deep clone first (structure & attributes are preserved)
		const clone = svg.cloneNode(true) as SVGSVGElement;

		// Ensure proper SVG namespaces + real dimensions from viewBox (so it's standalone)
		const vb = svg.viewBox.baseVal;
		clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
		clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
		if (vb?.width && vb?.height) {
			clone.setAttribute('width', String(vb.width));
			clone.setAttribute('height', String(vb.height));
		}

		// Compute styles on ORIGINAL nodes and apply them to corresponding CLONE nodes by index
		const srcEls = svg.querySelectorAll<SVGElement>('*');
		const dstEls = clone.querySelectorAll<SVGElement>('*');

		for (let i = 0; i < srcEls.length; i++) {
			const src = srcEls[i];
			const dst = dstEls[i];
			const cs = getComputedStyle(src);

			// Key presentational attributes that affect rendering
			const set = (attr: string, val?: string) => {
				if (!val) return;
				dst.setAttribute(attr, val);
			};

			set('fill', normalizePaint(cs.fill));
			set('fill-opacity', cs.fillOpacity);
			set('stroke', normalizePaint(cs.stroke));
			set('stroke-opacity', cs.strokeOpacity);
			set('stroke-width', stripPx(cs.strokeWidth));
			set('stroke-linecap', cs.strokeLinecap);
			set('stroke-linejoin', cs.strokeLinejoin);
			set('stroke-miterlimit', cs.strokeMiterlimit);
			if (cs.strokeDasharray !== 'none') set('stroke-dasharray', cs.strokeDasharray);
			set('stroke-dashoffset', stripPx(cs.strokeDashoffset));
			set('opacity', cs.opacity);
			set('vector-effect', cs.vectorEffect);
			set('paint-order', (cs as any).paintOrder ?? '');

			// Respect explicit inline styles like "fill:none" if present on the source
			const inlineStyle = src.getAttribute('style') || '';
			if (/fill\s*:\s*none/i.test(inlineStyle)) dst.setAttribute('fill', 'none');
			if (/stroke\s*:\s*none/i.test(inlineStyle)) dst.setAttribute('stroke', 'none');

			// (Optional) remove class to make it 100% self-contained
			if (dst.hasAttribute('class')) dst.removeAttribute('class');
		}

		return clone;
	}

	function svgBlobURL(svgNode: SVGSVGElement) {
		const xml = new XMLSerializer().serializeToString(svgNode);
		const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
		return URL.createObjectURL(blob);
	}

	// Export a standalone SVG (with all styles inlined & variables resolved)
	function exportStandaloneSVG(filename = 'bits.svg') {
		if (!svgEl) return;
		const inlined = inlineSVG(svgEl);
		const url = svgBlobURL(inlined);
		const a = document.createElement('a');
		a.href = url;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(url);
	}

	// Export a transparent PNG at a chosen scale (defaults to viewBox size)
	function exportPNG(filename = 'bits.png', scale = 1) {
		if (!svgEl) return;
		const inlined = inlineSVG(svgEl);

		// Size the export using the SVG's viewBox (recommended)
		const vb = svgEl.viewBox.baseVal;
		const width = Math.max(1, (vb?.width || svgEl.clientWidth || 100) * scale);
		const height = Math.max(1, (vb?.height || svgEl.clientHeight || 100) * scale);
		inlined.setAttribute('width', String(width));
		inlined.setAttribute('height', String(height));

		const url = svgBlobURL(inlined);
		const img = new Image();
		img.onload = () => {
			const canvas = document.createElement('canvas');
			canvas.width = width;
			canvas.height = height;
			const ctx = canvas.getContext('2d');
			if (!ctx) return;
			ctx.clearRect(0, 0, width, height); // ensures transparency
			ctx.drawImage(img, 0, 0, width, height);
			URL.revokeObjectURL(url);

			canvas.toBlob((blob) => {
				if (!blob) return;
				const a = document.createElement('a');
				a.href = URL.createObjectURL(blob);
				a.download = filename;
				a.click();
			}, 'image/png');
		};
		img.decoding = 'sync';
		img.src = url;
	}
</script>

<h1>Bits</h1>

<svg viewBox="0 0 100 100" bind:this={svgEl} preserveAspectRatio="xMidYMid meet">
	<path class="bg" {d} />
	<path class="fg" {d} />
</svg>

<div style="margin-top: 1rem; display:none; gap: .5rem;">
	<button on:click={() => exportPNG('bits.png', 6)}>Export PNG</button>
	<button on:click={() => exportStandaloneSVG('bits.svg')}>Export SVG</button>
</div>

<style>
	svg {
		height: 600px;
		width: 600px;
	}
	path {
		fill: none;
	}
	.bg {
		stroke: var(--accent-purple);
		stroke-width: 5px;
	}
	.fg {
		stroke: var(--hit-yellow);
		stroke-width: 1.5px;
	}
</style>
