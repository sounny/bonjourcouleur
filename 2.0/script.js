const STORAGE_KEY = 'bonjour-couleur-progress-v2';
const LevelModes = {
    LISTEN: 'listen',
    READING: 'reading',
    MEMORY: 'memory'
};

const COLOR_LIBRARY = {
    rouge: '#e74c3c',
    bleu: '#3498db',
    vert: '#2ecc71',
    orange: '#e67e22',
    rose: '#ff79c6',
    jaune: '#f1c40f',
    marron: '#8d6e63',
    noir: '#2c3e50',
    blanc: '#ffffff',
    gris: '#95a5a6',
    violet: '#8e44ad',
    turquoise: '#1abc9c',
    beige: '#f5deb3'
};

const LEVELS = [
    { id: 1, mode: LevelModes.LISTEN, rounds: 2, options: 2, timeLimit: 16000, instructions: 'Écoute la couleur et touche la bonne case.' },
    { id: 2, mode: LevelModes.LISTEN, rounds: 3, options: 3, timeLimit: 14000, instructions: 'Plus rapide ! Écoute et trouve parmi trois couleurs.' },
    { id: 3, mode: LevelModes.LISTEN, rounds: 3, options: 4, timeLimit: 12000, instructions: 'Encore plus de couleurs. Garde l\'oreille attentive !' },
    { id: 4, mode: LevelModes.READING, rounds: 3, options: 4, timeLimit: 12000, instructions: 'Lis le mot et choisis la couleur correspondante.' },
    { id: 5, mode: LevelModes.READING, rounds: 3, options: 5, timeLimit: 11000, instructions: 'Encore plus de lecture. Reste concentré !' },
    { id: 6, mode: LevelModes.LISTEN, rounds: 4, options: 5, timeLimit: 10000, instructions: 'Mélange auditif et visuel : écoute vite et sélectionne !' },
    { id: 7, mode: LevelModes.MEMORY, rounds: 1, sequenceLength: 3, options: 5, instructions: 'Observe la séquence de couleurs puis répète-la.' },
    { id: 8, mode: LevelModes.MEMORY, rounds: 1, sequenceLength: 4, options: 6, instructions: 'La séquence est plus longue. Tu peux le faire !' },
    { id: 9, mode: LevelModes.MEMORY, rounds: 1, sequenceLength: 5, options: 6, instructions: 'Attention à la mémoire. Respire et regarde bien.' },
    { id: 10, mode: LevelModes.READING, rounds: 4, options: 6, timeLimit: 9000, instructions: 'Ultime défi : lis vite et sois précis.' }
];

const GameState = {
    playerName: '',
    currentLevel: 1,
    currentConfig: LEVELS[0],
    score: 0,
    mistakes: 0,
    incorrectCounts: {},
    completedRounds: 0,
    levelStartTime: null,
    progress: Array.from({ length: LEVELS.length }, () => ({ stars: 0, bestScore: 0 })),
    highestUnlocked: 1,
    settings: {
        speechEnabled: true
    },
    modeState: {},
    load() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) {
            return;
        }
        try {
            const data = JSON.parse(stored);
            this.playerName = data.playerName || '';
            this.score = data.score || 0;
            this.incorrectCounts = data.incorrectCounts || {};
            this.progress = data.progress || this.progress;
            this.highestUnlocked = data.highestUnlocked || 1;
            this.settings = Object.assign({}, this.settings, data.settings || {});
            if (this.playerName) {
                const nameInput = document.getElementById('name-input');
                if (nameInput) {
                    nameInput.value = this.playerName;
                }
            }
        } catch (error) {
            console.warn('Failed to load saved data', error);
        }
    },
    save() {
        const data = {
            playerName: this.playerName,
            score: this.score,
            incorrectCounts: this.incorrectCounts,
            progress: this.progress,
            highestUnlocked: this.highestUnlocked,
            settings: this.settings
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    },
    resetForLevel(levelNumber) {
        this.currentLevel = levelNumber;
        this.currentConfig = LEVELS[levelNumber - 1];
        this.mistakes = 0;
        this.completedRounds = 0;
        this.levelStartTime = Date.now();
        this.modeState = {
            timerId: null,
            timerInterval: null,
            awaitingInput: true,
            sequence: [],
            playerSequence: []
        };
    }
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    attachEventListeners();
    GameState.load();
    updateScoreDisplay();
    updateSettingsUI();
});

