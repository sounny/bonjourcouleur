const STORAGE_KEY = 'bonjour-couleur-3-state';
const MAX_NAME_LENGTH = 12;

const clone = typeof structuredClone === 'function'
  ? (value) => structuredClone(value)
  : (value) => JSON.parse(JSON.stringify(value));

const COLOR_LIBRARY = [
  { name: 'rouge', hex: '#ef4444', emoji: '🍓', object: 'une fraise', tip: 'Rouge comme une fraise juteuse.' },
  { name: 'bleu', hex: '#3b82f6', emoji: '🦋', object: 'un papillon', tip: 'Bleu comme le ciel du matin.' },
  { name: 'vert', hex: '#22c55e', emoji: '🐢', object: 'une tortue', tip: 'Vert comme une feuille fraîche.' },
  { name: 'jaune', hex: '#facc15', emoji: '🌟', object: 'une étoile', tip: 'Jaune comme le soleil qui brille.' },
  { name: 'orange', hex: '#fb923c', emoji: '🪁', object: 'un cerf-volant', tip: 'Orange comme un jus délicieux.' },
  { name: 'violet', hex: '#a855f7', emoji: '🪻', object: 'une fleur de lavande', tip: 'Violet comme la lavande qui sent bon.' },
  { name: 'rose', hex: '#f472b6', emoji: '🦩', object: 'un flamant rose', tip: 'Rose comme un nuage sucré.' },
  { name: 'marron', hex: '#8b5a2b', emoji: '🍫', object: 'du chocolat', tip: 'Marron comme un chocolat chaud.' },
  { name: 'noir', hex: '#111827', emoji: '🦉', object: 'une chouette', tip: 'Noir comme la nuit mystérieuse.' },
  { name: 'blanc', hex: '#f8fafc', emoji: '⛄', object: 'un bonhomme de neige', tip: 'Blanc comme un nuage.' },
  { name: 'gris', hex: '#94a3b8', emoji: '🌫️', object: 'la brume du matin', tip: 'Gris comme un petit nuage de pluie.' },
  { name: 'turquoise', hex: '#22d3ee', emoji: '🐬', object: 'un dauphin', tip: 'Turquoise comme la mer qui scintille.' }
];

const ADVENTURES = [
  {
    id: 'listen',
    title: 'Forêt Écoute',
    icon: '🎧',
    description: 'Écoute la voix et touche la bonne couleur.',
    type: 'game',
    mode: 'listening',
    rounds: 6,
    options: 4,
    sticker: { id: 'listener', emoji: '🎧', label: 'Oreilles magiques' }
  },
  {
    id: 'reading',
    title: 'Bibliothèque Arc-en-ciel',
    icon: '📚',
    description: 'Lis le mot français et trouve la couleur.',
    type: 'game',
    mode: 'reading',
    rounds: 6,
    options: 4,
    requires: 'listen',
    sticker: { id: 'reader', emoji: '📖', label: 'Maître des mots' }
  },
  {
    id: 'memory',
    title: 'Montagne Mémoire',
    icon: '⛰️',
    description: 'Observe la séquence de couleurs et répète-la.',
    type: 'game',
    mode: 'memory',
    rounds: 5,
    options: 4,
    requires: 'reading',
    sticker: { id: 'memory', emoji: '🧠', label: 'As de la mémoire' }
  },
  {
    id: 'creative',
    title: 'Atelier de Camy',
    icon: '🖌️',
    description: 'Peins la scène avec les couleurs françaises.',
    type: 'creative',
    requires: 'listen',
    sticker: { id: 'artist', emoji: '🎨', label: 'Artiste arc-en-ciel' }
  }
];

const CHALLENGE_DURATION = 60;

const DEFAULT_STATE = {
  playerName: '',
  settings: {
    music: true,
    sound: true,
    voice: true
  },
  progress: {
    listen: { completed: false, stars: 0, bestScore: 0 },
    reading: { completed: false, stars: 0, bestScore: 0 },
    memory: { completed: false, stars: 0, bestScore: 0 },
    creative: { completed: false, stars: 0, bestScore: 0 }
  },
  stickers: [],
  colorStats: COLOR_LIBRARY.reduce((acc, color) => {
    acc[color.name] = { correct: 0, wrong: 0 };
    return acc;
  }, {})
};

