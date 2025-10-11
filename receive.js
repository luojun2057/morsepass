// =============== 配置 ===============
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

const charToMorse = {};
for (const [morse, char] of Object.entries(morseToChar)) {
  charToMorse[char] = morse;
}
charToMorse[' '] = ' '; // 单词间隔

let audioContext = null;
let isPlaying = false;
let playAbortController = null; // 用于停止播放

// =============== DOM ===============
const wpmSlider = document.getElementById('wpm-slider');
const wpmValueEl = document.getElementById('wpm-value');
const frequencyInput = document.getElementById('frequency-input');
const sourceText = document.getElementById('source-text');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const userInput = document.getElementById('user-input');
const comparisonOutput = document.getElementById('comparison-output');
const accuracyRateEl = document.getElementById('accuracy-rate');
const backBtn = document.getElementById('back-btn');

// =============== 初始化 ===============
function init() {
  wpmSlider.addEventListener('input', (e) => {
    wpmValueEl.textContent = e.target.value;
  });
  
  frequencyInput.addEventListener('change', (e) => {
    let freq = parseInt(e.target.value);
    if (freq < 350) freq = 350;
    if (freq > 800) freq = 800;
    frequencyInput.value = freq;
  });
  
  playBtn.addEventListener('click', playMorse);
  stopBtn.addEventListener('click', stopPlayback);
  userInput.addEventListener('input', checkAnswer);
  backBtn.addEventListener('click', () => window.location.href = 'index.html');
}

// =============== 播放控制 ===============
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

async function playMorse() {
  if (isPlaying) return;
  isPlaying = true;
  playBtn.disabled = true;
  stopBtn.disabled = false;
  
  const text = sourceText.value.toUpperCase().trim();
  if (!text) {
    alert("请输入原文！");
    resetPlayback();
    return;
  }
  
  const wpm = parseInt(wpmSlider.value);
  const D = wpmToDitDuration(wpm);
  const freq = parseInt(frequencyInput.value);
  
  // 重置输入框
  userInput.value = '';
  comparisonOutput.innerHTML = '';
  accuracyRateEl.textContent = '-';
  
  try {
    // 播放每个字符
    for (let i = 0; i < text.length; i++) {
      if (!isPlaying) break; // 被停止则退出
      
      const char = text[i];
      if (char === ' ') {
        await new Promise(resolve => setTimeout(resolve, 7 * D));
      } else if (charToMorse[char]) {
        const morse = charToMorse[char];
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
  } finally {
    resetPlayback();
  }
}

function stopPlayback() {
  isPlaying = false;
}

function resetPlayback() {
  isPlaying = false;
  playBtn.disabled = false;
  stopBtn.disabled = true;
}

// =============== 顺序单向匹配（LCWO 风格）===============
function normalizeChar(c) {
  // 仅标准化单个字符（用于比对）
  const upper = c.toUpperCase();
  return /^[A-Z0-9\s]$/.test(upper) ? upper : null;
}

function checkAnswer() {
  const sourceRaw = sourceText.value;
  const userRaw = userInput.value;

  if (!sourceRaw.trim()) {
    comparisonOutput.innerHTML = '';
    accuracyRateEl.textContent = '-';
    return;
  }

  // 提取有效字符序列（保留原始索引）
  const sourceChars = [];
  for (let i = 0; i < sourceRaw.length; i++) {
    const norm = normalizeChar(sourceRaw[i]);
    if (norm !== null) {
      sourceChars.push({
        char: sourceRaw[i], // 原始字符（保留大小写）
        norm: norm          // 标准化字符（用于比对）
      });
    }
  }

  const userChars = [];
  for (let i = 0; i < userRaw.length; i++) {
    const norm = normalizeChar(userRaw[i]);
    if (norm !== null) {
      userChars.push({
        char: userRaw[i],
        norm: norm
      });
    }
  }

  if (sourceChars.length === 0) {
    comparisonOutput.innerHTML = '<span style="color:red;">原文无效</span>';
    accuracyRateEl.textContent = '0';
    return;
  }

  // 顺序单向匹配
  const matched = new Array(sourceChars.length).fill(false);
  let srcIndex = 0;
  let correctCount = 0;

  for (let userIndex = 0; userIndex < userChars.length; userIndex++) {
    const u = userChars[userIndex];
    // 从当前 srcIndex 开始向后查找匹配
    while (srcIndex < sourceChars.length && sourceChars[srcIndex].norm !== u.norm) {
      srcIndex++;
    }
    if (srcIndex < sourceChars.length) {
      // 匹配成功
      matched[srcIndex] = true;
      correctCount++;
      srcIndex++; // 移动到下一个位置（不可回溯）
    }
    // 若未找到，用户字符视为多余（不标记原文）
  }

  // 构建可视化输出
  let html = '';
  for (let i = 0; i < sourceChars.length; i++) {
    if (matched[i]) {
      const c = sourceChars[i].char;
      if (c === ' ') {
        html += '<span style="color:green;">␣</span>';
      } else {
        html += `<span style="color:green;">${c}</span>`;
      }
    } else {
      html += '<span style="color:red;">-</span>';
    }
  }

  // 处理用户多余输入
  const extraCount = userChars.length - correctCount;
  if (extraCount > 0) {
    html += ` <span style="color:orange;">[+${extraCount}]</span>`;
  }

  const accuracy = Math.round((correctCount / sourceChars.length) * 100);
  comparisonOutput.innerHTML = html;
  accuracyRateEl.textContent = accuracy;
}
// =============== 启动 ===============
window.addEventListener('load', init);