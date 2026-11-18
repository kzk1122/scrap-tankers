#!/bin/sh
# 紹介動画（CrazyGames 掲載用）: 横 1920x1080 と縦 1080x1620（2:3）、約18秒、無音、H.264 の mp4
# 最初の1秒は掲載画像（決まり: 静止画のカバーから始める）→ 実際のプレイ3場面をつなぐ
# 使い方: node build.mjs site && PW=<playwright> COVERS=<掲載画像のフォルダ> OUT=<出力先> sh tools/promo.sh
set -e
W=${WORK:-$OUT/promo-work}
for F in land port; do
  for S in 0 1 2; do rm -rf "$W/$F-$S"; FMT=$F SEG=$S OUT=$W node tools/promo.mjs; done
  if [ $F = land ]; then SZ=1920:1080; CV=$COVERS/cover-landscape-1920x1080.png; else SZ=1080:1620; CV=$COVERS/cover-portrait-800x1200.png; fi
  ffmpeg -v error -y -loop 1 -t 1.4 -framerate 30 -i "$CV" \
    -framerate 30 -i "$W/$F-0/%04d.png" -framerate 30 -i "$W/$F-1/%04d.png" -framerate 30 -i "$W/$F-2/%04d.png" \
    -filter_complex "[0]scale=$SZ:flags=lanczos,setsar=1,format=yuv420p[c];[1]scale=$SZ,setsar=1,format=yuv420p[a];[2]scale=$SZ,setsar=1,format=yuv420p[b];[3]scale=$SZ,setsar=1,format=yuv420p[d];[c][a]xfade=transition=fade:duration=0.4:offset=1.0[x1];[x1][b]xfade=transition=fade:duration=0.3:offset=6.7[x2];[x2][d]xfade=transition=fade:duration=0.3:offset=12.4,format=yuv420p[v]" \
    -map "[v]" -an -c:v libx264 -preset slow -crf 18 -r 30 -movflags +faststart "$OUT/scrap-tankers-$F.mp4"
done
