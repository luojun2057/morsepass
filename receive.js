// =============== 配置（复用 script.txt） ===============
const MAX_HISTORY_MS = 15000;
const DEFAULT_WPM = 20;
const DEFAULT_TOLERANCE = 25;
const DEFAULT_FREQUENCY = 600;
const DEFAULT_KEY = 'Space';

// =============== 状态（复用 script.txt） ===============
let currentWPM = DEFAULT_WPM;
let tolerancePercent = DEFAULT_TOLERANCE;
let audioFrequency = DEFAULT_FREQUENCY;
let inputKeyCode = DEFAULT_KEY;
let signals = []; // 跟发模式用
let decodedText = ""; // 跟发模式用
let currentSequence = ""; // 跟发模式用
let lastSignalEnd = null; // 跟发模式用
let gapTimer = null; // 跟发模式用
let isPlaying = false; // 播放状态
let inputMode = 'keyboard'; // 'keyboard' or 'transmit'

// ====== 音频控制（复用 script.txt） ======
let audioContext = null;
let currentOscillator = null;
let currentGainNode = null;

// =============== 摩尔斯码字典（复用 script.txt） ===============
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

// =============== DOM 元素（仅听抄页面） ===============
let canvas, ctx;
const wpmSlider = document.getElementById('wpm-slider');
const wpmValueEl = document.getElementById('wpm-value');
const toleranceSlider = document.getElementById('tolerance-slider');
const toleranceValueEl = document.getElementById('tolerance-value');
const frequencyInput = document.getElementById('frequency-input');
const setKeyBtn = document.getElementById('set-key-btn');
const sourceText = document.getElementById('source-text');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const backBtn = document.getElementById('back-btn');
const userInput = document.getElementById('user-input');
const transmitArea = document.getElementById('transmit-area');
const decodedOutput = document.getElementById('decoded-output');
const sequenceOutput = document.getElementById('sequence-output');
const comparisonOutput = document.getElementById('comparison-output');
const accuracyRateEl = document.getElementById('accuracy-rate');
const keyboardSection = document.getElementById('keyboard-input-section');
const transmitSection = document.getElementById('transmit-section');

// =============== 初始化 ===============
function init() {
  canvas = document.getElementById('timeline-canvas');
  ctx = canvas.getContext('2d');
  
  if (canvas && ctx) {
    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
  }
  
  // 绑定所有控件（确保每个都有事件）
  if (wpmSlider) {
    wpmSlider.addEventListener('input', (e) => {
      currentWPM = parseInt(e.target.value);
      if (wpmValueEl) wpmValueEl.textContent = currentWPM;
      // 无需重绘，除非在跟发模式
      if (inputMode === 'transmit') redrawTimeline();
    });
  }
  
  if (toleranceSlider) {
    toleranceSlider.addEventListener('input', (e) => {
      tolerancePercent = parseInt(e.target.value);
      if (toleranceValueEl) toleranceValueEl.textContent = tolerancePercent;
      if (inputMode === 'transmit') redrawTimeline();
    });
  }
  
  if (frequencyInput) {
    frequencyInput.addEventListener('change', (e) => {
      let freq = parseInt(e.target.value);
      if (freq < 350) freq = 350;
      if (freq > 800) freq = 800;
      audioFrequency = freq;
      frequencyInput.value = freq;
    });
  }
  
  if (setKeyBtn) {
    setKeyBtn.addEventListener('click', startKeyCapture);
  }
  
  // 模式切换
  const modeRadios = document.querySelectorAll('input[name="input-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      inputMode = e.target.value;
      if (inputMode === 'keyboard') {
        if (keyboardSection) keyboardSection.style.display = 'block';
        if (transmitSection) transmitSection.style.display = 'none';
      } else {
        if (keyboardSection) keyboardSection.style.display = 'none';
        if (transmitSection) transmitSection.style.display = 'block';
        // 重置跟发状态
        resetTransmitState();
      }
      comparisonOutput.innerHTML = '';
      accuracyRateEl.textContent = '-';
    });
  });
  
  if (playBtn) playBtn.addEventListener('click', startPlayback);
  if (stopBtn) stopBtn.addEventListener('click', stopPlayback);
  if (backBtn) backBtn.addEventListener('click', () => window.location.href = 'index.html');
  if (userInput) userInput.addEventListener('input', checkAnswer);
}

