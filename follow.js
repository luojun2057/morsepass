// =============== 配置 (来自 script.js) ===============
const MAX_HISTORY_MS = 15000; // 与 script.js 保持一致
const DEFAULT_WPM = 20;
const DEFAULT_FREQUENCY = 600;
// =============== 状态 ===============
let currentWPM = DEFAULT_WPM;
let audioFrequency = DEFAULT_FREQUENCY;
let signals = []; // 用于存储用户发报信号 (来自 script.js)
let decodedText = ""; // 用户解码出的文本 (用于比对和显示)
let currentSequence = ""; // 用户当前正在输入的摩尔斯码序列
let lastSignalEnd = null; // 用户发报信号结束时间
let isPlayingOriginal = false; // 原文播放状态
let isFollowPracticeActive = false; // 跟发练习状态（是否允许用户输入）
let inputKeyCode = 'Space'; // 默认按键，将从 localStorage 读取
let isSignalActive = false; // 用户当前是否正在发报
let signalStartTime = 0; // 用户发报开始时间
let gapTimer = null; // 用户发报间隔检测定时器 (来自 script.js)
let originalText = ""; // 用户粘贴的原文
let originalMorseCode = ""; // 原文对应的摩尔斯码字符串 (用于比对)
let originalDecodedText = ""; // 原文对应的解码文本 (用于比对)
let audioContext = null; // 统一管理 AudioContext
let countdownTimer = null; // 倒计时定时器
// =============== 摩尔斯码字典 (来自 script.js) ===============
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
const charToMorse = Object.fromEntries(Object.entries(morseToChar).map(([k, v]) => [v, k]));

// =============== DOM 元素 ===============
let canvas, ctx, decodedOutput, sequenceOutput;
let wpmSlider, wpmValueEl, frequencyInput;
let playBtn, stopBtn, backBtn, clearBtn;
let sourceTextEl, comparisonOutput, accuracyRateEl;
let realWpmEl, accuracyEl;
let countdownDisplayEl; // 新增：倒计时显示元素
let transmitAreaEl, transmitHintEl; // 新增发报区元素

// =============== 音频函数 (复用 receive.js 播放逻辑) ===============
// wpmToDitDuration (来自 receive.js)
function wpmToDitDuration(wpm) {
    return 1200 / wpm;
}