function cacheElements() {
    elements.screens = document.querySelectorAll('.screen');
    elements.nameInput = document.getElementById('name-input');
    elements.startButton = document.getElementById('start-button');
    elements.introBubble = document.getElementById('intro-bubble');
    elements.playerGreeting = document.getElementById('player-greeting');
    elements.levelGrid = document.getElementById('level-grid');
    elements.levelDisplay = document.getElementById('level-display');
    elements.instructions = document.getElementById('instructions');
    elements.colorPrompt = document.getElementById('color-prompt');
    elements.colorGrid = document.getElementById('color-grid');
    elements.listenButton = document.getElementById('listen-button');
    elements.scoreDisplay = document.getElementById('score-display');
    elements.timerDisplay = document.getElementById('timer-display');
    elements.memoryControls = document.getElementById('memory-controls');
    elements.replaySequence = document.getElementById('replay-sequence');
    elements.backToLevels = document.getElementById('back-to-levels');
    elements.settingsButton = document.getElementById('settings-button');
    elements.settingsPanel = document.getElementById('settings-panel');
    elements.speechToggle = document.getElementById('speech-toggle');
    elements.closeSettings = document.getElementById('close-settings');
    elements.toast = document.getElementById('toast');
    elements.levelCompleteTitle = document.getElementById('level-complete-title');
    elements.starContainer = document.getElementById('star-container');
    elements.levelStats = document.getElementById('level-stats');
    elements.nextLevelButton = document.getElementById('next-level-button');
    elements.replayLevelButton = document.getElementById('replay-level-button');
    elements.backToMapButton = document.getElementById('back-to-map-button');
}

function attachEventListeners() {
    elements.startButton.addEventListener('click', startGame);
    elements.listenButton.addEventListener('click', playPrompt);
    elements.replaySequence.addEventListener('click', () => playMemorySequence(false));
    elements.backToLevels.addEventListener('click', () => showScreen('level-select-screen'));
    elements.settingsButton.addEventListener('click', toggleSettings);
    elements.closeSettings.addEventListener('click', hideSettings);
    elements.speechToggle.addEventListener('change', (event) => {
        GameState.settings.speechEnabled = event.target.checked;
        updateSettingsUI();
        GameState.save();
    });
    elements.nextLevelButton.addEventListener('click', () => {
        const nextLevel = Math.min(GameState.currentLevel + 1, LEVELS.length);
        if (nextLevel === GameState.currentLevel && GameState.currentLevel === LEVELS.length) {
            showScreen('level-select-screen');
            return;
        }
        enterLevel(nextLevel);
    });
    elements.replayLevelButton.addEventListener('click', () => enterLevel(GameState.currentLevel));
    elements.backToMapButton.addEventListener('click', () => showScreen('level-select-screen'));
}

function startGame() {
    const enteredName = (elements.nameInput.value || '').trim();
    if (!enteredName) {
        alert('S\'il te plaît, entre ton nom !');
        return;
    }
    GameState.playerName = enteredName;
    GameState.save();
    elements.introBubble.textContent = `Allons-y, ${GameState.playerName} !`;
    showScreen('intro-screen');
    setTimeout(() => {
        populateLevelGrid();
        updatePlayerGreeting();
        showScreen('level-select-screen');
    }, 2400);
}

function showScreen(id) {
    elements.screens.forEach((screen) => {
        if (screen.id === id) {
            screen.classList.add('active');
        } else {
            screen.classList.remove('active');
        }
    });
    if (id === 'level-select-screen') {
        populateLevelGrid();
        hideSettings();
    }
    if (id === 'game-screen') {
        hideSettings();
    }
}

function populateLevelGrid() {
    elements.levelGrid.innerHTML = '';
    LEVELS.forEach((level) => {
        const card = document.createElement('button');
        card.className = 'level-card';
        card.setAttribute('role', 'listitem');
        card.innerHTML = `
            <strong>Niveau ${level.id}</strong>
            <span>${level.instructions}</span>
            <div class="level-stars" aria-label="Étoiles">${renderStars(GameState.progress[level.id - 1].stars)}</div>
        `;
        if (level.id > GameState.highestUnlocked) {
            card.classList.add('locked');
        } else {
            card.addEventListener('click', () => enterLevel(level.id));
        }
        elements.levelGrid.appendChild(card);
    });
}