function updateCanvasSize() {
  if (!canvas) return;
  const container = canvas.parentElement;
  canvas.width = Math.max(container.clientWidth, 800);
  canvas.height = 60;
  if (inputMode === 'transmit') redrawTimeline();
}

// =============== 播放控制（复用 script.txt 逻辑） ===============
function wpmToDitDuration(wpm) {
  return 1200 / wpm;
}

function playTone(durationMs, frequency) {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  gainNode.gain.value = 0.3;
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + durationMs / 1000);
  return new Promise(resolve => setTimeout(resolve, durationMs));
}

async function playMorse(text) {
  const D = wpmToDitDuration(currentWPM);
  const freq = audioFrequency;
  for (let i = 0; i < text.length; i++) {
    if (!isPlaying) break;
    const char = text[i];
    if (char === ' ') {
      await new Promise(resolve => setTimeout(resolve, 7 * D));
    } else if (morseToChar[char]) {
      const morse = morseToChar[char];
      for (let j = 0; j < morse.length; j++) {
        if (!isPlaying) break;
        if (j > 0) await new Promise(resolve => setTimeout(resolve, D));
        const isDot = morse[j] === '.';
        const duration = isDot ? D : 3 * D;
        await playTone(duration, freq);
      }
      if (isPlaying) await new Promise(resolve => setTimeout(resolve, 3 * D));
    }
  }
}

function startPlayback() {
  if (isPlaying) return;
  const text = sourceText.value; // 不转大写，保留空格
  if (!text.trim()) {
    alert("请输入原文！");
    return;
  }
  
  isPlaying = true;
  if (playBtn) playBtn.disabled = true;
  if (stopBtn) stopBtn.disabled = false;
  
  comparisonOutput.innerHTML = '';
  accuracyRateEl.textContent = '-';
  
  // 重置跟发状态（如果在跟发模式）
  if (inputMode === 'transmit') {
    resetTransmitState();
  }
  
  playMorse(text).finally(() => {
    isPlaying = false;
    if (playBtn) playBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
  });
}

function stopPlayback() {
  isPlaying = false;
  if (playBtn) playBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;
}

// =============== 按键捕获（复用 script.txt 逻辑） ===============
function startKeyCapture() {
  alert("请在弹出的提示框中按下任意键来设置...");
  const captureKey = (e) => {
    e.preventDefault();
    inputKeyCode = e.code;
    alert(`按键已设置为: ${e.code}`);
    window.removeEventListener('keydown', captureKey);
  };
  window.addEventListener('keydown', captureKey, { once: true });
}

// =============== 跟发逻辑（复用 script.txt 逻辑） ===============
function resetTransmitState() {
  signals = [];
  decodedText = "";
  currentSequence = "";
  lastSignalEnd = null;
  if (gapTimer) {
    clearTimeout(gapTimer);
    gapTimer = null;
  }
  if (decodedOutput) decodedOutput.textContent = "-";
  if (sequenceOutput) sequenceOutput.textContent = "-";
  if (inputMode === 'transmit') redrawTimeline();
}

