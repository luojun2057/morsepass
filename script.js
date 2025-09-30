// =============== 配置 ===============
const MAX_HISTORY_MS = 15000;
const MAX_HISTORY_ITEMS = 5;
const DEFAULT_WPM = 20;
const DEFAULT_TOLERANCE = 25;
const DEFAULT_FREQUENCY = 600;

// =============== 状态 ===============
let currentWPM = DEFAULT_WPM;
let tolerancePercent = DEFAULT_TOLERANCE;
let audioFrequency = DEFAULT_FREQUENCY;
let signals = [];
let decodedText = "";
let lastSignalEnd = null;
let historyItems = [];
let currentHistoryIndex = -1; // -1 = 实时模式

// ====== 音频控制 ======
let audioContext = null;
let currentOscillator = null;
let currentGainNode = null;

// =============== 摩尔斯码字典 ===============
const morseToChar = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z',
  '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9',
  '.-.-.-': '.', '--..--': ',', '..--..': '?', '.----.': "'", '-.-.--': '!',
  '-..-.': '/', '-.--.': '(', '-.--.-': ')', '.-...': '&', '---...': ':',
  '-.-.-.': ';', '-...-': '=', '.-.-.': '+', '-....-': '-', '..--.-': '_',
  '.-..-.': '"', '...-..-': '$', '.--.-.': '@'
};

// =============== DOM 元素 ===============
const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const decodedOutput = document.getElementById('decoded-output');
const sequenceOutput = document.getElementById('sequence-output');
const ditDurationEl = document.getElementById('dit-duration');
const wpmSlider = document.getElementById('wpm-slider');
const wpmValueEl = document.getElementById('wpm-value');
const toleranceSlider = document.getElementById('tolerance-slider');
const toleranceValueEl = document.getElementById('tolerance-value');
const frequencyInput = document.getElementById('frequency-input');
const audioEnabledCheckbox = document.getElementById('audio-enabled');
const clearBtn = document.getElementById('clear-btn');
const morseButton = document.getElementById('morse-button');
const realWpmEl = document.getElementById('real-wpm');
const accuracyEl = document.getElementById('accuracy');
const historyListEl = document.getElementById('history-list');
const errorSummaryEl = document.getElementById('error-summary');

// =============== 音频函数 ===============
function startSignalSound() {
  const audioEnabled = audioEnabledCheckbox.checked;
  if (!audioEnabled) return;
  
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  // 停止残留声音
  stopSignalSound();
  
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  
  oscillator.type = 'sine';
  oscillator.frequency.value = audioFrequency;
  gainNode.gain.value = 0.3; // 恒定音量，无淡出
  
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  
  currentOscillator = oscillator;
  currentGainNode = gainNode;
}

function stopSignalSound() {
  if (currentOscillator) {
    currentOscillator.stop();
    currentOscillator = null;
    currentGainNode = null;
  }
}

// =============== 初始化 ===============
function init() {
  updateDitDisplay();
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  setupInputListeners();
  
  // 控件绑定
  wpmSlider.addEventListener('input', (e) => {
    currentWPM = parseInt(e.target.value);
    wpmValueEl.textContent = currentWPM;
    updateDitDisplay();
    if (currentHistoryIndex === -1) redrawTimeline();
  });
  
  toleranceSlider.addEventListener('input', (e) => {
    tolerancePercent = parseInt(e.target.value);
    toleranceValueEl.textContent = tolerancePercent;
    if (currentHistoryIndex === -1) redrawTimeline();
  });
  
  frequencyInput.addEventListener('change', (e) => {
    let freq = parseInt(e.target.value);
    if (freq < 350) freq = 350;
    if (freq > 800) freq = 800;
    audioFrequency = freq;
    frequencyInput.value = freq;
  });
  
  audioEnabledCheckbox.addEventListener('change', () => {
    if (!audioEnabledCheckbox.checked) {
      stopSignalSound();
    }
  });
  
  clearBtn.addEventListener('click', clearAll);
  
  redrawTimeline();
  updateDisplay();
  updateStats();
}

function updateDitDisplay() {
  const d = wpmToDitDuration(currentWPM);
  ditDurationEl.textContent = Math.round(d);
}

