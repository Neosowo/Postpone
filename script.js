const STORAGE_KEY = 'postpone_v2';

const clockEl = document.getElementById('clock');
const dayProgressBar = document.getElementById('day-progress-bar');
const dayPctBarFill = document.getElementById('day-pct-bar-fill');
const dayPctLabel = document.getElementById('day-pct-label');
const navEfficiency = document.getElementById('nav-efficiency');
const navStateDot = document.getElementById('nav-state-dot');
const navStateLabel = document.getElementById('nav-state-label');

const stateIdle = document.getElementById('state-idle');
const stateWorking = document.getElementById('state-working');
const stateDistracted = document.getElementById('state-distracted');
const workTimer = document.getElementById('work-timer');
const distractTimer = document.getElementById('distract-timer');
const distractMessage = document.getElementById('distract-message');

const btnStart = document.getElementById('btn-start');
const btnLostFocus = document.getElementById('btn-lost-focus');
const btnResume = document.getElementById('btn-resume');
const btnEnd = document.getElementById('btn-end');
const btnReset = document.getElementById('btn-reset');

const statWork = document.getElementById('stat-work');
const statLost = document.getElementById('stat-lost');
const statEfficiency = document.getElementById('stat-efficiency');
const statInterruptions = document.getElementById('stat-interruptions');
const efficiencyBar = document.getElementById('efficiency-bar');

const historySection = document.getElementById('history-section');
const historyList = document.getElementById('history-list');
const btnMute = document.getElementById('btn-mute');
const muteIcon = document.getElementById('mute-icon');

const DISTRACT_MESSAGES = [
    'Cada segundo aquí es un segundo que no avanzas.',
    'Ya sabes lo que tienes que hacer.',
    'El trabajo no se hace solo mientras tanto.',
    '¿Cuánto tiempo más?',
    'Tu versión futura no agradece esto.',
    'La atención es finita. No la desperdicies.',
    'Vuelve. Ahora.',
    'El foco es un músculo. Lo estás dejando atrofiar.',
];

const STATES = { IDLE: 'idle', WORKING: 'working', DISTRACTED: 'distracted' };

let soundMuted = false;
let audioCtx = null;

const getAudioCtx = () => {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return audioCtx;
};

const playTone = (freq, duration, type = 'sine', peakGain = 0.25, startDelay = 0) => {
    if (soundMuted) return;
    try {
        const ctx = getAudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime + startDelay);
        gain.gain.setValueAtTime(0, ctx.currentTime + startDelay);
        gain.gain.linearRampToValueAtTime(peakGain, ctx.currentTime + startDelay + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + startDelay + duration);
        osc.start(ctx.currentTime + startDelay);
        osc.stop(ctx.currentTime + startDelay + duration + 0.05);
    } catch { }
};

const soundStart = () => {
    playTone(523, 0.12, 'sine', 0.22);
    playTone(659, 0.18, 'sine', 0.22, 0.12);
    playTone(784, 0.25, 'sine', 0.18, 0.26);
};

const soundLostFocus = () => {
    playTone(440, 0.18, 'triangle', 0.28);
    playTone(330, 0.3, 'triangle', 0.2, 0.16);
};

const soundResume = () => {
    playTone(659, 0.1, 'sine', 0.2);
    playTone(784, 0.2, 'sine', 0.22, 0.1);
};

const soundEnd = () => {
    playTone(523, 0.12, 'sine', 0.2);
    playTone(659, 0.12, 'sine', 0.2, 0.13);
    playTone(523, 0.3, 'sine', 0.15, 0.27);
};

let currentState = STATES.IDLE;
let blockStart = null;
let committedWorkSeconds = 0;
let committedLostSeconds = 0;
let committedInterruptions = 0;
let masterInterval = null;
let distractMsgIndex = 0;
let distractMsgInterval = null;

const getTodayKey = () => new Date().toISOString().slice(0, 10);

const loadPersisted = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        if (data.date !== getTodayKey()) return null;
        return data;
    } catch {
        return null;
    }
};

const savePersisted = () => {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            date: getTodayKey(),
            workSeconds: committedWorkSeconds,
            lostSeconds: committedLostSeconds,
            interruptions: committedInterruptions,
        }));
    } catch { }
};

const initFromStorage = () => {
    const data = loadPersisted();
    if (data) {
        committedWorkSeconds = data.workSeconds ?? 0;
        committedLostSeconds = data.lostSeconds ?? 0;
        committedInterruptions = data.interruptions ?? 0;
    }
};

