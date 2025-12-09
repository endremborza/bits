export const GIBBER_DB_HOST = "http://localhost:5678/"
// export const DB_HOST = "http://146.110.60.20:5678/"
// export const DB_HOST = 'https://73de-94-44-107-72.ngrok-free.app/'

export function getRng(n: number) {
	let a = n * 100001
	let b = n * 100002
	let c = n * 100003
	let d = n * 100004
	return function() {
		let t = b << 9,
			r = b * 5;
		r = ((r << 7) | (r >>> 25)) * 9;
		c ^= a;
		d ^= b;
		b ^= c;
		a ^= d;
		c ^= t;
		d = (d << 11) | (d >>> 21);
		return (r >>> 0) / 4294967296;
	};
}
export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function downloadFrame(dataUrl: string, frame: number) {
	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = `frame_${String(frame).padStart(3, '0')}.png`;
	a.click();
}


