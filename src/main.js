import '@phosphor-icons/web/regular';
import './style.css';

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="shell" data-state="idle">
    <aside class="rail rail-left" aria-label="主导航">
      <button class="rail-button" aria-label="首页" data-toast="首页功能演示"><i class="ph ph-house"></i></button>
      <button class="rail-button is-active" aria-label="数字脑语音助手"><i class="ph ph-head-circuit"></i></button>
      <button class="rail-button" aria-label="设置" data-toast="设置功能演示"><i class="ph ph-gear-six"></i></button>
      <div class="rail-orb" aria-hidden="true"><span></span></div>
    </aside>

    <section class="workspace">
      <div class="ambient ambient-one"></div>
      <div class="ambient ambient-two"></div>

      <section class="shortcuts" aria-labelledby="shortcut-title">
        <p class="eyebrow">QUICK COMMANDS</p>
        <h1 id="shortcut-title">猜你想说</h1>
        <div class="shortcut-list">
          <button class="shortcut" data-query="扬声器音量调高到80%"><i class="ph ph-speaker-high"></i><span>扬声器音量调高到80%</span></button>
          <button class="shortcut" data-query="打开张三患者的扫描图像"><i class="ph ph-scan"></i><span>打开张三患者的扫描图像</span></button>
          <button class="shortcut" data-query="如何做好医疗影像质控？"><i class="ph ph-shield-check"></i><span>如何做好医疗影像质控？</span></button>
          <button class="shortcut" data-query="今天有哪些待办？"><i class="ph ph-list-checks"></i><span>今天有哪些待办？</span></button>
        </div>
        <div class="hint-card">
          <i class="ph ph-lightbulb"></i>
          <p>试着说“你好小智”唤醒我，或按住下方按钮直接说话。</p>
        </div>
      </section>

      <section class="assistant-stage" aria-live="polite">
        <div class="state-chip"><span class="state-dot"></span><span id="state-label">待机</span></div>

        <div class="mascot-wrap">
          <div class="pulse pulse-one"></div>
          <div class="pulse pulse-two"></div>
          <div class="pulse pulse-three"></div>
          <div class="processing-orbit"><i class="ph ph-sparkle"></i><i class="ph ph-circle-notch"></i></div>
          <img class="mascot" src="/assets/assistant-mascot.png" alt="CBOX 数字脑助手" />
        </div>

        <div class="status-copy">
          <h2 id="status-title">你好，我是小智</h2>
          <p id="status-detail">按住按钮说话，或开启语音唤醒</p>
        </div>

        <div class="transcript" id="transcript" hidden>
          <span>“</span><p id="transcript-text"></p><span>”</span>
        </div>

        <div class="answer-card" id="answer-card" hidden>
          <div class="answer-icon" id="answer-icon"><i class="ph ph-check"></i></div>
          <div><p class="answer-kicker" id="answer-kicker">执行结果</p><p id="answer-text"></p></div>
        </div>

        <div class="waveform" id="waveform" aria-hidden="true">
          ${Array.from({ length: 24 }, (_, index) => `<i style="--i:${index}"></i>`).join('')}
        </div>

        <button class="talk-button" id="talk-button" type="button" aria-label="按住开始说话">
          <span class="button-glow"></span>
          <i class="ph ph-microphone"></i>
          <span id="talk-label">按住说话</span>
          <small>HOLD TO TALK</small>
        </button>
        <p class="privacy-note"><i class="ph ph-lock-key"></i> 麦克风仅在本地用于识别与声波显示</p>
      </section>
    </section>

    <aside class="rail rail-right" aria-label="语音控制">
      <button class="rail-button" id="menu-button" aria-label="常用指令" aria-expanded="false"><i class="ph ph-list"></i></button>
      <button class="rail-button" id="wake-button" aria-label="开启语音唤醒" aria-pressed="false"><i class="ph ph-ear"></i><span class="control-label">语音唤醒</span></button>
      <button class="rail-button" id="listen-demo" aria-label="模拟倾听状态"><i class="ph ph-headphones"></i><span class="control-label">倾听演示</span></button>
      <button class="rail-button" id="voice-button" aria-label="关闭语音播报" aria-pressed="true"><i class="ph ph-speaker-high"></i><span class="control-label">语音播报</span></button>
    </aside>

    <div class="toast" id="toast" role="status"></div>
    <div class="permission-modal" id="permission-modal" hidden>
      <div class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <div class="modal-icon"><i class="ph ph-microphone"></i></div>
        <h2 id="modal-title">需要麦克风权限</h2>
        <p>请在浏览器地址栏允许使用麦克风，然后再次按住说话。</p>
        <button id="modal-close">知道了</button>
      </div>
    </div>
  </main>
