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

// =============== 比对逻辑（严格字符对齐 + 简化显示）===============
function normalizeText(text) {
  return text.toUpperCase().replace(/[^A-Z0-9\s]/g, '');
}

function checkAnswer() {
  const sourceRaw = sourceText.value;
  const userRaw = userInput.value;
  
  if (!sourceRaw.trim()) {
    comparisonOutput.innerHTML = '';
    accuracyRateEl.textContent = '-';
    return;
  }
  
  const source = normalizeText(sourceRaw);
  const user = normalizeText(userRaw);
  
  if (!source) {
    comparisonOutput.innerHTML = '<span style="color:red;">原文无效</span>';
    accuracyRateEl.textContent = '0';
    return;
  }
  
  // 只比对到用户输入的长度
  const compareLength = Math.min(source.length, user.length);
  let correctCount = 0;
  let html = '';
  
  // 显示用户已输入部分
  for (let i = 0; i < compareLength; i++) {
    const sChar = source[i];
    const uChar = user[i];
    
    if (sChar === uChar) {
      if (sChar === ' ') {
        html += '<span style="color:green;">␣</span>';
      } else {
        html += `<span style="color:green;">${uChar}</span>`;
      }
      correctCount++;
    } else {
      // 错抄：直接显示红色用户字符
      if (uChar === ' ') {
        html += '<span style="color:red;">␣</span>';
      } else {
        html += `<span style="color:red;">${uChar}</span>`;
      }
    }
  }
  
  // 显示用户未输入但原文存在的部分（漏抄）
  for (let i = compareLength; i < source.length; i++) {
    html += '<span style="color:red;">-</span>';
  }
  
  // 正确率 = 正确数 / 原文总长度
  const accuracy = source.length > 0 ? Math.round((correctCount / source.length) * 100) : 0;
  
  comparisonOutput.innerHTML = html;
  accuracyRateEl.textContent = accuracy;
}

// =============== 启动 ===============
window.addEventListener('load', init);