let preferredFrenchVoice = null;

function updatePreferredFrenchVoice() {
  if (!window.speechSynthesis) return;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return;

  const normalize = (value) => (value || '').toLowerCase();
  const frenchVoices = voices.filter((voice) => {
    const lang = normalize(voice.lang);
    return lang.startsWith('fr');
  });

  if (frenchVoices.length) {
    const exact = frenchVoices.find((voice) => {
      const lang = normalize(voice.lang);
      return lang === 'fr-fr' || lang === 'fr_fr';
    });
    preferredFrenchVoice = exact || frenchVoices[0];
    return;
  }

  const namedFrench = voices.find((voice) => /fran|french/i.test(voice.name));
  if (namedFrench) {
    preferredFrenchVoice = namedFrench;
  }
}

function ensurePreferredFrenchVoice() {
  if (!window.speechSynthesis) return null;
  if (!preferredFrenchVoice) {
    updatePreferredFrenchVoice();
  }
  return preferredFrenchVoice;
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  const handleVoicesChanged = () => updatePreferredFrenchVoice();
  if (typeof window.speechSynthesis.addEventListener === 'function') {
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
  }
  window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
  updatePreferredFrenchVoice();
}

class SoundManager {
  constructor() {
    this.context = null;
    this.enabled = true;
    this.musicEnabled = true;
    this.musicOscillator = null;
    this.musicInterval = null;
    this.masterGain = null;
  }

  prepare() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.context = new AudioContext();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.6;
      this.masterGain.connect(this.context.destination);
    }
  }

  resume() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else if (this.musicEnabled) {
      this.startMusic();
    }
  }

  setMusicEnabled(enabled) {
    this.musicEnabled = enabled;
    if (!enabled) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
  }

  startMusic() {
    if (!this.musicEnabled || !this.enabled) return;
    this.prepare();
    this.resume();
    if (!this.context || !this.masterGain || this.musicOscillator) return;

    const gain = this.context.createGain();
    gain.gain.value = 0.08;
    gain.connect(this.masterGain);

    const oscillator = this.context.createOscillator();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 196;
    oscillator.connect(gain);
    oscillator.start();

    const sequence = [196, 220, 247, 196, 165, 175, 196, 147];
    let index = 0;
    this.musicInterval = setInterval(() => {
      if (!this.musicEnabled || !this.enabled || !this.context) return;
      const freq = sequence[index % sequence.length];
      oscillator.frequency.setTargetAtTime(freq, this.context.currentTime, 0.3);
      index += 1;
    }, 1800);

    this.musicOscillator = oscillator;
    this.musicGain = gain;
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval);
      this.musicInterval = null;
    }
    if (this.musicOscillator) {
      try {
        this.musicOscillator.stop();
      } catch (e) {
        // ignore if already stopped
      }
      this.musicOscillator.disconnect();
      this.musicOscillator = null;
    }
    if (this.musicGain) {
      this.musicGain.disconnect();
      this.musicGain = null;
    }
  }

  playSuccess() {
    if (!this.enabled) return;
    this.prepare();
    this.resume();
    if (!this.context || !this.masterGain) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.3, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }

  playError() {
    if (!this.enabled) return;
    this.prepare();
    this.resume();
    if (!this.context || !this.masterGain) return;

    const now = this.context.currentTime;
    const osc = this.context.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.linearRampToValueAtTime(160, now + 0.25);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.linearRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  playReward() {
    if (!this.enabled) return;
    this.prepare();
    this.resume();
    if (!this.context || !this.masterGain) return;
    const now = this.context.currentTime;
    const notes = [392, 494, 587];
    notes.forEach((frequency, i) => {
      const osc = this.context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = frequency;
      const gain = this.context.createGain();
      gain.gain.value = 0.22;
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.15);
      osc.stop(now + i * 0.15 + 0.4);
    });
  }
}

const soundManager = new SoundManager();

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition || null;