`;

const shell = document.querySelector('.shell');
const talkButton = document.querySelector('#talk-button');
const talkLabel = document.querySelector('#talk-label');
const stateLabel = document.querySelector('#state-label');
const statusTitle = document.querySelector('#status-title');
const statusDetail = document.querySelector('#status-detail');
const transcript = document.querySelector('#transcript');
const transcriptText = document.querySelector('#transcript-text');
const answerCard = document.querySelector('#answer-card');
const answerText = document.querySelector('#answer-text');
const answerKicker = document.querySelector('#answer-kicker');
const answerIcon = document.querySelector('#answer-icon');
const waveBars = [...document.querySelectorAll('.waveform i')];
const wakeButton = document.querySelector('#wake-button');
const voiceButton = document.querySelector('#voice-button');
const permissionModal = document.querySelector('#permission-modal');
const toast = document.querySelector('#toast');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
let stream = null;
let audioContext = null;
let analyser = null;
let analyserFrame = null;
let isHolding = false;
let wakeEnabled = false;
let voiceEnabled = true;
let processingTimer = null;
let wakeRestartTimer = null;

const responseRules = [
  {
    test: /(音量|扬声器).*(80|八十)/,
    type: 'command',
    response: '已将扬声器音量调整到 80%。'
  },
  {
    test: /(打开|调取|显示).*(张三).*(扫描|影像|图像)/,
    type: 'command',
    response: '已打开张三患者最新的胸部扫描图像。'
  },
  {
    test: /(质控|质量控制)/,
    type: 'answer',
    response: '建议重点检查图像完整性、伪影、标注准确性和设备参数一致性。'
  },
  {
    test: /(待办|任务|安排)/,
    type: 'answer',
    response: '今天有 3 项待办：影像复核、设备巡检和质控报告提交。'
  },
  {
    test: /(你是谁|叫什么)/,
    type: 'answer',
    response: '我是 CBOX 数字脑助手小智，可以执行车机指令并回答简短问题。'
  },
  {
    test: /(你好|早上好|下午好|晚上好)/,
    type: 'answer',
    response: '你好，我在。请告诉我需要执行什么。'
  },
  {
    test: /(打开|关闭|启动|停止|调节|设置)/,
    type: 'unsupported',
    response: '暂未接入这项功能，你可以尝试音量调节或影像调取。'
  }
];

function setState(state, options = {}) {
  clearTimeout(processingTimer);
  shell.dataset.state = state;
  const config = {
    idle: ['待机', '你好，我是小智', wakeEnabled ? '已开启语音唤醒，说“你好小智”即可唤醒' : '按住按钮说话，或开启语音唤醒', '按住说话'],
    listening: ['倾听中', '正在聆听…', '松开后为你处理', '松开结束'],
    processing: ['处理中', '正在理解…', '请稍候，马上为你处理', '处理中'],
    success: ['已完成', options.type === 'answer' ? '这是我的回答' : '指令已执行', '你可以继续提问', '按住说话'],
    error: ['未识别', '抱歉，我没听清', '请换一种说法再试一次', '重新说话']
  }[state];

  [stateLabel.textContent, statusTitle.textContent, statusDetail.textContent, talkLabel.textContent] = config;
  if (state !== 'success' && state !== 'error') answerCard.hidden = true;
  if (state === 'idle') transcript.hidden = true;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 2200);
}

function speak(text) {
  if (!voiceEnabled || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 1.05;
  window.speechSynthesis.speak(utterance);
}

function processInput(rawText) {
  const text = rawText.trim().replace(/[。！!？?，,]/g, '');
  if (!text) {
    showResult('没有检测到有效语音，请再试一次。', 'error');
    return;
  }

  transcriptText.textContent = rawText;
  transcript.hidden = false;
  setState('processing');

  processingTimer = window.setTimeout(() => {
    const match = responseRules.find((rule) => rule.test.test(text));
    if (!match) {
      showResult('我还不能理解这句话。你可以尝试页面左侧的常用指令。', 'error');
      return;
    }
    showResult(match.response, match.type);
  }, 850);
}

function showResult(message, type) {
  const isError = type === 'error' || type === 'unsupported';
  setState(isError ? 'error' : 'success', { type });
  answerKicker.textContent = type === 'answer' ? '简短回答' : type === 'unsupported' ? '暂不支持' : type === 'error' ? '未能识别' : '执行结果';
  answerIcon.innerHTML = `<i class="ph ${isError ? 'ph-warning' : type === 'answer' ? 'ph-chat-circle-dots' : 'ph-check'}"></i>`;
  answerText.textContent = message;
  answerCard.hidden = false;
  speak(message);
  processingTimer = window.setTimeout(() => {
    if (!isHolding) setState('idle');
  }, 6500);
}

async function connectMicrophone() {
  if (stream?.active) return true;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    });
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.76;
    audioContext.createMediaStreamSource(stream).connect(analyser);
    animateWaveform();
    return true;
  } catch (error) {
    permissionModal.hidden = false;
    setState('error');
    return false;
  }
}

function animateWaveform() {
  if (!analyser) return;
  const data = new Uint8Array(analyser.frequencyBinCount);
  const draw = () => {
    analyser.getByteFrequencyData(data);
    waveBars.forEach((bar, index) => {
      const sourceIndex = Math.min(data.length - 1, Math.floor(index / waveBars.length * data.length));
      const level = shell.dataset.state === 'listening' ? Math.max(0.12, data[sourceIndex] / 255) : 0.08;
      bar.style.setProperty('--level', level.toFixed(2));
    });
    analyserFrame = requestAnimationFrame(draw);
  };
  draw();
}

function buildRecognition(mode = 'hold') {
  if (!SpeechRecognition) return null;
  const instance = new SpeechRecognition();
  instance.lang = 'zh-CN';
  instance.interimResults = true;
  instance.continuous = mode === 'wake';
  let finalText = '';

  instance.onresult = (event) => {
    let liveText = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const value = event.results[i][0].transcript;
      liveText += value;
      if (event.results[i].isFinal) finalText += value;
    }

    if (mode === 'wake') {
      const phrase = (finalText || liveText).replace(/\s/g, '');
      if (/(你好小智|小智小智|嗨小智)/.test(phrase)) {
        stopWakeRecognition();
        showToast('已通过“你好小智”唤醒');
        beginHoldListening(true);
      }
      return;
    }

    transcriptText.textContent = liveText || finalText;
    transcript.hidden = false;
  };

  instance.onnomatch = () => mode === 'hold' && showResult('没有识别到明确内容，请再试一次。', 'error');
  instance.onerror = (event) => {
    if (['aborted', 'no-speech'].includes(event.error)) {
      if (mode === 'hold' && event.error === 'no-speech') showResult('没有听到声音，请靠近麦克风再试一次。', 'error');
      return;
    }
    if (event.error === 'not-allowed') permissionModal.hidden = false;
    if (mode === 'hold') showResult('语音识别暂时不可用，请检查浏览器麦克风权限。', 'error');
  };

  instance.onend = () => {
    if (mode === 'wake') {
      if (wakeEnabled && !isHolding) wakeRestartTimer = window.setTimeout(startWakeRecognition, 500);
      return;
    }
    if (finalText) processInput(finalText);
    else if (isHolding) setState('listening');
  };
  return instance;
}

async function beginHoldListening(fromWake = false) {
  if (isHolding) return;
  isHolding = true;
  stopWakeRecognition();
  const connected = await connectMicrophone();
  if (!connected) {
    isHolding = false;
    return;
  }
  setState('listening');
  transcript.hidden = true;

  if (!SpeechRecognition) {
    statusDetail.textContent = '当前浏览器不支持语音转文字，请使用 Chrome 或 Edge';
    return;
  }

  recognition = buildRecognition('hold');
  try { recognition.start(); } catch (error) { /* already active */ }

  if (fromWake) {
    window.setTimeout(() => {
      if (isHolding) endHoldListening();
    }, 5200);
  }
}

function endHoldListening() {
  if (!isHolding) return;
  isHolding = false;
  setState('processing');
  try { recognition?.stop(); } catch (error) { /* already stopped */ }
  if (!SpeechRecognition) showResult('当前浏览器不支持语音识别，请改用最新版 Chrome 或 Edge。', 'error');
}

function startWakeRecognition() {
  clearTimeout(wakeRestartTimer);
  if (!wakeEnabled || isHolding || !SpeechRecognition) return;
  recognition = buildRecognition('wake');
  try { recognition.start(); } catch (error) { /* already active */ }
}

function stopWakeRecognition() {
  clearTimeout(wakeRestartTimer);
  if (recognition) {
    recognition.onend = null;
    try { recognition.abort(); } catch (error) { /* already stopped */ }
    recognition = null;
  }
}

talkButton.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  talkButton.setPointerCapture?.(event.pointerId);
  beginHoldListening();
});
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => talkButton.addEventListener(name, endHoldListening));
talkButton.addEventListener('contextmenu', (event) => event.preventDefault());
talkButton.addEventListener('keydown', (event) => {
  if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
    event.preventDefault();
    beginHoldListening();
  }
});
talkButton.addEventListener('keyup', (event) => {
  if (event.code === 'Space' || event.code === 'Enter') endHoldListening();
});

document.querySelectorAll('.shortcut').forEach((button) => {
  button.addEventListener('click', () => processInput(button.dataset.query));
});

wakeButton.addEventListener('click', async () => {
  if (!SpeechRecognition) {
    showResult('当前浏览器不支持语音唤醒，请使用最新版 Chrome 或 Edge。', 'error');
    return;
  }
  wakeEnabled = !wakeEnabled;
  wakeButton.setAttribute('aria-pressed', String(wakeEnabled));
  wakeButton.classList.toggle('is-active', wakeEnabled);
  wakeButton.querySelector('.control-label').textContent = wakeEnabled ? '唤醒已开启' : '语音唤醒';
  if (wakeEnabled) {
    const connected = await connectMicrophone();
    if (!connected) return;
    showToast('语音唤醒已开启：请说“你好小智”');
    setState('idle');
    startWakeRecognition();
  } else {
    stopWakeRecognition();
    showToast('语音唤醒已关闭');
    setState('idle');
  }
});

voiceButton.addEventListener('click', () => {
  voiceEnabled = !voiceEnabled;
  voiceButton.setAttribute('aria-pressed', String(voiceEnabled));
  voiceButton.classList.toggle('is-muted', !voiceEnabled);
  voiceButton.querySelector('i').className = `ph ${voiceEnabled ? 'ph-speaker-high' : 'ph-speaker-slash'}`;
  voiceButton.querySelector('.control-label').textContent = voiceEnabled ? '语音播报' : '播报已关闭';
  if (!voiceEnabled) window.speechSynthesis?.cancel();
  showToast(voiceEnabled ? '语音播报已开启' : '语音播报已关闭');
});

document.querySelector('#listen-demo').addEventListener('click', () => {
  setState('listening');
  window.setTimeout(() => setState('processing'), 1600);
  window.setTimeout(() => showResult('状态动画运行正常。', 'command'), 2800);
});

document.querySelector('#menu-button').addEventListener('click', () => {
  document.querySelector('.shortcuts').classList.toggle('is-highlighted');
  showToast('常用指令位于页面左侧');
});

document.querySelectorAll('[data-toast]').forEach((button) => button.addEventListener('click', () => showToast(button.dataset.toast)));
document.querySelector('#modal-close').addEventListener('click', () => { permissionModal.hidden = true; });

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(analyserFrame);
  stopWakeRecognition();
  stream?.getTracks().forEach((track) => track.stop());
  audioContext?.close();
});

setState('idle');
