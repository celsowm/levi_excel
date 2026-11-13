// Background music: one looping track per screen (menu, each stage), crossfaded on
// change and ducked while the spreadsheet or the pause menu is open. Browsers only
// allow audio after a user gesture, so playback starts on the first key or tap.
const TRACKS = { menu: 'menu', '1-1': '1-1', '1-2': '1-2', '1-3': '1-3' };
const VOLUME = 0.55;
const FADE = 1.2; // seconds
const MUTE_KEY = 'levi-excel:muted';

export function createMusic() {
  const players = new Map();
  let wanted = null;
  let duck = 1;
  let unlocked = false;
  let muted = false;
  try { muted = localStorage.getItem(MUTE_KEY) === '1'; } catch { /* storage blocked */ }

  function player(name) {
    if (!players.has(name)) {
      const audio = new Audio(`${import.meta.env.BASE_URL}audio/${TRACKS[name]}.mp3`);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = 0;
      players.set(name, audio);
    }
    return players.get(name);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    if (wanted && !muted) player(wanted).play().catch(() => { unlocked = false; });
  }
  for (const type of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(type, unlock, { capture: true });
  }

  return {
    // Switch to a track ('menu' or a stage id); unknown names fade everything out.
    play(name) {
      const next = TRACKS[name] ? name : null;
      if (next === wanted) return;
      wanted = next;
      if (!next) return;
      const audio = player(next);
      audio.currentTime = 0;
      if (unlocked && !muted) audio.play().catch(() => {});
    },
    duck(level) { duck = level; },
    get muted() { return muted; },
    toggleMute() {
      muted = !muted;
      try { localStorage.setItem(MUTE_KEY, muted ? '1' : '0'); } catch { /* storage blocked */ }
      if (!muted && unlocked && wanted) player(wanted).play().catch(() => {});
      return muted;
    },
    // Called every frame: fades the wanted track toward its volume and the rest to 0.
    update(dt) {
      const step = dt / FADE;
      for (const [name, audio] of players) {
        const target = name === wanted && !muted ? VOLUME * duck : 0;
        const v = audio.volume + Math.sign(target - audio.volume) * Math.min(step * VOLUME, Math.abs(target - audio.volume));
        audio.volume = Math.max(0, Math.min(1, v));
        if (audio.volume === 0 && target === 0 && !audio.paused) audio.pause();
      }
    },
  };
}