const elements = {};
let appState = loadState();
let activeAdventure = null;
let currentRound = 0;
let totalRounds = 0;
let score = 0;
let mistakes = 0;
let currentTarget = null;
let currentSequence = [];
let sequenceIndex = 0;
let roundTimer = null;
let challengeTimer = null;
let challengeTimeLeft = CHALLENGE_DURATION;
let challengeScore = 0;
let practiceColor = null;
let recognitionInstance = null;

function $(selector) {
  return document.querySelector(selector);
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return mergeState(parsed, DEFAULT_STATE);
  } catch (err) {
    console.warn('State reset due to error', err);
    return clone(DEFAULT_STATE);
  }
}

function mergeState(saved, defaults) {
  const merged = clone(defaults);
  Object.keys(defaults).forEach((key) => {
    if (typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
      merged[key] = { ...defaults[key], ...saved?.[key] };
    } else {
      merged[key] = saved?.[key] ?? defaults[key];
    }
  });
  if (Array.isArray(saved?.stickers)) {
    merged.stickers = [...new Set(saved.stickers)];
  }
  if (saved?.colorStats) {
    merged.colorStats = { ...defaults.colorStats, ...saved.colorStats };
  }
  merged.playerName = saved?.playerName ?? '';
  return merged;
}

function initElements() {
  elements.homeScreen = $('#home-screen');
  elements.mapScreen = $('#map-screen');
  elements.gameScreen = $('#game-screen');
  elements.challengeScreen = $('#challenge-screen');
  elements.creativeScreen = $('#creative-screen');
  elements.practiceScreen = $('#practice-screen');
  elements.stickerScreen = $('#sticker-screen');
  elements.mapGrid = elements.mapScreen.querySelector('.map-grid');
  elements.mapGreeting = $('#map-greeting');
  elements.playerNameInput = $('#player-name');
  elements.startAdventure = $('#start-adventure');
  elements.tourButton = $('#tour-button');
  elements.backHome = $('#back-home');
  elements.openChallenge = $('#open-challenge');
  elements.openPractice = $('#open-practice');
  elements.backToMap = $('#back-to-map');
  elements.exitChallenge = $('#exit-challenge');
  elements.exitCreative = $('#exit-creative');
  elements.exitPractice = $('#exit-practice');
  elements.stickerButton = $('#sticker-button');
  elements.closeStickers = $('#close-stickers');
  elements.musicToggle = $('#music-toggle');
  elements.soundToggle = $('#sound-toggle');
  elements.voiceToggle = $('#voice-toggle');
  elements.instructions = $('#instructions');
  elements.gameArea = $('#game-area');
  elements.gameControls = $('#game-controls');
  elements.gameTitle = $('#game-title');
  elements.gameSubtitle = $('#game-subtitle');
  elements.timer = $('#timer');
  elements.score = $('#score');
  elements.challengeArea = $('#challenge-area');
  elements.challengeControls = $('#challenge-controls');
  elements.challengeTimer = $('#challenge-timer');
  elements.challengeScore = $('#challenge-score');
  elements.creativePalette = $('#creative-palette');
  elements.creativeColor = $('#creative-color');
  elements.creativeTips = $('#creative-tips');
  elements.creativeCanvas = $('#creative-canvas');
  elements.practicePrompt = $('#practice-prompt');
  elements.practiceNext = $('#practice-next');
  elements.practiceRecord = $('#practice-record');
  elements.practiceResult = $('#practice-result');
  elements.stickerCollection = $('#sticker-collection');
  elements.rewardDialog = $('#reward-dialog');
  elements.rewardText = $('#reward-text');
  elements.rewardSticker = $('#reward-sticker');
  elements.rewardClose = $('#reward-close');
  elements.toast = $('#toast');
}