// playTone (来自 receive.js)
function playTone(durationMs, frequency) {
    // 确保 AudioContext 存在并激活
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
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

// playMorseForFollow (基于 receive.js playMorse 修改)
async function playMorseForFollow(text, wpm, freq) {
    // 确保 AudioContext 存在并激活
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const D = wpmToDitDuration(wpm);
    // 播放每个字符
    for (let i = 0; i < text.length; i++) {
        if (!isPlayingOriginal) break; // 被停止则退出 (使用 follow.js 的状态)
        const char = text[i];
        if (char === ' ') {
            await new Promise(resolve => setTimeout(resolve, 7 * D));
        } else if (charToMorse[char]) {
            const morse = charToMorse[char];
            for (let j = 0; j < morse.length; j++) {
                if (!isPlayingOriginal) break; // 被停止则退出
                if (j > 0) await new Promise(resolve => setTimeout(resolve, D)); // 信号间隔
                const isDot = morse[j] === '.';
                const duration = isDot ? D : 3 * D;
                await playTone(duration, freq);
            }
            if (isPlayingOriginal) await new Promise(resolve => setTimeout(resolve, 3 * D)); // 字符间隔
        }
    }
    // 播放完成后，重置播放状态
    isPlayingOriginal = false;
    console.log("原文播放完成 (isPlayingOriginal now:", isPlayingOriginal, ")");
    // 播放完成后，用户仍可以继续发报，除非手动停止
    // 不在这里改变 isFollowPracticeActive
}


// =============== 用户发报逻辑 (复用 script.js 逻辑，但不播放声音) ===============
function startSignalSound() {
    // 在跟发模式下，不播放用户发报的声音
    console.log("User signal started (sound muted in follow mode)"); // 提示作用
}

function stopSignalSound() {
    // 在跟发模式下，此函数内部不播放声音
    console.log("User signal stopped (sound muted in follow mode)"); // 提示作用
}

function processSignal(duration) {
    if (!isFollowPracticeActive) return; // 只有在跟发练习模式下才处理

    if (gapTimer) {
        clearTimeout(gapTimer);
        gapTimer = null;
    }

    const D = wpmToDitDuration(currentWPM);
    const isDot = duration < D * 2;
    const type = isDot ? 'dot' : 'dash';
    // Note: 节奏准确率在此模式下可能不作为主要评判标准，但保留计算逻辑
    const tolerance = 0.25; // 可以考虑做成配置项，或者固定一个合理的值
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
        if (gap >= 7 * D) { // 单词间隔
            if (currentSequence) {
                const char = morseToChar[currentSequence] || '?';
                decodedText += char + " "; // 添加解码字符和空格
                currentSequence = "";
                updateDisplay();
                updateStats();
                redrawTimeline();
                // 在添加空格后，立即进行实时比对
                performRealTimeComparison();
            }
        } else if (gap >= 3 * D) { // 字符间隔
            if (currentSequence) {
                const char = morseToChar[currentSequence] || '?';
                decodedText += char; // 添加解码字符
                currentSequence = "";
                updateDisplay();
                updateStats();
                redrawTimeline();
                // 在添加字符后，立即进行实时比对
                performRealTimeComparison();
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

    // 启动超时检测，用于结束当前字符输入 (来自 script.js)
    const timeoutDuration = 7 * D * 1.2; // 与 script.js 一致
    gapTimer = setTimeout(() => {
        if (currentSequence) {
            const char = morseToChar[currentSequence] || '?';
            decodedText += char + " "; // 超时视为单词间隔
            currentSequence = "";
            updateDisplay();
            updateStats();
            redrawTimeline();
            // 在超时添加字符后，立即进行实时比对
            performRealTimeComparison();
        }
        gapTimer = null;
    }, timeoutDuration);

    const cutoff = now - MAX_HISTORY_MS;
    signals = signals.filter(s => s.start + s.duration >= cutoff);

    // 更新显示（序列部分）
    if (decodedOutput) decodedOutput.textContent = decodedText + (currentSequence ? '?' : '');
    if (sequenceOutput) sequenceOutput.textContent = currentSequence || "-";
}

function updateDisplay() {
    const displayText = decodedText + (currentSequence ? '?' : '');
    if (decodedOutput) decodedOutput.textContent = displayText || "-";
    if (sequenceOutput) sequenceOutput.textContent = currentSequence || "-";
}

function updateStats() {
    if (signals.length === 0) {
        if (realWpmEl) realWpmEl.textContent = "-";
        if (accuracyEl) accuracyEl.textContent = "-";
        return;
    }

    const now = performance.now();
    const recentSignals = signals.filter(s => s.start > now - 5000);
    if (recentSignals.length === 0) {
        if (realWpmEl) realWpmEl.textContent = "-";
        if (accuracyEl) accuracyEl.textContent = "-";
    } else {
        const totalTime = recentSignals.reduce((sum, s) => sum + s.duration, 0);
        const estimatedWPM = totalTime > 0 ? (1200 * recentSignals.length) / totalTime : 0;
        if (realWpmEl) realWpmEl.textContent = Math.round(estimatedWPM * 10) / 10;

        const accurateCount = recentSignals.filter(s => s.accurate).length;
        const accuracy = recentSignals.length > 0 ? Math.round((accurateCount / recentSignals.length) * 100) : 0;
        if (accuracyEl) accuracyEl.textContent = accuracy;
    }
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
        // Note: 在此模式下，颜色可能不完全代表准确率，但保留以提供视觉反馈
        ctx.fillStyle = sig.accurate ? '#10b981' : '#ef4444';
        ctx.fillRect(x, 10, w, height - 20);
    }
}

// =============== 实时比对逻辑 (类似 receive.js 的 checkAnswer) ===============
function performRealTimeComparison() {
    // 只有在有原文时才进行比对
    if (!originalDecodedText) {
        if (comparisonOutput) comparisonOutput.innerHTML = '';
        if (accuracyRateEl) accuracyRateEl.textContent = '-';
        return;
    }

    // 使用与 receive.js 类似的逻辑进行比对
    const sourceRaw = originalDecodedText; // 使用原始解码文本作为标准
    const userRaw = decodedText; // 使用用户实时解码的文本

    if (!sourceRaw.trim()) {
        if (comparisonOutput) comparisonOutput.innerHTML = '';
        if (accuracyRateEl) accuracyRateEl.textContent = '-';
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
        if (comparisonOutput) comparisonOutput.innerHTML = '原文无效';
        if (accuracyRateEl) accuracyRateEl.textContent = '0';
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
                html += '␣'; // 显示空格符号
            } else {
                html += `<span style="color:green;">${c}</span>`; // 正确字符显示为绿色
            }
        } else {
            html += '-'; // 漏抄显示为 '-'
        }
    }
    // 处理用户多余输入
    const extraCount = userChars.length - correctCount;
    if (extraCount > 0) {
        html += `<span style="color:orange;">[+${extraCount}]</span>`;
    }

    const accuracy = Math.round((correctCount / sourceChars.length) * 100);
    if (comparisonOutput) comparisonOutput.innerHTML = html;
    if (accuracyRateEl) accuracyRateEl.textContent = accuracy;
}

