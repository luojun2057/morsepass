// =============== 配置 ===============
const MAX_HISTORY_MS = 10000; // 保留最近10秒数据
const MAX_DOTS_FOR_D = 5;     // 用于计算D的点数量
const DEFAULT_D = 200;        // 初始D值 (ms)

// =============== 状态 ===============
let ditDuration = DEFAULT_D;
let tolerancePercent = 20;
let recentDots = [];
let signals = []; // { type: 'dot'|'dash', start: ms, duration: ms, accurate: bool }
let lastReleaseTime = null;
let isCalibrating = false;
let calibrationCount = 0;

// =============== 摩尔斯码字典 ===============
const morseToChar = {
  '.-': 'A', '-...': 'B', '-.-.': 'C', '-..': 'D', '.': 'E',
  '..-.': 'F', '--.': 'G', '....': 'H', '..': 'I', '.---': 'J',
  '-.-': 'K', '.-..': 'L', '--': 'M', '-.': 'N', '---': 'O',
  '.--.': 'P', '--.-': 'Q', '.-.': 'R', '...': 'S', '-': 'T',
  '..-': 'U', '...-': 'V', '.--': 'W', '-..-': 'X', '-.--': 'Y',
  '--..': 'Z',
  '-----': '0', '.----': '1', '..---': '2', '...--': '3', '....-': '4',
  '.....': '5', '-....': '6', '--...': '7', '---..': '8', '----.': '9'
};

// =============== DOM 元素 ===============
const canvas = document.getElementById('timeline-canvas');
const ctx = canvas.getContext('2d');
const decodedOutput = document.getElementById('decoded-output');
const sequenceOutput = document.getElementById('sequence-output');
const ditDurationEl = document.getElementById('dit-duration');
const toleranceSlider = document.getElementById('tolerance-slider');
const toleranceValueEl = document.getElementById('tolerance-value');
const calibrateBtn = document.getElementById('calibrate-btn');
const clearBtn = document.getElementById('clear-btn');
const morseButton = document.getElementById('morse-button');

// =============== 初始化 ===============
function init() {
  updateCanvasSize();
  window.addEventListener('resize', updateCanvasSize);
  
  // 输入监听
  setupInputListeners();
  
  // 设置控件
  toleranceSlider.addEventListener('input', (e) => {
    tolerancePercent = parseInt(e.target.value);
    toleranceValueEl.textContent = tolerancePercent;
    redrawTimeline();
  });
  
  calibrateBtn.addEventListener('click', startCalibration);
  clearBtn.addEventListener('click', clearAll);
  
  // 初始绘制
  redrawTimeline();
  updateDisplay();
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
    if (isSignalActive) return;
    isSignalActive = true;
    signalStartTime = performance.now();
  }

  function endSignal() {
    if (!isSignalActive) return;
    const duration = performance.now() - signalStartTime;
    isSignalActive = false;
    processSignal(duration);
  }

  // 键盘（空格）
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

  // 鼠标/触摸
  morseButton.addEventListener('mousedown', startSignal);
  morseButton.addEventListener('mouseup', endSignal);
  morseButton.addEventListener('mouseleave', endSignal); // 防止鼠标移出未释放

  // 触摸设备（可选）
  morseButton.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startSignal();
  });
  morseButton.addEventListener('touchend', (e) => {
    e.preventDefault();
    endSignal();
  });
}

function processSignal(duration) {
  const now = performance.now();
  
  // 判断是点还是划（临时用当前D）
  const isDot = duration <= ditDuration * 2; // 简化判断
  const type = isDot ? 'dot' : 'dash';
  
  // 校准模式
  if (isCalibrating && type === 'dot') {
    recentDots.push(duration);
    if (recentDots.length > MAX_DOTS_FOR_D) recentDots.shift();
    ditDuration = recentDots.reduce((a, b) => a + b, 0) / recentDots.length;
    calibrationCount++;
    
    if (calibrationCount >= 5) {
      endCalibration();
    }
  }

  // 节奏准确性判断
  const ideal = type === 'dot' ? ditDuration : 3 * ditDuration;
  const deviation = Math.abs(duration - ideal) / ideal;
  const accurate = deviation <= tolerancePercent / 100;

  // 添加信号
  signals.push({
    type,
    start: now - duration,
    duration,
    accurate
  });

  // 清理旧数据
  const cutoff = now - MAX_HISTORY_MS;
  signals = signals.filter(s => s.start + s.duration >= cutoff);

  // 更新显示
  updateDisplay();
  redrawTimeline();
}

function updateDisplay() {
  // 构建摩尔斯序列（最近一个字符）
  let currentSeq = '';
  let lastEnd = signals.length > 0 ? signals[0].start : null;
  
  // 从后往前找最近一个完整字符
  const D = ditDuration;
  for (let i = signals.length - 1; i >= 0; i--) {
    const s = signals[i];
    const gap = lastEnd !== null ? s.start - lastEnd : 0;
    
    if (gap > D * 2.5) break; // 字符间隔
    
    currentSeq = (s.type === 'dot' ? '.' : '-') + currentSeq;
    lastEnd = s.start + s.duration;
  }

  // 解码
  const char = morseToChar[currentSeq] || (currentSeq ? '?' : '');
  
  sequenceOutput.textContent = currentSeq || '-';
  decodedOutput.textContent = char || '-';
  if (char && !char.startsWith('?')) {
    decodedOutput.style.color = '#1e3a8a';
  } else {
    decodedOutput.style.color = '#dc2626';
  }

  ditDurationEl.textContent = Math.round(ditDuration);
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

  // 绘制信号
  for (const sig of signals) {
    const x = (sig.start - startTime) * pixelsPerMs;
    const w = sig.duration * pixelsPerMs;
    
    if (w < 1) continue; // 太小不画
    
    ctx.fillStyle = sig.accurate ? '#10b981' : '#ef4444'; // green/red
    ctx.fillRect(x, 10, w, height - 20);
  }
}

function startCalibration() {
  isCalibrating = true;
  calibrationCount = 0;
  recentDots = [];
  calibrateBtn.textContent = `校准中... (${calibrationCount}/5)`;
  calibrateBtn.disabled = true;
}

function endCalibration() {
  isCalibrating = false;
  calibrateBtn.textContent = '校准（输入5个点）';
  calibrateBtn.disabled = false;
  alert(`校准完成！基准点时长 D = ${Math.round(ditDuration)} ms`);
}

function clearAll() {
  signals = [];
  recentDots = [];
  ditDuration = DEFAULT_D;
  redrawTimeline();
  updateDisplay();
}

// =============== 启动 ===============
window.addEventListener('load', () => {
  init();
  
  // 注册 Service Worker（用于 PWA）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log('SW registered'))
      .catch(err => console.log('SW failed:', err));
  }
});