function initEvents() {
  elements.startAdventure.addEventListener('click', handleStartAdventure);
  elements.tourButton.addEventListener('click', () => showScreen('map'));
  elements.backHome.addEventListener('click', () => showScreen('home'));
  elements.openChallenge.addEventListener('click', startChallenge);
  elements.openPractice.addEventListener('click', () => {
    showScreen('practice');
    preparePractice();
  });
  elements.backToMap.addEventListener('click', () => {
    stopGameTimers();
    showScreen('map');
  });
  elements.exitChallenge.addEventListener('click', stopChallenge);
  elements.exitCreative.addEventListener('click', () => showScreen('map'));
  elements.exitPractice.addEventListener('click', () => {
    stopPracticeRecognition();
    showScreen('map');
  });
  elements.musicToggle.addEventListener('click', toggleMusic);
  elements.soundToggle.addEventListener('click', toggleSoundEffects);
  elements.voiceToggle.addEventListener('click', toggleVoice);
  elements.stickerButton.addEventListener('click', () => {
    showScreen('stickers');
    renderStickers();
  });
  elements.closeStickers.addEventListener('click', () => showScreen('map'));
  elements.rewardClose.addEventListener('click', () => elements.rewardDialog.close());
  elements.creativeCanvas.addEventListener('click', handleCanvasClick);
  elements.practiceNext.addEventListener('click', () => {
    choosePracticeColor();
    speakColor(practiceColor);
  });
  elements.practiceRecord.addEventListener('click', () => handlePracticeRecording());
  elements.playerNameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleStartAdventure();
    }
  });
}

function handleStartAdventure() {
  const name = elements.playerNameInput.value.trim().slice(0, MAX_NAME_LENGTH);
  if (!name) {
    showToast('Écris ton prénom pour commencer.');
    return;
  }
  appState.playerName = name;
  saveState();
  soundManager.prepare();
  soundManager.startMusic();
  updateToggles();
  updateMap();
  showScreen('map');
}

function updateToggles() {
  elements.musicToggle.setAttribute('aria-pressed', String(appState.settings.music));
  elements.soundToggle.setAttribute('aria-pressed', String(appState.settings.sound));
  elements.voiceToggle.setAttribute('aria-pressed', String(appState.settings.voice));
  soundManager.setMusicEnabled(appState.settings.music);
  soundManager.setEnabled(appState.settings.sound);
}

function showScreen(name) {
  const screens = {
    home: elements.homeScreen,
    map: elements.mapScreen,
    game: elements.gameScreen,
    challenge: elements.challengeScreen,
    creative: elements.creativeScreen,
    practice: elements.practiceScreen,
    stickers: elements.stickerScreen
  };

  Object.values(screens).forEach((section) => section.classList.remove('active'));
  screens[name].classList.add('active');

  if (name === 'map') {
    elements.mapGreeting.textContent = appState.playerName
      ? `Bonjour ${appState.playerName} ! Choisis une aventure.`
      : 'Choisis une aventure.';
    updateMap();
  }

  if (name === 'creative') {
    renderPalette();
    renderCreativeTips();
  }
}

function updateMap() {
  elements.mapGrid.innerHTML = '';
  ADVENTURES.forEach((adventure) => {
    const tile = document.createElement('article');
    tile.className = 'map-tile';
    const progress = appState.progress[adventure.id];
    const locked = adventure.requires && !appState.progress[adventure.requires]?.completed;
    if (locked) tile.classList.add('locked');
    tile.setAttribute('role', 'listitem');
    tile.innerHTML = `
      <div class="tile-icon">${adventure.icon}</div>
      <h3>${adventure.title}</h3>
      <p>${adventure.description}</p>
      <div class="tile-progress">${renderStars(progress?.stars ?? 0)}</div>
      <button class="pill tile-action">${locked ? 'Verrouillé' : 'Jouer'}</button>
    `;
    if (!locked) {
      tile.querySelector('button').addEventListener('click', () => launchAdventure(adventure));
    }
    elements.mapGrid.appendChild(tile);
  });
}

function renderStars(count) {
  if (!count) return '☆ ☆ ☆';
  return Array.from({ length: 3 }, (_, i) => (i < count ? '⭐' : '☆')).join(' ');
}