// 与 receive.js 一致的字符标准化函数
function normalizeChar(c) {
    // 仅标准化单个字符（用于比对）
    const upper = c.toUpperCase();
    return /^[A-Z0-9\s]$/.test(upper) ? upper : null;
}


// =============== 初始化 ===============
function init() {
    console.log("Follow Init 开始执行"); // 调试信息

    // 获取 DOM 元素，并检查是否存在
    canvas = document.getElementById('timeline-canvas');
    if (!canvas) { console.error("Canvas 元素未找到"); return; }
    ctx = canvas.getContext('2d');
    if (!ctx) { console.error("Canvas 2D Context 获取失败"); return; }

    decodedOutput = document.getElementById('decoded-output');
    if (!decodedOutput) { console.error("decodedOutput 元素未找到"); return; }
    sequenceOutput = document.getElementById('sequence-output');
    if (!sequenceOutput) { console.error("sequenceOutput 元素未找到"); return; }

    wpmSlider = document.getElementById('wpm-slider');
    if (!wpmSlider) { console.error("wpmSlider 元素未找到"); return; }
    wpmValueEl = document.getElementById('wpm-value');
    if (!wpmValueEl) { console.error("wpmValueEl 元素未找到"); return; }

    frequencyInput = document.getElementById('frequency-input');
    if (!frequencyInput) { console.error("frequencyInput 元素未找到"); return; }

    playBtn = document.getElementById('play-btn');
    if (!playBtn) { console.error("playBtn 元素未找到"); return; }
    stopBtn = document.getElementById('stop-btn');
    if (!stopBtn) { console.error("stopBtn 元素未找到"); return; }
    clearBtn = document.getElementById('clear-btn');
    if (!clearBtn) { console.error("clearBtn 元素未找到"); return; }

    backBtn = document.getElementById('back-btn');
    if (!backBtn) { console.error("backBtn 元素未找到"); return; }

    sourceTextEl = document.getElementById('source-text');
    if (!sourceTextEl) { console.error("sourceTextEl 元素未找到"); return; }

    comparisonOutput = document.getElementById('comparison-output');
    if (!comparisonOutput) { console.error("comparisonOutput 元素未找到"); return; }
    accuracyRateEl = document.getElementById('accuracy-rate');
    if (!accuracyRateEl) { console.error("accuracyRateEl 元素未找到"); return; }

    countdownDisplayEl = document.getElementById('countdown-display');
    if (!countdownDisplayEl) { console.error("countdownDisplayEl 元素未找到"); return; } // 获取倒计时显示元素

    transmitAreaEl = document.getElementById('transmit-area');
    if (!transmitAreaEl) { console.error("transmitAreaEl 元素未找到"); return; }
    transmitHintEl = document.getElementById('transmit-hint');
    if (!transmitHintEl) { console.error("transmitHintEl 元素未找到"); return; }

    // 尝试从 localStorage 读取按键设置 (来自 script.js)
    const storedKey = localStorage.getItem('morseKey');
    if (storedKey) {
        inputKeyCode = storedKey;
        console.log("从 localStorage 读取按键设置:", inputKeyCode);
        if (transmitHintEl) {
            transmitHintEl.textContent = `● 按下 ${inputKeyCode} 键或点击此处发报`; // 更新提示文字
        }
    } else {
        // 如果没有存储的按键，则使用默认的 Space
        console.log("未找到存储的按键设置，使用默认按键:", inputKeyCode);
        if (transmitHintEl) {
            transmitHintEl.textContent = `● 按下 ${inputKeyCode} 键或点击此处发报`;
        }
    }

    // 更新初始显示
    updateDitDisplay();

    // 绑定事件
    bindControlEvents(); // 绑定按钮、滑块、输入框事件
    bindTransmitArea(); // 绑定发报区

    // 初始状态：不允许发报
    isFollowPracticeActive = false;
    if (transmitAreaEl) transmitAreaEl.classList.remove('active'); // 发报区失活

    updateDisplay();
    updateStats();
    redrawTimeline();
    // 初始比对结果为空
    performRealTimeComparison();

    // 绑定全局按键事件
    bindGlobalKeys();

    console.log("Follow Init 执行完毕"); // 调试信息
}

