#!/bin/bash
# mkgif.sh page.html out.gif fps secs start W H colors lossy
set -e
P=$1; OUT=$2; FPS=$3; SECS=$4; START=$5; W=$6; H=$7; COL=${8:-256}; LOSSY=${9:-40}
D=$(mktemp -d)
KEYS=$(python3 -c "
f=$FPS;s=$SECS;st=$START;n=int(round(f*s))
print(','.join('%.4f'%((st+i/f)%s) for i in range(n)))")
KEYS=$KEYS python3 render.py $P $D/fr $FPS $SECS $W $H
ffmpeg -loglevel error -y -framerate $FPS -i $D/fr/f%04d.png -vf "palettegen=max_colors=$COL:stats_mode=full" $D/pal.png
ffmpeg -loglevel error -y -framerate $FPS -i $D/fr/f%04d.png -i $D/pal.png -lavfi "paletteuse=dither=${DITHER:-bayer:bayer_scale=4}:diff_mode=rectangle" -loop 0 $D/raw.gif
gifsicle -O3 --lossy=$LOSSY $D/raw.gif -o $OUT
ls -la $D/raw.gif $OUT | awk '{print $5, $9}'
cp $D/fr/f0000.png ${OUT%.gif}_poster.png
rm -rf $D
