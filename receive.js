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

// =============== DOM ===============
const wpmSlider = document.getElementById('wpm-slider');
const wpmValueEl = document.getElementById('wpm-value');
const frequencyInput = document.getElementById('frequency-input');
const sourceText = document.getElementById('source-text');
const playBtn = document.getElementById('play-btn');
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
  userInput.addEventListener('input', checkAnswer);
  backBtn.addEventListener('click', () => window.location.href = 'index.html');
}

// =============== 播放摩尔斯码 ===============
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
  
  const text = sourceText.value.toUpperCase().trim();
  if (!text) {
    alert("请输入原文！");
    playBtn.disabled = false;
    isPlaying = false;
    return;
  }
  
  const wpm = parseInt(wpmSlider.value);
  const D = wpmToDitDuration(wpm);
  const freq = parseInt(frequencyInput.value);
  
  // 重置输入框
  userInput.value = '';
  comparisonOutput.innerHTML = '';
  accuracyRateEl.textContent = '-';
  
  // 播放每个字符
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === ' ') {
      await new Promise(resolve => setTimeout(resolve, 7 * D)); // 单词间隔
    } else if (charToMorse[char]) {
      const morse = charToMorse[char];
      for (let j = 0; j < morse.length; j++) {
        if (j > 0) await new Promise(resolve => setTimeout(resolve, D)); // 字符内间隔
        const isDot = morse[j] === '.';
        const duration = isDot ? D : 3 * D;
        await playTone(duration, freq);
      }
      await new Promise(resolve => setTimeout(resolve, 3 * D)); // 字符间隔
    }
  }
  
  isPlaying = false;
  playBtn.disabled = false;
}

// =============== 严格字符对齐比对 ===============
function normalizeText(text) {
  // 转大写，只保留字母、数字、空格
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
  
  // 预处理：标准化
  const source = normalizeText(sourceRaw);
  const user = normalizeText(userRaw);
  
  if (!source) {
    comparisonOutput.innerHTML = '<span style="color:red;">原文无效</span>';
    accuracyRateEl.textContent = '0';
    return;
  }
  
  // 逐字符比对（按原文长度）
  let correctCount = 0;
  let html = '';
  
  for (let i = 0; i < source.length; i++) {
    const sChar = source[i];
    const uChar = user[i] || ''; // 用户输入不足则为空
    
    if (sChar === ' ') {
      // 原文空格：用户必须输入空格才算对
      if (uChar === ' ') {
        html += '<span style="color:green;">␣</span>'; // 用 ␣ 可视化空格
        correctCount++;
      } else {
        html += '<span style="color:red;">␣</span>';
      }
    } else {
      // 原文字母/数字
      if (sChar === uChar) {
        html += `<span style="color:green;">${sChar}</span>`;
        correctCount++;
      } else {
        // 显示原文字符（标红），括号内显示用户输入（如有）
        let display = `<span style="color:red;">${sChar}`;
        if (uChar && uChar !== ' ') {
          display += `(${uChar})`;
        }
        display += '</span>';
        html += display;
      }
    }
  }
  
  // 处理用户多余输入（可选）
  if (user.length > source.length) {
    const extra = user.slice(source.length);
    html += ` <span style="color:orange;">[多余:${extra}]</span>`;
  }
  
  const accuracy = Math.round((correctCount / source.length) * 100);
  
  comparisonOutput.innerHTML = html;
  accuracyRateEl.textContent = accuracy;
}

// =============== 启动 ===============
window.addEventListener('load', init);