function bindControlEvents() {
    // WPM 滑块
    if (wpmSlider) {
        wpmSlider.addEventListener('input', (e) => {
            console.log("WPM 滑块被拖动，值:", e.target.value); // 调试信息
            currentWPM = parseInt(e.target.value);
            wpmValueEl.textContent = currentWPM; // **关键：更新显示**
            updateDitDisplay(); // 更新 D 显示
        });
    }
    // 频率输入
    if (frequencyInput) {
        frequencyInput.addEventListener('change', (e) => {
            console.log("频率输入被改变，值:", e.target.value); // 调试信息
            let freq = parseInt(e.target.value);
            if (freq < 350) freq = 350;
            if (freq > 800) freq = 800;
            audioFrequency = freq;
            frequencyInput.value = freq;
        });
    }
    // 开始练习按钮
    if (playBtn) {
        playBtn.addEventListener('click', startFollowPractice);
        console.log("开始练习按钮事件已绑定"); // 调试信息
    }
    // 停止练习按钮
    if (stopBtn) {
        stopBtn.addEventListener('click', stopFollowPractice);
        console.log("停止练习按钮事件已绑定"); // 调试信息
    }
    // 清空按钮
    if (clearBtn) {
        clearBtn.addEventListener('click', clearAll);
        console.log("清空按钮事件已绑定"); // 调试信息
    }
    // 返回主页面按钮
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            console.log("返回主页面按钮被点击"); // 调试信息
            window.location.href = 'index.html'; // 修复：确保跳转
        });
        console.log("返回主页面按钮事件已绑定"); // 调试信息
    }
}

function updateDitDisplay() {
    const d = wpmToDitDuration(currentWPM);
    // 注意：follow.html 中没有 dit-duration 元素，如果需要，可以添加
    // const ditDurationEl = document.getElementById('dit-duration');
    // if (ditDurationEl) ditDurationEl.textContent = Math.round(d);
}