function updatePlayerGreeting() {
    const highest = GameState.highestUnlocked;
    const starsTotal = GameState.progress.reduce((sum, level) => sum + level.stars, 0);
    const message = `Salut ${GameState.playerName} ! Tu as gagné ${starsTotal} ⭐ et débloqué le niveau ${highest}.`;
    elements.playerGreeting.textContent = message;
}

function enterLevel(levelNumber) {
    GameState.resetForLevel(levelNumber);
    elements.levelDisplay.textContent = `Niveau ${levelNumber}`;
    elements.instructions.textContent = GameState.currentConfig.instructions;
    elements.colorPrompt.textContent = '';
    elements.colorGrid.innerHTML = '';
    elements.memoryControls.classList.add('hidden');
    elements.listenButton.classList.remove('hidden');
    clearTimer();
    GameState.modeState.levelStart = Date.now();

    showScreen('game-screen');
    if (GameState.currentConfig.mode === LevelModes.MEMORY) {
        setupMemoryLevel();
    } else {
        setupColorMatchLevel();
    }
    updateScoreDisplay();
}

function setupColorMatchLevel() {
    const { options } = GameState.currentConfig;
    const roundOptions = selectColorOptions(options);
    const targetColor = chooseTargetColor(roundOptions);
    GameState.modeState.currentOptions = roundOptions;
    GameState.modeState.targetColor = targetColor;
    GameState.modeState.awaitingInput = true;
    if (GameState.currentConfig.timeLimit) {
        startLevelTimer(GameState.currentConfig.timeLimit);
    } else {
        clearTimer();
    }
    renderColorBoxes(roundOptions);

    if (GameState.currentConfig.mode === LevelModes.READING) {
        elements.listenButton.textContent = 'Écouter 🔊';
        elements.colorPrompt.textContent = formatColorName(targetColor);
    } else {
        elements.listenButton.textContent = 'Écouter 🔊';
        elements.colorPrompt.textContent = '';
    }

    if (GameState.settings.speechEnabled) {
        setTimeout(() => playPrompt(), 350);
    }
}

function setupMemoryLevel() {
    const config = GameState.currentConfig;
    const options = selectColorOptions(config.options || 5);
    const sequence = buildMemorySequence(options, config.sequenceLength || 3);

    GameState.modeState.currentOptions = options;
    GameState.modeState.sequence = sequence;
    GameState.modeState.playerSequence = [];
    GameState.modeState.awaitingInput = false;

    elements.memoryControls.classList.remove('hidden');
    elements.listenButton.classList.add('hidden');
    elements.colorPrompt.textContent = 'Regarde la séquence…';

    renderColorBoxes(options, true);
    setTimeout(() => playMemorySequence(true), 400);
}

function renderColorBoxes(options, isMemory = false) {
    elements.colorGrid.innerHTML = '';
    options.forEach((colorName) => {
        const colorBox = document.createElement('button');
        colorBox.className = 'color-box';
        colorBox.style.backgroundColor = COLOR_LIBRARY[colorName];
        colorBox.dataset.color = colorName;
        colorBox.setAttribute('aria-label', `Couleur ${formatColorName(colorName)}`);
        colorBox.type = 'button';
        colorBox.addEventListener('click', () => {
            if (GameState.currentConfig.mode === LevelModes.MEMORY) {
                handleMemoryChoice(colorName, colorBox);
            } else {
                handleColorChoice(colorName, colorBox);
            }
        });
        if (GameState.currentConfig.mode === LevelModes.READING && isMemory === false) {
            const label = document.createElement('span');
            label.className = 'color-label';
            label.textContent = formatColorName(colorName);
            colorBox.appendChild(label);
        }
        elements.colorGrid.appendChild(colorBox);
    });
}

function handleColorChoice(colorName, element) {
    if (!GameState.modeState.awaitingInput) {
        return;
    }
    if (colorName === GameState.modeState.targetColor) {
        GameState.modeState.awaitingInput = false;
        element.classList.add('correct');
        GameState.score += 10;
        GameState.completedRounds += 1;
        if (GameState.incorrectCounts[colorName]) {
            GameState.incorrectCounts[colorName] = Math.max(
                0,
                GameState.incorrectCounts[colorName] - 1
            );
        }
        updateScoreDisplay();
        setTimeout(() => {
            element.classList.remove('correct');
            if (GameState.completedRounds >= GameState.currentConfig.rounds) {
                completeLevel();
            } else {
                setupColorMatchLevel();
                showToast(`Bravo ! Tour ${GameState.completedRounds}/${GameState.currentConfig.rounds}`);
            }
        }, 600);
    } else {
        element.classList.add('incorrect');
        registerMistake(colorName);
        setTimeout(() => element.classList.remove('incorrect'), 800);
    }
}

