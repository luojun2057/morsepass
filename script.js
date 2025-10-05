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
let decodedText = ""; // 已确认的文本（不再修改）
let currentSequence = ""; // 当前未完成字符
let lastSignalEnd = null;
let historyItems = [];
let isPracticeMode = false; // 新增：练习模式开关
let inputKeyCode = 'Space'; // 新增：自定义按键
let isSignalActive = false;
let signalStartTime = 0;

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
const keyInput = document.getElementById('key-input');
const setKeyBtn = document.getElementById('set-key-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const realWpmEl = document.getElementById('real-wpm');
const accuracyEl = document.getElementById('accuracy');
const historyListEl = document.getElementById('history-list');
const errorSummaryEl = document.getElementById('error-summary');

// =============== 音频函数 ===============
function startSignalSound() {
  if (!audioEnabledCheckbox.checked || !isPracticeMode) return;
  
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

// =============== 初始化 ===============
function init() {
  updateDitDisplay();
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  
  // 按键设置
  setKeyBtn.addEventListener('click', startKeyCapture);
  
  // 练习模式控制
  startBtn.addEventListener('click', startPractice);
  stopBtn.addEventListener('click', stopPractice);
  
  // 其他控件
  wpmSlider.addEventListener('input', (e) => {
    currentWPM = parseInt(e.target.value);
    wpmValueEl.textContent = currentWPM;
    updateDitDisplay();
    if (!isPracticeMode) redrawTimeline();
  });
  
  toleranceSlider.addEventListener('input', (e) => {
    tolerancePercent = parseInt(e.target.value);
    toleranceValueEl.textContent = tolerancePercent;
    if (!isPracticeMode) redrawTimeline();
  });
  
  frequencyInput.addEventListener('change', (e) => {
    let freq = parseInt(e.target.value);
    if (freq < 350) freq = 350;
    if (freq > 800) freq = 800;
    audioFrequency = freq;
    frequencyInput.value = freq;
  });
  
  audioEnabledCheckbox.addEventListener('change', () => {
    if (!audioEnabledCheckbox.checked) stopSignalSound();
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
  if (!isPracticeMode) redrawTimeline();
}

// =============== 按键捕获 ===============
function startKeyCapture() {
  keyInput.value = "按下任意键...";
  keyInput.style.backgroundColor = "#fef3c7";
  
  const captureKey = (e) => {
    e.preventDefault();
    inputKeyCode = e.code;
    keyInput.value = e.code;
    keyInput.style.backgroundColor = "";
    window.removeEventListener('keydown', captureKey);
  };
  
  window.addEventListener('keydown', captureKey, { once: true });
}

// =============== 练习模式控制 ===============
function startPractice() {
  if (isPracticeMode) return;
  isPracticeMode = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;
  
  // 启用全局输入
  enableGlobalInput();
  decodedOutput.textContent = decodedText || "-";
  sequenceOutput.textContent = currentSequence || "-";
}

function stopPractice() {
  if (!isPracticeMode) return;
  isPracticeMode = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;
  
  // 停止任何正在进行的信号
  if (isSignalActive) {
    isSignalActive = false;
    stopSignalSound();
    const duration = performance.now() - signalStartTime;
    processSignal(duration);
  }
  
  disableGlobalInput();
  saveToHistory(); // 自动保存
}

function enableGlobalInput() {
  // 鼠标点击任意位置
  document.addEventListener('mousedown', globalMouseDown);
  document.addEventListener('mouseup', globalMouseUp);
  document.addEventListener('mouseleave', globalMouseUp);
  
  // 键盘
  window.addEventListener('keydown', globalKeyDown);
  window.addEventListener('keyup', globalKeyUp);
}

function disableGlobalInput() {
  document.removeEventListener('mousedown', globalMouseDown);
  document.removeEventListener('mouseup', globalMouseUp);
  document.removeEventListener('mouseleave', globalMouseUp);
  window.removeEventListener('keydown', globalKeyDown);
  window.removeEventListener('keyup', globalKeyUp);
}

// =============== 全局输入处理 ===============
function globalMouseDown(e) {
  if (!isPracticeMode || isSignalActive) return;
  // 允许所有鼠标按钮
  isSignalActive = true;
  signalStartTime = performance.now();
  startSignalSound();
}

function globalMouseUp(e) {
  if (!isSignalActive) return;
  isSignalActive = false;
  stopSignalSound();
  const duration = performance.now() - signalStartTime;
  processSignal(duration);
}

function globalKeyDown(e) {
  if (!isPracticeMode || isSignalActive || e.code !== inputKeyCode) return;
  e.preventDefault();
  isSignalActive = true;
  signalStartTime = performance.now();
  startSignalSound();
}

function globalKeyUp(e) {
  if (!isSignalActive || e.code !== inputKeyCode) return;
  e.preventDefault();
  isSignalActive = false;
  stopSignalSound();
  const duration = performance.now() - signalStartTime;
  processSignal(duration);
}

// =============== 核心逻辑 ===============
function wpmToDitDuration(wpm) {
  return 1200 / wpm;
}

function processSignal(duration) {
  if (!isPracticeMode) return;
  
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
  
  // ===== 关键修复：字符固化逻辑 =====
  if (lastSignalEnd !== null) {
    if (gap >= 7 * D) {
      // 单词间隔：固化当前字符 + 添加空格
      if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char;
        currentSequence = "";
      }
      decodedText += " ";
    } else if (gap >= 3 * D) {
      // 字符间隔：固化当前字符
      if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char;
        currentSequence = "";
      }
    }
    // gap < 3D: 属于同一字符，追加到 currentSequence
  }
  
  // 追加当前信号到序列
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

  const cutoff = now - MAX_HISTORY_MS;
  signals = signals.filter(s => s.start + s.duration >= cutoff);

  updateDisplay();
  updateStats();
  redrawTimeline();
}

function updateDisplay() {
  // 已确认文本 + 当前序列
  const displayText = decodedText + (currentSequence ? '?' : '');
  decodedOutput.textContent = displayText || "-";
  sequenceOutput.textContent = currentSequence || "-";
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
  if (!ctx || isPracticeMode) return; // 练习时暂不重绘（性能优化）
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
  currentSequence = "";
  lastSignalEnd = null;
  isSignalActive = false;
  stopSignalSound();
  redrawTimeline();
  updateDisplay();
  updateStats();
  renderHistory();
}

// =============== 历史记录 ===============
function saveToHistory() {
  const fullText = decodedText + (currentSequence ? (morseToChar[currentSequence] || '?') : '');
  if (fullText.trim() === "") return;
  
  const item = {
    text: fullText,
    sequence: currentSequence,
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
    div.textContent = `${index + 1}. ${item.text}`;
    div.addEventListener('click', () => loadHistory(index));
    historyListEl.appendChild(div);
  });
}

function loadHistory(index) {
  if (isPracticeMode) return; // 练习中禁止回放
  
  const item = historyItems[index];
  signals = JSON.parse(JSON.stringify(item.signals));
  decodedText = item.text;
  currentSequence = "";
  lastSignalEnd = null;
  
  // 恢复设置
  currentWPM = item.wpm;
  tolerancePercent = item.tolerance;
  wpmSlider.value = currentWPM;
  wpmValueEl.textContent = currentWPM;
  toleranceSlider.value = tolerancePercent;
  toleranceValueEl.textContent = tolerancePercent;
  updateDitDisplay();
  
  decodedOutput.textContent = decodedText || "-";
  sequenceOutput.textContent = "-";
  updateStats();
  redrawTimeline();
  
  document.querySelectorAll('.history-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });
}

// =============== 启动 ===============
window.addEventListener('load', () => {
  init();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }
});