// =============== 绑定发报区鼠标事件 (来自 script.js) ===============
function bindTransmitArea() {
    if (!transmitAreaEl) return;

    const mouseDownHandler = (e) => {
        e.preventDefault();
        if (!isFollowPracticeActive) return; // 只有在跟发练习激活时才响应
        if (isSignalActive) return; // 防止重复开始
        isSignalActive = true;
        signalStartTime = performance.now();
        startSignalSound(); // 在跟发模式下，此函数内部不播放声音
    };

    const mouseUpHandler = (e) => {
        e.preventDefault();
        if (!isSignalActive) return;
        isSignalActive = false;
        stopSignalSound(); // 在跟发模式下，此函数内部不播放声音
        const duration = performance.now() - signalStartTime;
        processSignal(duration);
    };

    // 注意：mouseleave 事件也很重要，防止鼠标移出发报区后仍处于发报状态
    const mouseLeaveHandler = (e) => {
        // 与 mouseUp 逻辑相同，处理鼠标意外移出发报区的情况
        if (isSignalActive) {
            isSignalActive = false;
            stopSignalSound();
            const duration = performance.now() - signalStartTime;
            processSignal(duration);
        }
    };

    transmitAreaEl.addEventListener('mousedown', mouseDownHandler);
    transmitAreaEl.addEventListener('mouseup', mouseUpHandler);
    transmitAreaEl.addEventListener('mouseleave', mouseLeaveHandler); // 添加此行
    console.log("发报区鼠标事件已绑定");
}

// =============== 全局按键绑定 (来自 script.js) ===============
function bindGlobalKeys() {
    const keyDownHandler = (e) => {
        // 只有在跟发练习激活时才处理
        if (e.code !== inputKeyCode || !isFollowPracticeActive || isSignalActive || countdownTimer) return;
        e.preventDefault(); // 防止空格键滚动页面等默认行为
        isSignalActive = true;
        signalStartTime = performance.now();
        startSignalSound(); // 在跟发模式下，此函数内部不播放声音
    };

    const keyUpHandler = (e) => {
        // 只有在跟发练习激活且正在发报时才处理
        if (e.code !== inputKeyCode || !isSignalActive) return;
        e.preventDefault();
        isSignalActive = false;
        stopSignalSound(); // 在跟发模式下，此函数内部不播放声音
        const duration = performance.now() - signalStartTime;
        processSignal(duration);
    };

    // 在 window 上绑定，确保全局响应
    window.addEventListener('keydown', keyDownHandler);
    window.addEventListener('keyup', keyUpHandler);
    console.log("全局按键监听器已绑定");
}


// =============== 练习控制 ===============
function startFollowPractice() { // <--- 移除了 async，因为 await 不在它内部
    // 关键修复：检查状态时，必须确保倒计时期间和原文播放期间都不能再次开始
    if (isPlayingOriginal || countdownTimer) {
        console.log("练习已在进行中或倒计时期间，无法开始。isPlayingOriginal:", isPlayingOriginal, ", countdownTimer:", !!countdownTimer);
        return;
    }

    const inputText = sourceTextEl.value.toUpperCase().trim();
    if (!inputText) {
        alert("请输入要练习的原文！");
        return;
    }

    originalText = inputText;
    originalMorseCode = textToMorse(inputText);
    originalDecodedText = morseToText(originalMorseCode); // 获取标准解码文本用于比对

    // 确保有 AudioContext 并激活
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    // 开始倒计时
    let countdown = 5;
    isFollowPracticeActive = false; // 倒计时期间不允许发报
    if (transmitAreaEl) transmitAreaEl.classList.remove('active'); // 发报区失活

    playBtn.disabled = true;
    stopBtn.disabled = false;
    if (countdownDisplayEl) { // 显示倒计时
        countdownDisplayEl.style.display = 'inline'; // 显示元素
        countdownDisplayEl.textContent = `准备开始... ${countdown}s`;
    }

    countdownTimer = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            if (countdownDisplayEl) countdownDisplayEl.textContent = `准备开始... ${countdown}s`;
        } else {
            // 倒计时结束，清除定时器
            clearInterval(countdownTimer);
            countdownTimer = null; // 清除倒计时ID
            if (countdownDisplayEl) countdownDisplayEl.textContent = '开始!'; // 显示开始

            // 在倒计时结束后，设置状态并准备播放
            isPlayingOriginal = true; // 设置播放状态
            isFollowPracticeActive = true; // 设置练习状态
            if (transmitAreaEl) transmitAreaEl.classList.add('active'); // 发报区激活

            // 确保有 AudioContext (再次检查，以防万一)
            if (!audioContext) {
                audioContext = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (audioContext.state === 'suspended') {
                audioContext.resume(); // 确保激活
            }

            // 隐藏倒计时提示
            if (countdownDisplayEl) {
                setTimeout(() => { // 使用 setTimeout 延迟隐藏，让用户看到 "开始!"
                    countdownDisplayEl.style.display = 'none';
                    countdownDisplayEl.textContent = ''; // 清空文本
                }, 1000); // 1秒后隐藏
            }

            // 在这里调用播放函数，因为当前函数 (startFollowPractice) 是 async 的
            // 或者，将播放逻辑封装成一个独立的 async 函数并在下面调用
            startPlaybackAfterCountdown(); // 推荐方式：封装成独立函数
        }
    }, 1000);
}