function handleMemoryChoice(colorName, element) {
    if (!GameState.modeState.awaitingInput) {
        return;
    }
    const step = GameState.modeState.playerSequence.length;
    const expected = GameState.modeState.sequence[step];
    if (colorName === expected) {
        element.classList.add('correct');
        GameState.modeState.playerSequence.push(colorName);
        setTimeout(() => element.classList.remove('correct'), 500);
        if (GameState.modeState.playerSequence.length === GameState.modeState.sequence.length) {
            GameState.score += 20;
            GameState.completedRounds = GameState.currentConfig.rounds;
            updateScoreDisplay();
            completeLevel();
        }
    } else {
        element.classList.add('incorrect');
        registerMistake(expected);
        GameState.modeState.playerSequence = [];
        GameState.modeState.awaitingInput = false;
        setTimeout(() => {
            element.classList.remove('incorrect');
            playMemorySequence(true);
        }, 800);
    }
}

function playPrompt() {
    if (!GameState.settings.speechEnabled) {
        return;
    }
    if (GameState.currentConfig.mode === LevelModes.MEMORY) {
        playMemorySequence(false);
        return;
    }
    const word = GameState.modeState.targetColor;
    if (!word) {
        return;
    }
    speak(word);
}

function playMemorySequence(initial) {
    const sequence = GameState.modeState.sequence || [];
    const colorButtons = Array.from(elements.colorGrid.querySelectorAll('.color-box'));
    const buttonMap = new Map(colorButtons.map((button) => [button.dataset.color, button]));
    if (!sequence.length) {
        return;
    }
    GameState.modeState.playerSequence = [];
    GameState.modeState.awaitingInput = false;
    sequence.forEach((colorName, index) => {
        setTimeout(() => {
            const button = buttonMap.get(colorName);
            if (button) {
                button.classList.add('flash');
                setTimeout(() => button.classList.remove('flash'), 550);
            }
            if (GameState.settings.speechEnabled) {
                speak(colorName);
            }
            if (index === sequence.length - 1) {
                setTimeout(() => {
                    GameState.modeState.awaitingInput = true;
                    elements.colorPrompt.textContent = 'À toi de jouer !';
                }, 600);
            }
        }, index * 900);
    });
    if (initial) {
        elements.colorPrompt.textContent = 'Observe bien…';
    }
}