function updateCanvasSize() {
  const container = canvas.parentElement;
  canvas.width = Math.max(container.clientWidth, 800);
  canvas.height = 60;
  redrawTimeline();
}

function setupInputListeners() {
  let isSignalActive = false;
  let signalStartTime = 0;

  function startSignal() {
    if (isSignalActive || currentHistoryIndex !== -1) return;
    isSignalActive = true;
    signalStartTime = performance.now();
    startSignalSound(); // 启动声音
  }

  function endSignal() {
    if (!isSignalActive) return;
    isSignalActive = false;
    stopSignalSound(); // 停止声音
    
    const duration = performance.now() - signalStartTime;
    processSignal(duration);
  }

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      e.preventDefault();
      startSignal();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      endSignal();
    }
  });

  morseButton.addEventListener('mousedown', startSignal);
  morseButton.addEventListener('mouseup', endSignal);
  morseButton.addEventListener('mouseleave', endSignal);
  morseButton.addEventListener('touchstart', (e) => { e.preventDefault(); startSignal(); });
  morseButton.addEventListener('touchend', (e) => { e.preventDefault(); endSignal(); });
}

// =============== 核心逻辑 ===============
function wpmToDitDuration(wpm) {
  return 1200 / wpm;
}

function processSignal(duration) {
  const D = wpmToDitDuration(currentWPM);
  const isDot = duration < D * 2;
  const type = isDot ? 'dot' : 'dash';
  
  const tolerance = tolerancePercent / 100;
  const ideal = type === 'dot' ? D : 3 * D;
  const deviation = Math.abs(duration - ideal) / ideal;
  const accurate = deviation <= tolerance;

  const now = performance.now();
  const signalEnd = now;
  
  let gap = 0;
  if (lastSignalEnd !== null) {
    gap = now - duration - lastSignalEnd;
  }
  
  if (lastSignalEnd !== null) {
    if (gap >= 7 * D) {
      decodedText += " ";
    } else if (gap >= 3 * D) {
      const lastChar = decodeCurrentCharacter();
      if (lastChar) decodedText += lastChar;
    }
  }

  signals.push({
    type,
    start: now - duration,
    duration,
    accurate,
    deviation,
    ideal
  });

  lastSignalEnd = signalEnd;

  const cutoff = now - MAX_HISTORY_MS;
  signals = signals.filter(s => s.start + s.duration >= cutoff);

  updateDisplay();
  updateStats();
  redrawTimeline();
}

function decodeCurrentCharacter() {
  const D = wpmToDitDuration(currentWPM);
  let seq = "";
  let lastEnd = lastSignalEnd;

  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i];
    const gap = lastEnd - (s.start + s.duration);
    if (gap > 3 * D) break;
    seq = (s.type === 'dot' ? '.' : '-') + seq;
    lastEnd = s.start;
  }

  return morseToChar[seq] || (seq ? '?' : '');
}

function updateDisplay() {
  const lastChar = decodeCurrentCharacter();
  let fullText = decodedText;
  if (lastChar && lastChar !== '?') {
    if (fullText.endsWith(lastChar)) {
      fullText = fullText.slice(0, -1);
    }
    fullText += lastChar;
  } else if (lastChar === '?') {
    fullText += '?';
  }

  decodedOutput.textContent = fullText || "-";
  sequenceOutput.textContent = buildCurrentSequence();
}

function buildCurrentSequence() {
  const D = wpmToDitDuration(currentWPM);
  let seq = "";
  let lastEnd = lastSignalEnd;
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i];
    const gap = lastEnd - (s.start + s.duration);
    if (gap > 3 * D) break;
    seq = (s.type === 'dot' ? '.' : '-') + seq;
    lastEnd = s.start;
  }
  return seq || "-";
}

