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
let countdownTimer = null; // 新增：用于管理倒计时
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
const countdownDisplayEl = document.getElementById('countdown-display'); // 新增：获取倒计时显示元素

// =============== 初始化 ===============
function init() {
wpmSlider.addEventListener('input', (e) => {
wpmValueEl.textContent = e.target.value; // **修复：确保WPM更新**
});
frequencyInput.addEventListener('change', (e) => {
let freq = parseInt(e.target.value);
if (freq < 350) freq = 350;
if (freq > 800) freq = 800;
frequencyInput.value = freq;
});
playBtn.addEventListener('click', playMorse); // 修改：绑定新函数
stopBtn.addEventListener('click', stopPlayback);
userInput.addEventListener('input', checkAnswer);
backBtn.addEventListener('click', () => window.location.href = 'index.html'); // **修复：确保返回按钮功能**
}

// =============== 播放控制 (修改) ===============
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

// 新增：封装倒计时后的播放逻辑
async function startPlaybackAfterCountdown(text, wpm, freq) {
    const D = wpmToDitDuration(wpm);
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
                    if (j > 0) await new Promise(resolve => setTimeout(resolve, D)); // 信号间隔
                    const isDot = morse[j] === '.';
                    const duration = isDot ? D : 3 * D;
                    await playTone(duration, freq);
                }
                if (isPlaying) await new Promise(resolve => setTimeout(resolve, 3 * D)); // 字符间隔
            }
        }
    } finally {
        // 播放完成后或被中断后，重置状态
        resetPlayback();
    }
}

// 修改：playMorse 函数，添加倒计时逻辑
function playMorse() { // <--- 移除 async
    if (isPlaying || countdownTimer) return; // 防止重复开始或在倒计时期间开始

    const text = sourceText.value.toUpperCase().trim();
    if (!text) {
        alert("请输入原文！");
        return;
    }

    // 确保 AudioContext 存在并激活
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // 开始倒计时
    let countdown = 5;
    isPlaying = true; // 设置播放状态为 true，表示练习已开始（包含倒计时阶段）
    playBtn.disabled = true;
    stopBtn.disabled = false;
    if (countdownDisplayEl) { // 显示倒计时
        countdownDisplayEl.style.display = 'inline';
        countdownDisplayEl.textContent = `准备开始... ${countdown}s`;
    }

    countdownTimer = setInterval(() => { // <--- setInterval 回调函数
        countdown--;
        if (countdown > 0) {
            if (countdownDisplayEl) countdownDisplayEl.textContent = `准备开始... ${countdown}s`;
        } else {
            // 倒计时结束，清除定时器
            clearInterval(countdownTimer);
            countdownTimer = null; // 清除倒计时ID

            if (countdownDisplayEl) countdownDisplayEl.textContent = '开始!';

            // 隐藏倒计时提示
            if (countdownDisplayEl) {
                setTimeout(() => { // 延迟隐藏，让用户看到 "开始!"
                    countdownDisplayEl.style.display = 'none';
                    countdownDisplayEl.textContent = ''; // 清空文本
                }, 1000); // 1秒后隐藏
            }

            // 获取播放参数
            const wpm = parseInt(wpmSlider.value);
            const freq = parseInt(frequencyInput.value);

            // 重置输入框和结果
            userInput.value = '';
            comparisonOutput.innerHTML = '';
            accuracyRateEl.textContent = '-';

            // 在这里调用播放函数，因为当前函数 (playMorse) 不是 async 的，但 startPlaybackAfterCountdown 是
            startPlaybackAfterCountdown(text, wpm, freq); // <--- 正确调用，不在 setInterval 回调内使用 await
        }
    }, 1000);
}

// 修改：stopPlayback 函数，处理倒计时和播放
function stopPlayback() {
    // 如果倒计时期间停止
    if (countdownTimer) {
        clearInterval(countdownTimer);
        countdownTimer = null;
        // 隐藏倒计时提示
        if (countdownDisplayEl) {
            countdownDisplayEl.style.display = 'none';
            countdownDisplayEl.textContent = ''; // 清空文本
        }
        // 重置状态
        isPlaying = false;
        playBtn.disabled = false;
        stopBtn.disabled = true;
        console.log("在倒计时期间停止播放");
        return;
    }

    // 如果播放期间停止
    if (isPlaying) {
        isPlaying = false;
        console.log("在播放期间停止播放");
    }
}

// 修改：resetPlayback 函数，仅重置按钮状态
function resetPlayback() {
    // isPlaying = false; // isPlaying 会在 stopPlayback 中被设置为 false
    playBtn.disabled = false;
    stopBtn.disabled = true;
    console.log("播放/倒计时结束，重置状态");
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
comparisonOutput.innerHTML = '原文无效';
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
html += '␣';
} else {
html += `<span style="color:green;">${c}</span>`;
}
} else {
html += '-';
}
}
// 处理用户多余输入
const extraCount = userChars.length - correctCount;
if (extraCount > 0) {
html += `<span style="color:orange;">[+${extraCount}]</span>`;
}
const accuracy = Math.round((correctCount / sourceChars.length) * 100);
comparisonOutput.innerHTML = html;
accuracyRateEl.textContent = accuracy;
}

// =============== 启动 ===============
window.addEventListener('load', init);