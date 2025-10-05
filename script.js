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
let currentSequence = "";
let lastSignalEnd = null;
let historyItems = [];
let isPracticeMode = false;
let inputKeyCode = 'Space';
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
  
  const oscillator = audioContext.createO