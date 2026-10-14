'use strict';
/* ==========================================================
   UMBRAL — The Last Lantern
   An original atmospheric silhouette platformer.
   ========================================================== */

const PHYS = {
  G: 2000, JUMP: 640, RUN: 230, PUSH: 120, AIRACC: 2400, GROUNDACC: 3000,
  MAXFALL: 950, COYOTE: 0.1, BUFFER: 0.13, PW: 18, PH: 36, STEP: 12
};
const GY = 600; // base ground line

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

const CHAPTERS = [
  { name: 'The Whispering Wood', roman: 'I', sky: ['#cfd0cc', '#8f908c', '#3d3e3c'], fog: 0.35, light: 0.72,
    intro: 'When the Great Lantern fell, the world forgot its colour.' },
  { name: 'The Drowned Marsh', roman: 'II', sky: ['#c4c7c6', '#7f8483', '#2f3332'], fog: 0.55, light: 0.25,
    intro: 'Below the roots, the water remembers every lost light.' },
  { name: 'The Hollow City', roman: 'III', sky: ['#d3d1cb', '#8b8781', '#33302c'], fog: 0.4, light: 0.5,
    intro: 'Once, ten thousand windows burned here.' },
  { name: 'The Iron Mill', roman: 'IV', sky: ['#bdbcb8', '#6c6b67', '#1d1d1c'], fog: 0.3, light: 0.85,
    intro: 'They tried to forge a new sun from the dark. It hungered.' },
  { name: 'The Pale Edge', roman: 'V', sky: ['#ecebe6', '#a9a8a2', '#4a4945'], fog: 0.6, light: 0.5,
    intro: 'At the edge of the world, the last flame waits for you.' }
];

// One line of story per level — the tale of Wren and the last ember.
const STORY = [
  // Chapter I — The Whispering Wood
  'Wren woke beside a lantern that would not go out.',
  'The trees leaned closer, curious about the light.',
  'Thorns grow where the old paths used to be.',
  'Someone set these traps for creatures of the dark.',
  'Or for children who carry light.',
  'The ember pulsed, warm, like a second heartbeat.',
  'Far away, a bell rang once — then never again.',
  'The wood whispered a name she had forgotten.',
  'Every fallen leaf was once a tiny flame.',
  'She learned the forest kills the ones who hesitate.',
  'She learned it also spares the ones who listen.',
  'The lantern grew heavier. Or she grew tired.',
  'Moths followed her, then stopped at the shadows.',
  'An old swing creaked with no one on it.',
  'The ember showed her footprints — her own, from long ago.',
  'Had she walked this path before?',
  'The trees stopped whispering. Something else began.',
  'The Dark had noticed the light.',
  'Run, said the ember. Do not look back.',
  'At the forest’s end, the ground turned to water.',
  // Chapter II — The Drowned Marsh
  'The marsh swallowed sound the way it swallowed light.',
  'Logs drifted like sleeping animals.',
  'Pale things moved under the surface.',
  'Wren kept the lantern high above the water.',
  'The Husks came from the reeds: the ones who let their lights go out.',
  'They did not hate her. They only wanted to be warm.',
  'She could not give the ember away. Not yet.',
  'Old stones sank when she pressed upon them, and doors woke.',
  'A drowned village slept beneath her feet.',
  'Windows below the water still held a faint glow.',
  'Memories, the ember said. Only memories.',
  'The mud remembered every step and tried to keep it.',
  'She found a small shoe in the reeds and kept walking.',
  'Rain began — the first rain without colour.',
  'The ember hissed but held.',
  'Fog rolled in thick enough to hide whole worlds.',
  'Somewhere a husk was singing a lullaby, badly.',
  'Wren hummed the rest of the tune.',
  'The Dark rose from the water like a tide.',
  'Ahead: walls, towers, a city of hollow windows.',
  // Chapter III — The Hollow City
  'The gates of the city had been locked from the inside.',
  'Levers waited, patient, for a small hand.',
  'Statues of lamplighters lined every street.',
  'They had kept the Great Lantern burning for a thousand years.',
  'Then one night, they stopped.',
  'Wren read their names carved in stone. One was hers.',
  'The machines of the city still moved, crushing nothing.',
  'Heavy hearts, heavy stones — the city remembered both.',
  'She found the tower where the Great Lantern once hung.',
  'Its chain had been cut clean.',
  'Not fallen, then. Stolen.',
  'The ember flickered, angry for the first time.',
  'Footprints in the ash led east, toward smoke.',
  'Bridges hung over nothing, swaying in the dark.',
  'A clock tower struck an hour that does not exist.',
  'Wren began to remember the night of the fall.',
  'She had been the youngest lamplighter.',
  'She had been the one holding the lantern when it slipped.',
  'The Dark came through the streets, hungry for that memory.',
  'She ran east, toward the iron and the smoke.',
  // Chapter IV — The Iron Mill
  'The mill groaned like a great sleeping beast.',
  'Saws sang through the dark for no one.',
  'Here, they tried to build a sun from gears and fire.',
  'They fed it every light they could find.',
  'Lanterns, candles, fireflies. Even children’s dreams.',
  'And it was never enough.',
  'Wren saw the Great Lantern hanging in its iron heart.',
  'Cold. Caged. Not broken — only waiting.',
  'The workers were long gone; only the machines remained.',
  'Pistons rose and fell, rehearsing the end of the world.',
  'The ember pulled her forward like a hand.',
  'She climbed through gears the size of houses.',
  'Sparks fell like snow that burned.',
  'The furnace had a voice, and it knew her name.',
  'Give me your ember, it said. I will make you warm.',
  'Wren held the lantern tighter.',
  'She opened the iron cage with a lever small as a finger.',
  'The Great Lantern was gone — carried to the Edge.',
  'The mill woke all at once, and the Dark poured out.',
  'Beyond the mill, the world simply stopped.',
  // Chapter V — The Pale Edge
  'Here the ground floated, unsure of being ground.',
  'Everything was white, the way a page is white.',
  'The Dark could not follow her colourless steps here.',
  'But it waited at every edge.',
  'Islands of stone drifted past like slow thoughts.',
  'She saw the Great Lantern at last, on the final rock.',
  'Around it, the lamplighters stood — made of shadow now.',
  'They had followed it to the Edge to keep it safe.',
  'They had given their lights to it, one by one.',
  'Only one light was missing. Hers.',
  'The ember had always been part of the Great Lantern.',
  'The piece that fell when she let go.',
  'She was not running from the Dark. She was returning.',
  'Every death had been a lesson in getting up.',
  'Every step had been an apology.',
  'The shadows bowed as she passed.',
  'The path narrowed to the width of a single brave step.',
  'The Dark rose one last time, larger than the sky.',
  'Wren did not look back.',
  'She set the ember in its place, and the world remembered colour.'
];

const ENDING = [
  'The Great Lantern breathed.',
  'Light ran down the hills like water.',
  'Somewhere, a bell rang twice.',
  'Thank you for carrying the light.'
];