function updateStats() {
  if (signals.length === 0) {
    realWpmEl.textContent = "-";
    accuracyEl.textContent = "-";
    errorSummaryEl.textContent = "-";
    return;
  }

  const now = performance.now();
  const recentSignals = signals.filter(s => s.start > now - 5000);
  if (recentSignals.length === 0) {
    realWpmEl.textContent = "-";
    accuracyEl.textContent = "-";
  } else {
    const totalTime = recentSignals.reduce((sum, s) => sum + s.duration, 0);
    const estimatedWPM = totalTime > 0 ? (1200 * recentSignals.length) / totalTime : 0;
    realWpmEl.textContent = Math.round(estimatedWPM * 10) / 10;

    const accurateCount = recentSignals.filter(s => s.accurate).length;
    const accuracy = recentSignals.length > 0 ? Math.round((accurateCount / recentSignals.length) * 100) : 0;
    accuracyEl.textContent = accuracy;
  }

  // 错误分析
  const errors = [];
  const tolerance = tolerancePercent / 100;
  const D = wpmToDitDuration(currentWPM);
  
  for (const s of signals.slice(-10)) {
    if (!s.accurate) {
      if (s.type === 'dot' && s.duration > s.ideal * (1 + tolerance)) {
        errors.push("点过长");
      } else if (s.type === 'dash' && s.duration < s.ideal * (1 - tolerance)) {
        errors.push("划过短");
      }
    }
  }
  
  for (let i = 1; i < signals.length; i++) {
    const gap = signals[i].start - (signals[i-1].start + signals[i-1].duration);
    if (gap < 3 * D && gap > 0.5 * D) {
      errors.push("字符间隔不足");
      break;
    }
  }

  errorSummaryEl.textContent = errors.length > 0 ? errors.join("\n") : "无明显错误";
}

function redrawTimeline() {
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  ctx.clearRect(0, 0, width, height);
  
  if (signals.length === 0) return;

  const now = performance.now();
  const startTime = now - MAX_HISTORY_MS;
  const pixelsPerMs = width / MAX_HISTORY_MS;

  for (const sig of signals) {
    const x = (sig.start - startTime) * pixelsPerMs;
    const w = sig.duration * pixelsPerMs;
    if (w < 1) continue;

    ctx.fillStyle = sig.accurate ? '#10b981' : '#ef4444';
    ctx.fillRect(x, 10, w, height - 20);
  }
}

function clearAll() {
  signals = [];
  decodedText = "";
  lastSignalEnd = null;
  currentHistoryIndex = -1;
  redrawTimeline();
  updateDisplay();
  updateStats();
  renderHistory();
}

// =============== 历史记录 ===============
function saveToHistory() {
  if (decodedText.trim() === "" && buildCurrentSequence() === "-") return;
  
  const fullText = decodedOutput.textContent;
  const sequence = buildCurrentSequence();
  const item = {
    text: fullText,
    sequence: sequence,
    signals: JSON.parse(JSON.stringify(signals)),
    wpm: currentWPM,
    tolerance: tolerancePercent
  };
  
  historyItems.unshift(item);
  if (historyItems.length > MAX_HISTORY_ITEMS) {
    historyItems.pop();
  }
  renderHistory();
}

function renderHistory() {
  historyListEl.innerHTML = '';
  historyItems.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.textContent = `${index + 1}. ${item.text} [${item.sequence}]`;
    div.addEventListener('click', () => loadHistory(index));
    historyListEl.appendChild(div);
  });
}

function loadHistory(index) {
  const item = historyItems[index];
  currentHistoryIndex = index;
  signals = JSON.parse(JSON.stringify(item.signals));
  decodedText = "";
  lastSignalEnd = null;
  
  currentWPM = item.wpm;
  tolerancePercent = item.tolerance;
  wpmSlider.value = currentWPM;
  wpmValueEl.textContent = currentWPM;
  toleranceSlider.value = tolerancePercent;
  toleranceValueEl.textContent = tolerancePercent;
  updateDitDisplay();
  
  updateDisplay();
  updateStats();
  redrawTimeline();
  
  document.querySelectorAll('.history-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

// 自动保存历史
clearBtn.addEventListener('click', () => {
  if (decodedText.trim() !== "" || buildCurrentSequence() !== "-") {
    saveToHistory();
  }
});

// =============== 启动 ===============
window.addEventListener('load', () => {
  init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }
  
  window.addEventListener('beforeunload', () => {
    if (decodedText.trim() !== "" || buildCurrentSequence() !== "-") {
      saveToHistory();
    }
  });
});