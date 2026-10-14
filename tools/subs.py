"""Builds the reel's ASS subtitle track from the clip marks written by reel.js."""
import json, sys

ev = json.load(open(sys.argv[1]))
marks = {m['id']: m['T'] for m in ev['marks']}
DUR = ev['dur']

def ts(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f"{h}:{m:02d}:{s:05.2f}"

lines = []
def add(clip, a, b, style, text, fx=r"{\fad(260,260)}"):
    t0 = marks[clip] + a; t1 = min(marks[clip] + b, DUR)
    lines.append(f"Dialogue: 0,{ts(t0)},{ts(t1)},{style},,0,0,0,,{fx}{text}")

TAGS = {'intro': 'CHAPTER I  ·  THE WHISPERING WOOD', 'jump': 'CHAPTER I  ·  THE WHISPERING WOOD', 'crate': 'CHAPTER I  ·  THE WHISPERING WOOD',
        'lever': 'CHAPTER III  ·  THE HOLLOW CITY', 'die': 'CHAPTER IV  ·  THE IRON MILL', 'marsh': 'CHAPTER II  ·  THE DROWNED MARSH',
        'edge': 'CHAPTER V  ·  THE PALE EDGE', 'chase': 'CHAPTER II  ·  THE DARK RISES'}
for k, v in TAGS.items():
    if k == 'intro': continue
    end = {m['id']: i for i, m in enumerate(ev['marks'])}
    add(k, 0.25, 9.0 if k != 'chase' else 4.6, 'Tag', v)

# intro
add('intro', 0.15, 5.0, 'Title', 'UMBRAL', r"{\fad(500,400)}")
add('intro', 0.6, 5.0, 'Sub', 'THE LAST LANTERN', r"{\fad(700,400)}")
add('intro', 0.7, 2.9, 'Cap', 'When the Great Lantern fell,\Nthe world forgot its colour.')
add('intro', 2.9, 5.0, 'Cap', 'Wren carries its last ember.')
# how to play
add('jump', 0.2, 4.5, 'Head', 'HOW TO PLAY')
add('jump', 0.3, 2.4, 'Cap', '← →  to walk\N SPACE  to jump')
add('jump', 2.4, 4.5, 'Cap', 'Thorns, traps and pits\Nend you instantly.')
add('crate', 0.2, 4.9, 'Cap', 'Walk into crates to push them,\Nthen climb what you can\'t reach.')
add('lever', 0.2, 3.0, 'Cap', 'Press  E  to pull levers\Nand open the gates.')
add('lever', 3.0, 6.3, 'Cap', 'Crushers move in rhythm.\NWatch, then run.')
add('die', 0.2, 2.6, 'Cap', 'One mistake\Nand the dark takes you…')
add('die', 2.7, 5.9, 'Cap', '…but you always rise again\Nat the last safe ground.')
add('marsh', 0.2, 3.0, 'Cap', 'Leap the drowned marsh.')
add('marsh', 3.0, 6.1, 'Cap', 'Jump over the Husks.\NThey only want your light.')
add('edge', 0.2, 5.9, 'Cap', 'Ride the drifting stones\Nat the edge of the world.')
add('chase', 0.2, 2.4, 'Cap', 'And when the Dark\Ncomes for you…')
add('chase', 2.4, 4.7, 'Big', 'RUN.')
# end card
add('end', 0.4, 4.6, 'Title', 'UMBRAL', r"{\fad(600,0)}")
add('end', 0.9, 4.6, 'Sub', 'THE LAST LANTERN', r"{\fad(600,0)}")
add('end', 1.3, 4.6, 'Cap', '100 levels  ·  5 chapters\None story', r"{\fad(500,0)}")
add('end', 2.1, 4.6, 'Small', 'FREE  ·  PLAYS IN YOUR BROWSER\NKEYBOARD  ·  GAMEPAD  ·  TOUCH', r"{\fad(500,0)}")

head = """[Script Info]
ScriptType: v4.00+
PlayResX: 2160
PlayResY: 3840
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,UJ SemiBold,112,&H00F2F4F5,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,2,0,1,0,8,2,160,160,980,1
Style: Big,US Black,420,&H00F2F4F5,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,30,0,1,0,10,2,100,100,900,1
Style: Title,US Black,500,&H00EDF1F3,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,40,0,1,0,14,8,100,100,330,1
Style: Sub,UJ Light Italic,92,&H00D8DCDE,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,22,0,1,0,6,8,100,100,880,1
Style: Head,UJ Bold,96,&H00F2F4F5,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,26,0,1,0,6,2,100,100,1260,1
Style: Tag,UJ SemiBold,52,&H00C8CCCE,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,10,0,1,0,4,8,100,100,240,1
Style: Small,UJ SemiBold,62,&H00B4B8BA,&H00FFFFFF,&H00000000,&H90000000,0,0,0,0,100,100,12,0,1,0,4,2,100,100,620,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
open(sys.argv[2], 'w').write(head + '\n'.join(lines) + '\n')
print(len(lines), 'lines')