function enableTransmitArea() {
  let isSignalActive = false;
  let signalStartTime = 0;
  
  function startSignal() {
    if (!isPlaying || isSignalActive) return; // 播放时才可发报
    isSignalActive = true;
    signalStartTime = performance.now();
    startSignalSound();
  }
  
  function endSignal() {
    if (!isSignalActive) return;
    isSignalActive = false;
    stopSignalSound();
    const duration = performance.now() - signalStartTime;
    processSignal(duration);
  }
  
  if (transmitArea) {
    transmitArea.addEventListener('mousedown', startSignal);
    transmitArea.addEventListener('mouseup', endSignal);
    transmitArea.addEventListener('mouseleave', endSignal);
  }
  
  window.addEventListener('keydown', (e) => {
    if (e.code === inputKeyCode) {
      e.preventDefault();
      startSignal();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    if (e.code === inputKeyCode) {
      e.preventDefault();
      endSignal();
    }
  });
}

// =============== 音频函数（复用 script.txt 逻辑） ===============
function startSignalSound() {
  if (!isPlaying) return; // 仅在播放时发声
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  stopSignalSound();
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = audioFrequency;
  gainNode.gain.value = 0.3;
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

// =============== 核心发报逻辑（复用 script.txt 逻辑） ===============
function processSignal(duration) {
  if (gapTimer) {
    clearTimeout(gapTimer);
    gapTimer = null;
  }
  
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
      if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char + " "; // 7D间隔：添加单词空格
        currentSequence = "";
      }
    } else if (gap >= 3 * D) {
      if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char; // 3D间隔：仅添加字符
        currentSequence = "";
      }
    }
  }
  
  currentSequence += (type === 'dot' ? '.' : '-');
  
  signals.push({
    type,
    start: now - duration,
    duration,
    accurate,
    deviation,
    ideal
  });
  
  lastSignalEnd = signalEnd;
  
  // 启动7D间隔定时器（+20%容差避免精度问题）
  const timeoutDuration = 7 * D * 1.2;
  gapTimer = setTimeout(() => {
    if (currentSequence) {
      const char = morseToChar[currentSequence] || '?';
      decodedText += char + " "; // 超时视为单词间隔
      currentSequence = "";
      updateDisplay();
      checkAnswer(); // 实时比对
      redrawTimeline();
    }
    gapTimer = null;
  }, timeoutDuration);
  
  const cutoff = now - MAX_HISTORY_MS;
  signals = signals.filter(s => s.start + s.duration >= cutoff);
  
  updateDisplay();
  checkAnswer(); // 实时比对
  redrawTimeline();
}

function updateDisplay() {
  const displayText = decodedText + (currentSequence ? '?' : '');
  if (decodedOutput) decodedOutput.textContent = displayText || "-";
  if (sequenceOutput) sequenceOutput.textContent = currentSequence || "-";
}

function redrawTimeline() {
  if (!ctx || inputMode !== 'transmit') return;
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

// =============== 比对逻辑（修复空格） ===============
function normalizeChar(c) {
  if (c === ' ') return ' '; // 明确允许空格
  const upper = c.toUpperCase();
  return /^[A-Z0-9]$/.test(upper) ? upper : null;
}

function checkAnswer() {
  let userRaw = '';
  if (inputMode === 'keyboard') {
    userRaw = userInput.value;
  } else {
    userRaw = decodedText + (currentSequence ? '?' : '');
  }
  
  const sourceRaw = sourceText.value;
  if (!sourceRaw.trim()) return;
  
  // 提取有效字符（保留空格）
  const sourceChars = [];
  for (let i = 0; i < sourceRaw.length; i++) {
    const norm = normalizeChar(sourceRaw[i]);
    if (norm !== null) {
      sourceChars.push({ char: sourceRaw[i], norm: norm });
    }
  }
  
  const userChars = [];
  for (let i = 0; i < userRaw.length; i++) {
    const norm = normalizeChar(userRaw[i]);
    if (norm !== null) {
      userChars.push({ char: userRaw[i], norm: norm });
    }
  }
  
  if (sourceChars.length === 0) return;
  
  // 顺序单向匹配
  const matched = new Array(sourceChars.length).fill(false);
  let srcIndex = 0;
  let correctCount = 0;
  
  for (let userIndex = 0; userIndex < userChars.length; userIndex++) {
    const u = userChars[userIndex];
    while (srcIndex < sourceChars.length && sourceChars[srcIndex].norm !== u.norm) {
      srcIndex++;
    }
    if (srcIndex < sourceChars.length) {
      matched[srcIndex] = true;
      correctCount++;
      srcIndex++;
    }
  }
  
  // 构建可视化
  let html = '';
  for (let i = 0; i < sourceChars.length; i++) {
    if (matched[i]) {
      const c = sourceChars[i].char;
      html += c === ' ' ? '<span style="color:green;">␣</span>' : `<span style="color:green;">${c}</span>`;
    } else {
      html += '<span style="color:red;">-</span>';
    }
  }
  
  const extraCount = userChars.length - correctCount;
  if (extraCount > 0) {
    html += ` <span style="color:orange;">[+${extraCount}]</span>`;
  }
  
  const accuracy = Math.round((correctCount / sourceChars.length) * 100);
  if (comparisonOutput) comparisonOutput.innerHTML = html;
  if (accuracyRateEl) accuracyRateEl.textContent = accuracy;
}

// =============== 启动 ===============
window.addEventListener('load', init);