const pad = (n) => String(n).padStart(2, '0');

const formatHMS = (totalSeconds) => {
    const s = Math.max(0, Math.floor(totalSeconds));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${pad(h)}:${pad(m)}:${pad(sec)}`;
};

const getDayProgressPct = () => {
    const now = new Date();
    const elapsed = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    return (elapsed / 86400) * 100;
};

const currentBlockElapsed = () => {
    if (blockStart === null) return 0;
    return (Date.now() - blockStart) / 1000;
};

const totalWorkSeconds = () =>
    committedWorkSeconds + (currentState === STATES.WORKING ? currentBlockElapsed() : 0);

const totalLostSeconds = () =>
    committedLostSeconds + (currentState === STATES.DISTRACTED ? currentBlockElapsed() : 0);

const calcEfficiency = (work, lost) => {
    const total = work + lost;
    if (total < 1) return null;
    return Math.round((work / total) * 100);
};

const updateStatsPanel = (workSec, lostSec) => {
    statWork.textContent = formatHMS(workSec);
    statLost.textContent = formatHMS(lostSec);
    statInterruptions.textContent = committedInterruptions;

    const eff = calcEfficiency(workSec, lostSec);
    if (eff === null) {
        statEfficiency.textContent = '—';
        navEfficiency.textContent = '—';
        efficiencyBar.style.width = '0%';
    } else {
        statEfficiency.textContent = `${eff}%`;
        navEfficiency.textContent = `${eff}%`;
        efficiencyBar.style.width = `${eff}%`;
    }
};

const masterTick = () => {
    const now = new Date();
    clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const pct = getDayProgressPct();
    dayProgressBar.style.width = `${pct}%`;
    dayPctBarFill.style.width = `${pct}%`;
    dayPctLabel.textContent = `${pct.toFixed(1)}% del día`;

    const workSec = totalWorkSeconds();
    const lostSec = totalLostSeconds();

    if (currentState === STATES.WORKING) {
        workTimer.textContent = formatHMS(currentBlockElapsed());
    } else if (currentState === STATES.DISTRACTED) {
        distractTimer.textContent = formatHMS(currentBlockElapsed());
    }

    updateStatsPanel(workSec, lostSec);
};

const setNavState = (label, color) => {
    navStateLabel.textContent = label;
    navStateDot.className = `w-1.5 h-1.5 ${color}`;
};

const showOnly = (...els) => {
    [stateIdle, stateWorking, stateDistracted].forEach(el => el.classList.add('hidden'));
    els.forEach(el => el.classList.remove('hidden'));
};

const showButtons = (...ids) => {
    [btnStart, btnLostFocus, btnResume, btnEnd, btnReset].forEach(b => b.classList.add('hidden'));
    ids.forEach(id => document.getElementById(id).classList.remove('hidden'));
};

const addHistoryBlock = (type, durationSeconds, startTime) => {
    if (durationSeconds < 1) return;
    const timeStr = `${pad(startTime.getHours())}:${pad(startTime.getMinutes())}`;
    const isWork = type === 'work';

    const li = document.createElement('li');
    li.className = 'flex items-center gap-4 border-t border-zinc-900 py-3 first:border-t-0';
    li.style.animation = 'slide-down 0.25s ease-out forwards';

    const dot = document.createElement('span');
    dot.className = `w-2 h-2 shrink-0 ${isWork ? 'bg-zinc-50' : 'bg-red-600'}`;

    const typeLabel = document.createElement('span');
    typeLabel.className = `text-[10px] font-black tracking-[0.4em] uppercase w-24 shrink-0 ${isWork ? 'text-zinc-500' : 'text-red-700'}`;
    typeLabel.textContent = isWork ? 'Foco' : 'Distracción';

    const timeLabel = document.createElement('span');
    timeLabel.className = 'text-[10px] font-mono text-zinc-700 tabular-nums';
    timeLabel.textContent = timeStr;

    const durationLabel = document.createElement('span');
    durationLabel.className = `text-sm font-black tabular-nums ml-auto ${isWork ? 'text-zinc-300' : 'text-red-600'}`;
    durationLabel.textContent = formatHMS(durationSeconds);

    li.appendChild(dot);
    li.appendChild(typeLabel);
    li.appendChild(timeLabel);
    li.appendChild(durationLabel);

    historyList.prepend(li);
    historySection.classList.remove('hidden');
};

const commitBlock = () => {
    if (blockStart === null) return;
    const elapsed = Math.floor(currentBlockElapsed());
    if (currentState === STATES.WORKING) {
        committedWorkSeconds += elapsed;
        addHistoryBlock('work', elapsed, new Date(blockStart));
    } else if (currentState === STATES.DISTRACTED) {
        committedLostSeconds += elapsed;
        addHistoryBlock('distract', elapsed, new Date(blockStart));
    }
    savePersisted();
};

const cycleDistractMessage = () => {
    distractMsgIndex = (distractMsgIndex + 1) % DISTRACT_MESSAGES.length;
    distractMessage.style.opacity = '0';
    setTimeout(() => {
        distractMessage.textContent = DISTRACT_MESSAGES[distractMsgIndex];
        distractMessage.style.opacity = '1';
        distractMessage.style.transition = 'opacity 0.4s ease';
    }, 300);
};

const handleStart = () => {
    currentState = STATES.WORKING;
    blockStart = Date.now();
    workTimer.textContent = formatHMS(0);
    showOnly(stateWorking);
    showButtons('btn-lost-focus', 'btn-end');
    setNavState('Trabajando', 'bg-zinc-50');
    soundStart();
};

const handleLostFocus = () => {
    commitBlock();
    committedInterruptions += 1;
    savePersisted();

    currentState = STATES.DISTRACTED;
    blockStart = Date.now();

    distractMsgIndex = Math.floor(Math.random() * DISTRACT_MESSAGES.length);
    distractMessage.textContent = DISTRACT_MESSAGES[distractMsgIndex];
    distractMessage.style.opacity = '1';
    distractTimer.textContent = formatHMS(0);

    if (distractMsgInterval) clearInterval(distractMsgInterval);
    distractMsgInterval = setInterval(cycleDistractMessage, 5000);

    showOnly(stateDistracted);
    showButtons('btn-resume', 'btn-end');
    setNavState('Sin foco', 'bg-red-600');
    soundLostFocus();
};

const handleResume = () => {
    if (distractMsgInterval) clearInterval(distractMsgInterval);
    commitBlock();

    currentState = STATES.WORKING;
    blockStart = Date.now();
    workTimer.textContent = formatHMS(0);

    showOnly(stateWorking);
    showButtons('btn-lost-focus', 'btn-end');
    setNavState('Trabajando', 'bg-zinc-50');
    soundResume();
};

const handleEnd = () => {
    if (distractMsgInterval) clearInterval(distractMsgInterval);
    commitBlock();

    currentState = STATES.IDLE;
    blockStart = null;

    showOnly(stateIdle);
    showButtons('btn-start', 'btn-reset');
    setNavState('Inactivo', 'bg-zinc-700');
    updateStatsPanel(totalWorkSeconds(), totalLostSeconds());
    soundEnd();
};

const handleReset = () => {
    if (!confirm('¿Reiniciar todas las estadísticas del día?')) return;
    if (distractMsgInterval) clearInterval(distractMsgInterval);

    currentState = STATES.IDLE;
    blockStart = null;
    committedWorkSeconds = 0;
    committedLostSeconds = 0;
    committedInterruptions = 0;
    savePersisted();

    historyList.innerHTML = '';
    historySection.classList.add('hidden');
    workTimer.textContent = formatHMS(0);
    distractTimer.textContent = formatHMS(0);

    showOnly(stateIdle);
    showButtons('btn-start');
    setNavState('Inactivo', 'bg-zinc-700');
    updateStatsPanel(0, 0);
};

initFromStorage();
masterTick();
masterInterval = setInterval(masterTick, 1000);
showButtons('btn-start');

btnStart.addEventListener('click', handleStart);
btnLostFocus.addEventListener('click', handleLostFocus);
btnResume.addEventListener('click', handleResume);
btnEnd.addEventListener('click', handleEnd);
btnReset.addEventListener('click', handleReset);

btnMute.addEventListener('click', () => {
    soundMuted = !soundMuted;
    muteIcon.textContent = soundMuted ? '\u2715' : '\u266a';
    btnMute.title = soundMuted ? 'Sonidos silenciados' : 'Sonidos activados';
    btnMute.classList.toggle('border-red-900', soundMuted);
    btnMute.classList.toggle('text-red-900', soundMuted);
    btnMute.classList.toggle('border-zinc-800', !soundMuted);
    btnMute.classList.toggle('text-zinc-600', !soundMuted);
});
