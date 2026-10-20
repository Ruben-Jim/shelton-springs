#!/usr/bin/env bash
# Builds the App Store "Header" creative assets (21:9, 3840x1646) from the
# AI-generated sources in ./source:
#   day.png, night.png                 16:9 stills (3840x2160), the loop's end frames
#   clip-day-to-night.mp4              Higgsfield clip, starts on day, ends on night
#   clip-night-to-day.mp4              Higgsfield clip, starts on night, ends on day
#
# Outputs:
#   header-still.png                   day frame, 21:9 center band, no alpha
#   header-loop.mp4                    seamless day -> night -> day loop, 30 fps
#
# Requires ImageMagick (magick) and ffmpeg.
set -euo pipefail
cd "$(dirname "$0")"

SRC=source
XF=0.5         # crossfade seconds at the night join and at the loop point
W=3840; H=1646 # Apple's 21:9 header size

# Still: crop the 21:9 band out of the 16:9 day frame (same band the clips use).
magick "$SRC/day.png" -crop ${W}x${H}+0+257 +repage -alpha off header-still.png

A="$SRC/clip-day-to-night.mp4"
B="$SRC/clip-night-to-day.mp4"
dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1"; }
DA=$(dur "$A"); DB=$(dur "$B")

# Join A and B with a short fade at night, then wrap B's tail into A's head so
# the last frame flows into the first. Both clips are normalized to 30 fps
# (frame blending suits slow time-lapse motion) before fading, and the result is
# scaled up to 3840x1646 at the end.
read -r OFF1 OFF2 < <(python3 -c "
a,b,x=$DA,$DB,$XF
print(f'{a-x:.3f} {a+b-3*x:.3f}')")

ffmpeg -y -loglevel error -nostats \
  -i "$A" -i "$B" \
  -f lavfi -i anullsrc=channel_layout=stereo:sample_rate=48000 \
  -filter_complex "
    [0:v]setsar=1,framerate=fps=30,format=yuv420p,settb=1/30[a];
    [1:v]setsar=1,framerate=fps=30,format=yuv420p,settb=1/30[b];
    [a][b]xfade=transition=fade:duration=$XF:offset=$OFF1[c];
    [c]split[c1][c2];
    [c1]trim=start=$XF,setpts=PTS-STARTPTS[body];
    [c2]trim=end=$XF,setpts=PTS-STARTPTS[head];
    [body][head]xfade=transition=fade:duration=$XF:offset=$OFF2,
      scale=${W}:${H}:flags=lanczos:force_original_aspect_ratio=increase,crop=${W}:${H},unsharp=5:5:0.35,setsar=1,format=yuv420p[v]" \
  -map "[v]" -map 2:a -shortest \
  -c:v libx264 -preset slow -crf 20 -maxrate 16M -bufsize 32M -profile:v high -level 5.1 -r 30 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a aac -b:a 128k -movflags +faststart \
  header-loop.mp4

echo "header-still.png  $(magick identify -format '%wx%h' header-still.png)"
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate -show_entries format=duration \
  -of default=nw=1 header-loop.mp4 | sed 's/^/header-loop.mp4   /'