function launchAdventure(adventure) {
  activeAdventure = adventure;
  if (adventure.type === 'creative') {
    showScreen('creative');
    renderPalette();
    renderCreativeTips();
    maybeUnlockCreativeSticker();
    return;
  }
  showScreen('game');
  elements.gameTitle.textContent = adventure.title;
  elements.gameSubtitle.textContent = adventure.description;
  elements.instructions.textContent = '';
  elements.gameArea.innerHTML = '';
  elements.gameControls.innerHTML = '';
  score = 0;
  mistakes = 0;
  currentRound = 0;
  totalRounds = adventure.rounds;
  elements.score.textContent = `⭐ ${score}`;
  elements.timer.textContent = '⏱️';
  elements.timer.style.visibility = 'hidden';
  if (adventure.mode === 'memory') {
    elements.instructions.textContent = 'Observe la séquence, puis clique les couleurs dans le même ordre.';
  } else if (adventure.mode === 'reading') {
    elements.instructions.textContent = 'Lis le mot et touche la couleur correspondante.';
  } else {
    elements.instructions.textContent = 'Écoute le mot en français et trouve la bonne couleur.';
  }
  nextRound();
}

function nextRound() {
  if (!activeAdventure) return;
  if (currentRound >= totalRounds) {
    finishAdventure();
    return;
  }
  currentRound += 1;
  elements.instructions.setAttribute('data-round', `${currentRound}/${totalRounds}`);
  if (activeAdventure.mode === 'memory') {
    setupMemoryRound();
  } else {
    setupMatchRound();
  }
}

function weightedColorPool() {
  const pool = [];
  COLOR_LIBRARY.forEach((color) => {
    const stats = appState.colorStats[color.name] || { correct: 0, wrong: 0 };
    const weight = Math.max(1, 1 + stats.wrong - Math.floor(stats.correct * 0.4));
    for (let i = 0; i < weight; i += 1) {
      pool.push(color);
    }
  });
  return pool;
}

function pickOptions(count) {
  const pool = weightedColorPool();
  const options = new Set();
  while (options.size < count) {
    options.add(pool[Math.floor(Math.random() * pool.length)]);
  }
  return Array.from(options);
}

function setupMatchRound() {
  const options = pickOptions(activeAdventure.options);
  currentTarget = options[Math.floor(Math.random() * options.length)];
  renderMatchGrid(options);
  if (activeAdventure.mode === 'listening') {
    elements.instructions.innerHTML = `Écoute et trouve la couleur. Indice : ${currentTarget.emoji}`;
    speakColor(currentTarget);
    addListenButton();
  } else if (activeAdventure.mode === 'reading') {
    elements.instructions.innerHTML = `Lis le mot <strong>${currentTarget.name.toUpperCase()}</strong> et touche la couleur.`;
    speakInstruction(`Trouve la couleur ${currentTarget.name}`);
  }
}

function renderMatchGrid(options) {
  elements.gameArea.innerHTML = '';
  elements.gameControls.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'color-grid';
  grid.style.gridTemplateColumns = `repeat(${Math.min(options.length, 3)}, minmax(120px, 1fr))`;
  options.forEach((color) => {
    const card = document.createElement('button');
    card.className = 'color-card';
    card.innerHTML = `
      <div class="swatch" style="background:${color.hex}">${color.emoji}</div>
      <div class="label">${color.name}</div>
      <div class="helper">${color.object}</div>
    `;
    card.addEventListener('click', () => handleColorChoice(color, card));
    grid.appendChild(card);
  });
  elements.gameArea.appendChild(grid);
}

function addListenButton() {
  const button = document.createElement('button');
  button.className = 'primary';
  button.textContent = 'Écouter encore 🔊';
  button.addEventListener('click', () => speakColor(currentTarget));
  elements.gameControls.appendChild(button);
}

function handleColorChoice(color, card) {
  if (!currentTarget) return;
  if (color.name === currentTarget.name) {
    card.classList.add('correct');
    score += 20;
    appState.colorStats[color.name].correct += 1;
    elements.score.textContent = `⭐ ${score}`;
    soundManager.playSuccess();
    showToast(`Bravo ! C'est ${color.name}.`);
    currentTarget = null;
    setTimeout(() => nextRound(), 600);
    if (activeAdventure.mode === 'reading') {
      speakColor(color);
    }
  } else {
    card.classList.add('incorrect');
    mistakes += 1;
    appState.colorStats[color.name].wrong += 1;
    soundManager.playError();
    showToast(`Ce n'est pas ${currentTarget.name}. Essaie encore !`);
    setTimeout(() => card.classList.remove('incorrect'), 400);
  }
  saveState();
}