// 新增：封装倒计时后的播放逻辑
async function startPlaybackAfterCountdown() {
    try {
        await playMorseForFollow(originalText, currentWPM, audioFrequency);
    } catch (e) {
        console.error("播放摩尔斯码时出错:", e);
        // 重置状态以确保按钮可用
        // 注意：playMorseForFollow 内部已经将 isPlayingOriginal = false;
        // 但如果 playMorseForFollow 没有执行完就出错，这里需要手动重置
        // isPlayingOriginal = false; // playMorseForFollow 内部会重置
        // playBtn.disabled = false; // 播放结束后由 playMorseForFollow 的逻辑或 stopFollowPractice 控制按钮状态
        // stopBtn.disabled = true;
    }
    // 播放结束后，按钮状态由 stopFollowPractice 控制，或者在这里也可以处理
    // 但通常用户可能希望播放结束后继续发报，所以按钮状态可能不需要立即改变
    // 如果需要播放结束后自动停止练习，则在这里调用 stopFollowPractice
    // stopFollowPractice(); // 取决于具体需求
}

function stopFollowPractice() {
    // 关键修复：无论在倒计时期间还是原文播放期间，都应能停止
    if (countdownTimer) {
        // 如果在倒计时期间停止
        console.log("在倒计时期间停止练习");
        clearInterval(countdownTimer);
        countdownTimer = null; // 清除倒计时ID
        // 隐藏倒计时提示
        if (countdownDisplayEl) {
            countdownDisplayEl.style.display = 'none';
            countdownDisplayEl.textContent = ''; // 清空文本
        }
        isPlayingOriginal = false; // 重置播放状态，因为播放未开始
        isFollowPracticeActive = false; // 停止倒计时后，不允许发报
        if (transmitAreaEl) transmitAreaEl.classList.remove('active'); // 发报区失活
    }

    if (isPlayingOriginal) {
        // 如果在原文播放期间停止
        console.log("在原文播放期间停止练习");
        isPlayingOriginal = false; // 停止原文播放状态
        // 注意：playMorseForFollow 中没有直接停止 oscillator 的逻辑
        // 它依赖于 isPlayingOriginal 状态在循环中被检查来退出
        // 如果需要立即停止音频，可能需要在 receive.js 的 playTone 中引入 AbortController
        // 或者在 follow.js 中引入一个全局的 abortController 来控制 playTone
        // 但为了复用，我们暂时保持原样，播放会在下一个字符检查 isPlayingOriginal 时停止
    }

    // 无论在哪个阶段停止，都要确保练习状态关闭
    isFollowPracticeActive = false;
    playBtn.disabled = false;
    stopBtn.disabled = true;
    if (transmitAreaEl) transmitAreaEl.classList.remove('active'); // 发报区失活
    console.log("跟发练习已停止，用户发报被禁用 (isPlayingOriginal:", isPlayingOriginal, ", countdownTimer:", !!countdownTimer, ")");

    // 在停止练习后，如果还有未完成的序列，处理一下
    if (gapTimer) {
        clearTimeout(gapTimer);
        gapTimer = null;
    }
    if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char;
        currentSequence = "";
        updateDisplay();
        updateStats();
        redrawTimeline();
        performRealTimeComparison();
    }
}


