shoot:
	ffmpeg -framerate 30 -i frames/test/frame_%03d.png -c:v libx264 -pix_fmt yuv420p videos/output.mp4

gif:
	ffmpeg -i frames/test/frame_%03d.png -vf "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos,palettegen" palette.png
	ffmpeg -i frames/test/frame_%03d.png -i palette.png -filter_complex "fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2:flags=lanczos[x];[x][1:v]paletteuse" videos/output.gif
	rm palette.png

move:
	mv ~/Downloads/frame_* frames/test/