function setupMemoryRound() {
  const options = pickOptions(activeAdventure.options);
  currentSequence = Array.from({ length: Math.min(3 + currentRound, 6) }, () => options[Math.floor(Math.random() * options.length)]);
  sequenceIndex = 0;
  elements.gameArea.innerHTML = '';
  const sequenceDisplay = document.createElement('div');
  sequenceDisplay.className = 'sequence-display';
  currentSequence.forEach(() => {
    const dot = document.createElement('div');
    dot.className = 'sequence-dot';
    sequenceDisplay.appendChild(dot);
  });
  elements.gameArea.appendChild(sequenceDisplay);

  const grid = document.createElement('div');
  grid.className = 'color-grid';
  grid.style.gridTemplateColumns = `repeat(${Math.min(options.length, 3)}, minmax(120px, 1fr))`;

  options.forEach((color) => {
    const card = document.createElement('button');
    card.className = 'color-card';
    card.innerHTML = `
      <div class="swatch" style="background:${color.hex}">${color.emoji}</div>
      <div class="label">${color.name}</div>
    `;
    card.addEventListener('click', () => handleSequenceChoice(color, card));
    grid.appendChild(card);
  });
  elements.gameArea.appendChild(grid);
  elements.gameControls.innerHTML = '';
  const replayBtn = document.createElement('button');
  replayBtn.className = 'pill';
  replayBtn.textContent = 'Rejouer la séquence 🔁';
  replayBtn.addEventListener('click', () => playSequence(sequenceDisplay));
  elements.gameControls.appendChild(replayBtn);
  playSequence(sequenceDisplay);
}

function playSequence(display) {
  let delay = 0;
  currentSequence.forEach((color, index) => {
    setTimeout(() => {
      speakColor(color);
      const dot = display.children[index];
      dot.classList.add('active');
      setTimeout(() => dot.classList.remove('active'), 500);
    }, delay);
    delay += 800;
  });
}

function handleSequenceChoice(color, card) {
  const expected = currentSequence[sequenceIndex];
  if (!expected) return;
  if (color.name === expected.name) {
    card.classList.add('correct');
    setTimeout(() => card.classList.remove('correct'), 400);
    sequenceIndex += 1;
    soundManager.playSuccess();
    if (sequenceIndex >= currentSequence.length) {
      score += 40;
      elements.score.textContent = `⭐ ${score}`;
      showToast('Séquence parfaite !');
      setTimeout(() => nextRound(), 800);
    }
  } else {
    mistakes += 1;
    soundManager.playError();
    sequenceIndex = 0;
    showToast(`Oops ! Recommence la séquence.`);
  }
  saveState();
}

function finishAdventure() {
  stopGameTimers();
  const adventureState = appState.progress[activeAdventure.id];
  const accuracy = totalRounds ? Math.max(0, 1 - mistakes / totalRounds) : 1;
  const stars = accuracy >= 0.95 ? 3 : accuracy >= 0.75 ? 2 : 1;
  adventureState.completed = true;
  adventureState.stars = Math.max(adventureState.stars, stars);
  adventureState.bestScore = Math.max(adventureState.bestScore ?? 0, score);
  saveState();
  updateMap();
  showToast(`Mission accomplie ! ${stars} ${stars === 1 ? 'étoile' : 'étoiles'} gagnée(s).`);
  awardSticker(activeAdventure.sticker);
  showScreen('map');
}

function stopGameTimers() {
  if (roundTimer) {
    clearInterval(roundTimer);
    roundTimer = null;
  }
}

function startChallenge() {
  showScreen('challenge');
  challengeTimeLeft = CHALLENGE_DURATION;
  challengeScore = 0;
  elements.challengeScore.textContent = '🎯 0';
  elements.challengeArea.innerHTML = '';
  elements.challengeControls.innerHTML = '';
  elements.challengeTimer.textContent = `⏱️ ${challengeTimeLeft}`;
  prepareChallengeRound();
  if (challengeTimer) clearInterval(challengeTimer);
  challengeTimer = setInterval(() => {
    challengeTimeLeft -= 1;
    elements.challengeTimer.textContent = `⏱️ ${challengeTimeLeft}`;
    if (challengeTimeLeft <= 0) {
      stopChallenge();
    }
  }, 1000);
}