// function startReceiving() { // 不再需要此函数，初始化时就已开启
//     if (isReceiving) return;
//     isReceiving = true;
//     const transmitArea = document.getElementById('transmit-area');
//     if (transmitArea) transmitArea.classList.add('active');
//     signals = [];
//     decodedText = "";
//     currentSequence = "";
//     lastSignalEnd = null;
//     if (gapTimer) {
//         clearTimeout(gapTimer);
//         gapTimer = null;
//     }
//     updateDisplay();
//     updateStats();
//     redrawTimeline();
//     console.log("请开始跟发听到的摩尔斯码...");
// }

// function stopReceiving() { // 修改逻辑，不再由播放结束自动触发
function stopReceiving() {
    if (!isFollowPracticeActive) return;
    isFollowPracticeActive = false;
    // 发报区失活
    if (transmitAreaEl) transmitAreaEl.classList.remove('active');
    // 停止信号
    if (isSignalActive) {
        isSignalActive = false;
        stopSignalSound();
        const duration = performance.now() - signalStartTime;
        processSignal(duration);
    }
    // 清理定时器
    if (gapTimer) {
        clearTimeout(gapTimer);
        gapTimer = null;
    }
    // 处理剩余序列
    if (currentSequence) {
        const char = morseToChar[currentSequence] || '?';
        decodedText += char;
        currentSequence = "";
    }
    updateDisplay();
    updateStats();
    redrawTimeline();
    // 执行比对
    performRealTimeComparison();
}

function performComparison() {
    // 这个函数现在可以保留，用于可能的其他手动触发比对的场景
    // 但主要的实时比对由 performRealTimeComparison 承担
    console.log("手动比对被调用 (当前由实时比对处理)");
    performRealTimeComparison();
}

// =============== 文本与摩尔斯码转换 (来自 receive.js) ===============
function textToMorse(text) {
    return text
        .split('')
        .map(char => {
            if (char === ' ') return '|'; // 使用 | 代表单词间隔
            return charToMorse[char] + '/'; // 使用 / 代表字符间隔
        })
        .join('')
        .slice(0, -1); // 移除最后一个多余的 '/'
}

function morseToText(morse) {
    return morse
        .split('|') // 先按单词分割
        .map(wordMorse => wordMorse
            .split('/') // 再按字符分割
            .map(code => morseToChar[code] || '?') // 解码字符
            .join('')
        )
        .join(' '); // 用空格连接单词
}

// =============== 清空功能 ===============
function clearAll() {
    // 停止练习（如果正在进行）
    if (isPlayingOriginal || countdownTimer) {
        stopFollowPractice();
    }
    // 重置用户输入状态
    signals = [];
    decodedText = "";
    currentSequence = "";
    lastSignalEnd = null;
    // 清理定时器
    if (gapTimer) {
        clearTimeout(gapTimer);
        gapTimer = null;
    }
    // 更新显示
    updateDisplay();
    updateStats();
    redrawTimeline();
    // 清空结果区
    if (comparisonOutput) comparisonOutput.innerHTML = '';
    if (accuracyRateEl) accuracyRateEl.textContent = '-';
    // 重置原文
    originalText = "";
    originalMorseCode = "";
    originalDecodedText = "";
    console.log("已清空所有数据");
}

// =============== 启动 ===============
window.addEventListener('load', () => {
    console.log("Follow HTML 页面加载完成，准备执行 init"); // 调试信息
    init();
});

// 注册 Service Worker (与 index.html 保持一致)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js');
}