// =============== 配置 ===============
const MAX_HISTORY_MS = 15000;
const DEFAULT_WPM = 20;
const DEFAULT_TOLERANCE = 25;
const DEFAULT_FREQUENCY = 600;
const DEFAULT_KEY = 'Space'; // 新增

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

// =============== 状态 ===============
let currentWPM = DEFAULT_WPM;
let tolerancePercent = DEFAULT_TOLERANCE;
let audioFrequency = DEFAULT_FREQUENCY;
let inputKeyCode = DEFAULT_KEY; // 新增
let isPlaying = false;
let inputMode = 'keyboard';

// ====== 跟发状态 ======
let signals = [];
let decodedText = "";
let currentSequence = "";
let lastSignalEnd = null;
let gapTimer = null;
let audioContext = null;
let currentOscillator = null;
let currentGainNode = null;

// =============== DOM 元素 ===============
let canvas, ctx;
const wpmSlider = document.getElementById('wpm-slider');
const wpmValueEl = document.getElementById('wpm-value');
const toleranceSlider = document.getElementById('tolerance-slider');
const toleranceValueEl = document.getElementById('tolerance-value');
const frequencyInput = document.getElementById('frequency-input');
const setKeyBtn = document.getElementById('set-key-btn'); // 新增
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
  
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  
  // 绑定控件
  wpmSlider.addEventListener('input', (e) => {
    currentWPM = parseInt(e.target.value);
    wpmValueEl.textContent = currentWPM;
  });
  
  toleranceSlider.addEventListener('input', (e) => {
    tolerancePercent = parseInt(e.target.value);
    toleranceValueEl.textContent = tolerancePercent;
    if (inputMode === 'transmit') redrawTimeline();
  });
  
  frequencyInput.addEventListener('change', (e) => {
    let freq = parseInt(e.target.value);
    if (freq < 350) freq = 350;
    if (freq > 800) freq = 800;
    audioFrequency = freq;
    frequencyInput.value = freq;
  });
  
  // ===== 新增：设置按键 =====
  if (setKeyBtn) {
    setKeyBtn.addEventListener('click', startKeyCapture);
  }
  // ========================
  
  // 输入模式切换
  const modeRadios = document.querySelectorAll('input[name="input-mode"]');
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      inputMode = e.target.value;
      if (inputMode === 'keyboard') {
        keyboardSection.style.display = 'block';
        transmitSection.style.display = 'none';
      } else {
        keyboardSection.style.display = 'none';
        transmitSection.style.display = 'block';
        enableTransmitArea();
      }
      resetTransmitState();
      comparisonOutput.innerHTML = '';
      accuracyRateEl.textContent = '-';
    });
  });
  
  playBtn.addEventListener('click', startPlayback);
  stopBtn.addEventListener('click', stopPlayback);
  backBtn.addEventListener('click', () => window.location.href = 'index.html');
  userInput.addEventListener('input', checkAnswer);
}

// =============== 按键捕获（复用主逻辑）==============
function startKeyCapture() {
  const keyInput = document.createElement('input');
  keyInput.style.position = 'absolute';
  keyInput.style.left = '-9999px';
  document.body.appendChild(keyInput);
  keyInput.focus();
  
  keyInput.value = "按下任意键...";
  keyInput.style.backgroundColor = "#fef3c7";
  
  const captureKey = (e) => {
    e.preventDefault();
    inputKeyCode = e.code;
    keyInput.remove();
    alert(`按键已设置为: ${e.code}`);
  };
  
  window.addEventListener('keydown', captureKey, { once: true });
}

// =============== 播放控制（修复声音和按钮）==============
function wpmToDitDuration(wpm) {
  return 1200 / wpm;
}

function playTone(durationMs, frequency) {
  // 确保 audioContext 已初始化
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
  // 初始化音频（触发用户手势后）
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  const D = wpmToDitDuration(currentWPM);
  const freq = audioFrequency;
  for (let i = 0; i < text.length; i++) {
    if (!isPlaying) break;
    const char = text[i].toUpperCase();
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
  
  // 关键修复：启用播放状态 + 按钮
  isPlaying = true;
  playBtn.disabled = true;
  stopBtn.disabled = false; // 修复：停止按钮可点击
  
  comparisonOutput.innerHTML = '';
  accuracyRateEl.textContent = '-';
  
  playMorse(text).finally(() => {
    isPlaying = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
  });
}

function stopPlayback() {
  isPlaying = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
}

// =============== 跟发逻辑（复用主逻辑）==============
function enableTransmitArea() {
  let isSignalActive = false;
  let signalStartTime = 0;
  
  function startSignal() {
    if (!isPlaying || isSignalActive) return;
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
  
  transmitArea.addEventListener('mousedown', startSignal);
  transmitArea.addEventListener('mouseup', endSignal);
  transmitArea.addEventListener('mouseleave', endSignal);
  
  window.addEventListener('keydown', (e) => {
    if (e.code === inputKeyCode) {
      e.preventDefault();
      startSignal();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    if (e.code === inputKeyCode) {
      endSignal();
    }
  });
}

// 音频函数（略，同主逻辑）

// processSignal, redrawTimeline 等（略，同主逻辑）

// =============== 修复空格输入 ===============
function normalizeChar(c) {
  if (c === ' ') return ' '; // 明确允许空格
  const upper = c.toUpperCase();
  return /^[A-Z0-9]$/.test(upper) ? upper : null;
}

// checkAnswer（略，使用上述 normalizeChar）

// =============== 启动 ===============
window.addEventListener('load', init);