function stopChallenge() {
  if (challengeTimer) {
    clearInterval(challengeTimer);
    challengeTimer = null;
  }
  showScreen('map');
  showToast(`Défi terminé ! Score : ${challengeScore}`);
}

function prepareChallengeRound() {
  const options = pickOptions(4);
  const target = options[Math.floor(Math.random() * options.length)];
  currentTarget = target;
  elements.challengeArea.innerHTML = '';
  const prompt = document.createElement('div');
  prompt.className = 'instructions';
  prompt.textContent = `Trouve la couleur : ${target.name}`;
  elements.challengeArea.appendChild(prompt);
  const grid = document.createElement('div');
  grid.className = 'color-grid';
  grid.style.gridTemplateColumns = 'repeat(2, minmax(120px, 1fr))';
  options.forEach((color) => {
    const card = document.createElement('button');
    card.className = 'color-card';
    card.innerHTML = `
      <div class="swatch" style="background:${color.hex}">${color.emoji}</div>
      <div class="label">${color.name}</div>
    `;
    card.addEventListener('click', () => {
      if (color.name === target.name) {
        challengeScore += 1;
        soundManager.playSuccess();
        elements.challengeScore.textContent = `🎯 ${challengeScore}`;
        prepareChallengeRound();
      } else {
        soundManager.playError();
        showToast('Essaie encore !');
      }
    });
    grid.appendChild(card);
  });
  elements.challengeArea.appendChild(grid);
  speakColor(target);
}

function renderPalette() {
  elements.creativePalette.innerHTML = '';
  COLOR_LIBRARY.forEach((color) => {
    const button = document.createElement('button');
    button.style.background = color.hex;
    button.innerHTML = `<span>${color.emoji}</span><span>${color.name}</span>`;
    button.addEventListener('click', () => {
      document
        .querySelectorAll('#creative-palette button')
        .forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');
      elements.creativeColor.textContent = `🎨 ${color.name}`;
      elements.creativePalette.dataset.active = color.name;
      speakColor(color);
      renderCreativeTips();
    });
    elements.creativePalette.appendChild(button);
  });
  elements.creativePalette.firstElementChild?.click();
}

function handleCanvasClick(event) {
  const area = event.target.dataset.area;
  if (!area) return;
  const colorName = elements.creativePalette.dataset.active;
  const color = COLOR_LIBRARY.find((c) => c.name === colorName);
  if (!color) return;
  event.target.setAttribute('fill', color.hex);
  soundManager.playSuccess();
  const areaNames = {
    sun: 'Le soleil',
    house: 'La maison',
    roof: 'Le toit',
    door: 'La porte',
    'tree-top': "L'arbre",
    'tree-trunk': 'Le tronc',
    ground: 'Le sol'
  };
  showToast(`${areaNames[area] ?? 'Super'} est ${color.name}.`);
  maybeUnlockCreativeSticker();
}

function renderCreativeTips() {
  const color = COLOR_LIBRARY.find((c) => c.name === elements.creativePalette.dataset.active) || COLOR_LIBRARY[0];
  elements.creativeTips.innerHTML = `
    <h3>Astuce couleur</h3>
    <p>${color.tip}</p>
    <p>Essaie de colorier toute la scène en utilisant au moins 4 couleurs différentes.</p>
  `;
}

function maybeUnlockCreativeSticker() {
  const usedColors = new Set();
  elements.creativeCanvas.querySelectorAll('[data-area]').forEach((shape) => {
    const fill = shape.getAttribute('fill');
    const color = COLOR_LIBRARY.find((c) => c.hex === fill);
    if (color) usedColors.add(color.name);
  });
  if (usedColors.size >= 4) {
    appState.progress.creative.completed = true;
    appState.progress.creative.stars = Math.max(appState.progress.creative.stars, 3);
    saveState();
    updateMap();
    awardSticker(ADVENTURES.find((a) => a.id === 'creative').sticker);
  }
}