function speak(word) {
    if (!('speechSynthesis' in window)) {
        return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.lang = 'fr-FR';
    window.speechSynthesis.speak(utterance);
}

function selectColorOptions(count) {
    const colorNames = Object.keys(COLOR_LIBRARY);
    const weightedPool = [];
    colorNames.forEach((color) => {
        const mistakes = GameState.incorrectCounts[color] || 0;
        const weight = Math.min(4, 1 + mistakes);
        for (let i = 0; i < weight; i += 1) {
            weightedPool.push(color);
        }
    });
    const uniqueOptions = new Set();
    while (uniqueOptions.size < count && weightedPool.length) {
        const randomIndex = Math.floor(Math.random() * weightedPool.length);
        const [color] = weightedPool.splice(randomIndex, 1);
        uniqueOptions.add(color);
    }
    // If we didn't get enough unique colors (e.g., small pool), fill randomly
    while (uniqueOptions.size < count) {
        const color = colorNames[Math.floor(Math.random() * colorNames.length)];
        uniqueOptions.add(color);
    }
    return Array.from(uniqueOptions);
}

function chooseTargetColor(options) {
    const reviewCandidates = options
        .map((color) => ({ color, mistakes: GameState.incorrectCounts[color] || 0 }))
        .filter(({ mistakes }) => mistakes > 0)
        .sort((a, b) => b.mistakes - a.mistakes);
    if (reviewCandidates.length && Math.random() < 0.7) {
        return reviewCandidates[0].color;
    }
    return options[Math.floor(Math.random() * options.length)];
}

function buildMemorySequence(options, length) {
    const sequence = [];
    while (sequence.length < length) {
        const color = options[Math.floor(Math.random() * options.length)];
        if (sequence.length === 0 || sequence[sequence.length - 1] !== color) {
            sequence.push(color);
        }
    }
    return sequence;
}

function registerMistake(colorName) {
    GameState.mistakes += 1;
    if (colorName) {
        GameState.incorrectCounts[colorName] = (GameState.incorrectCounts[colorName] || 0) + 1;
    }
    GameState.score = Math.max(0, GameState.score - 2);
    updateScoreDisplay();
    showToast('Essaie encore !');
}

function completeLevel() {
    clearTimer();
    const durationMs = Date.now() - GameState.levelStartTime;
    const stars = calculateStars(GameState.mistakes);
    const scoreGain = Math.max(20, GameState.currentConfig.rounds * 15 - GameState.mistakes * 5);
    GameState.score += scoreGain;
    updateScoreDisplay();

    const levelIndex = GameState.currentLevel - 1;
    const previousStars = GameState.progress[levelIndex].stars;
    GameState.progress[levelIndex] = {
        stars: Math.max(previousStars, stars),
        bestScore: Math.max(GameState.progress[levelIndex].bestScore, scoreGain)
    };
    if (GameState.currentLevel === GameState.highestUnlocked && GameState.currentLevel < LEVELS.length) {
        GameState.highestUnlocked += 1;
    }
    GameState.save();
    showLevelCompleteScreen({ stars, scoreGain, durationMs });
}

function calculateStars(mistakes) {
    if (mistakes === 0) {
        return 3;
    }
    if (mistakes === 1) {
        return 2;
    }
    return 1;
}

function showLevelCompleteScreen({ stars, scoreGain, durationMs }) {
    const seconds = Math.round(durationMs / 1000);
    elements.levelCompleteTitle.textContent = `Bravo ${GameState.playerName} !`;
    elements.starContainer.innerHTML = renderStars(stars);
    elements.levelStats.textContent = `+${scoreGain} points · ${seconds}s · ${GameState.mistakes} erreur(s)`;

    if (GameState.currentLevel >= LEVELS.length) {
        elements.nextLevelButton.textContent = 'Retour à la carte';
    } else {
        elements.nextLevelButton.textContent = `Niveau ${GameState.currentLevel + 1}`;
    }

    showScreen('level-complete-screen');
}

function renderStars(count) {
    return Array.from({ length: 3 }, (_, index) => (index < count ? '★' : '☆')).join(' ');
}

function updateScoreDisplay() {
    elements.scoreDisplay.textContent = `Score : ${GameState.score}`;
}

function startLevelTimer(limitMs) {
    clearTimer();
    elements.timerDisplay.classList.remove('hidden');
    const endTime = Date.now() + limitMs;
    elements.timerDisplay.textContent = `${Math.ceil(limitMs / 1000)}s`;
    GameState.modeState.timerInterval = setInterval(() => {
        const remaining = Math.max(0, endTime - Date.now());
        const seconds = Math.ceil(remaining / 1000);
        elements.timerDisplay.textContent = `${seconds}s`;
        if (remaining <= 0) {
            registerMistake();
            clearTimer();
            showToast('Temps écoulé !');
            setupColorMatchLevel();
        }
    }, 500);
}

function clearTimer() {
    elements.timerDisplay.classList.add('hidden');
    if (GameState.modeState.timerInterval) {
        clearInterval(GameState.modeState.timerInterval);
        GameState.modeState.timerInterval = null;
    }
}

function toggleSettings() {
    const isHidden = elements.settingsPanel.classList.contains('hidden');
    if (isHidden) {
        elements.settingsPanel.classList.remove('hidden');
        elements.settingsPanel.setAttribute('aria-hidden', 'false');
        elements.settingsButton.setAttribute('aria-expanded', 'true');
    } else {
        hideSettings();
    }
}

function hideSettings() {
    elements.settingsPanel.classList.add('hidden');
    elements.settingsPanel.setAttribute('aria-hidden', 'true');
    elements.settingsButton.setAttribute('aria-expanded', 'false');
}

function updateSettingsUI() {
    if (elements.speechToggle) {
        elements.speechToggle.checked = GameState.settings.speechEnabled;
    }
}

function formatColorName(colorName) {
    if (!colorName) {
        return '';
    }
    return colorName.charAt(0).toUpperCase() + colorName.slice(1);
}

function showToast(message) {
    if (!elements.toast) {
        return;
    }
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    setTimeout(() => {
        elements.toast.classList.remove('visible');
    }, 1200);
}