function preparePractice() {
  if (!SpeechRecognition) {
    elements.practiceRecord.disabled = true;
    elements.practiceRecord.textContent = '🎙️ Micro non disponible';
  } else {
    elements.practiceRecord.disabled = false;
    elements.practiceRecord.textContent = '🎙️ Parler';
  }
  choosePracticeColor();
  speakColor(practiceColor);
}

function choosePracticeColor() {
  practiceColor = COLOR_LIBRARY[Math.floor(Math.random() * COLOR_LIBRARY.length)];
  elements.practicePrompt.textContent = `${practiceColor.emoji} ${practiceColor.name}`;
  elements.practiceResult.textContent = '🎤 ...';
}

function handlePracticeRecording() {
  if (!SpeechRecognition) {
    showToast('Le micro n’est pas disponible sur cet appareil.');
    return;
  }
  stopPracticeRecognition();
  recognitionInstance = new SpeechRecognition();
  recognitionInstance.lang = 'fr-FR';
  recognitionInstance.interimResults = false;
  recognitionInstance.maxAlternatives = 3;
  recognitionInstance.onresult = (event) => {
    const transcript = Array.from(event.results[0]).map((res) => res.transcript.toLowerCase());
    const success = transcript.some((text) => text.includes(practiceColor.name));
    if (success) {
      elements.practiceResult.textContent = '🎉 Bravo !';
      soundManager.playSuccess();
      awardSticker({ id: 'speaker', emoji: '🎤', label: 'Voix de star' });
    } else {
      elements.practiceResult.textContent = '🤔 Essaie encore';
      soundManager.playError();
    }
  };
  recognitionInstance.onerror = () => {
    elements.practiceResult.textContent = '⚠️ Micro en pause';
  };
  recognitionInstance.onend = () => {
    recognitionInstance = null;
  };
  recognitionInstance.start();
  elements.practiceResult.textContent = '🎤 Écoute...';
}

function stopPracticeRecognition() {
  if (recognitionInstance) {
    recognitionInstance.stop();
    recognitionInstance = null;
  }
}

function speakColor(color) {
  if (!appState.settings.voice || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(color.name);
  const voice = ensurePreferredFrenchVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'fr-FR';
  }
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function speakInstruction(text) {
  if (!appState.settings.voice || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = ensurePreferredFrenchVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = 'fr-FR';
  }
  utterance.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

let toastTimeout = null;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    elements.toast.classList.remove('visible');
  }, 1800);
}

function renderStickers() {
  elements.stickerCollection.innerHTML = '';
  const stickerSet = new Set(appState.stickers);
  const stickerPool = [
    ...ADVENTURES.map((a) => a.sticker),
    { id: 'speaker', emoji: '🎤', label: 'Voix de star' }
  ];
  stickerPool.forEach((sticker) => {
    const card = document.createElement('div');
    card.className = 'sticker-card';
    if (!stickerSet.has(sticker.id)) card.classList.add('locked');
    card.innerHTML = `
      <div class="sticker-icon">${sticker.emoji}</div>
      <p>${sticker.label}</p>
    `;
    elements.stickerCollection.appendChild(card);
  });
}

function awardSticker(sticker) {
  if (!sticker || appState.stickers.includes(sticker.id)) return;
  appState.stickers.push(sticker.id);
  saveState();
  renderStickers();
  soundManager.playReward();
  elements.rewardText.textContent = `Tu as gagné l'autocollant « ${sticker.label} » !`;
  elements.rewardSticker.textContent = sticker.emoji;
  if (typeof elements.rewardDialog.showModal === 'function') {
    elements.rewardDialog.showModal();
  }
}

function toggleMusic() {
  appState.settings.music = !appState.settings.music;
  updateToggles();
  saveState();
}

function toggleSoundEffects() {
  appState.settings.sound = !appState.settings.sound;
  updateToggles();
  saveState();
}

function toggleVoice() {
  appState.settings.voice = !appState.settings.voice;
  updateToggles();
  saveState();
}

document.addEventListener('DOMContentLoaded', () => {
  initElements();
  initEvents();
  updateToggles();
  if (appState.playerName) {
    elements.playerNameInput.value = appState.playerName;
    showScreen('map');
  } else {
    showScreen('home');
  }
  renderStickers();
});
