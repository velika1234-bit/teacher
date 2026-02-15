const webcam = document.getElementById('webcam');
const targetTimeEl = document.getElementById('target-time');
const statusEl = document.getElementById('status');
const readoutEls = {
  p1: document.getElementById('readout-p1'),
  p2: document.getElementById('readout-p2'),
};
const scoreEls = {
  p1: document.getElementById('score-p1'),
  p2: document.getElementById('score-p2'),
};

const clocks = {
  target: document.getElementById('target-clock').getContext('2d'),
  p1: document.getElementById('clock-p1').getContext('2d'),
  p2: document.getElementById('clock-p2').getContext('2d'),
};

const WIN_POINTS = 10;
const TASK_POOL_SIZE = 120;

const state = {
  gameOver: false,
  resolvingRound: false,
  tasks: [],
  targetHour: 12,
  targetMinute: 0,
  players: {
    p1: { hour: 12, minute: 0, hasHour: false, hasMinute: false, score: 0 },
    p2: { hour: 12, minute: 0, hasHour: false, hasMinute: false, score: 0 },
  },
};

const normalize = (value, min, max) => Math.min(max, Math.max(min, value));
const toRad = (deg) => (deg * Math.PI) / 180;

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function buildTaskPool() {
  const tasks = [];
  while (tasks.length < TASK_POOL_SIZE) {
    tasks.push({
      hour: Math.floor(Math.random() * 12) + 1,
      minute: Math.floor(Math.random() * 12) * 5,
    });
  }
  return tasks;
}

function drawClock(ctx, hour, minute, highlight = false) {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = highlight ? '#22d3ee' : '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let n = 1; n <= 12; n += 1) {
    const a = toRad(n * 30 - 90);
    const x = cx + Math.cos(a) * (radius - 20);
    const y = cy + Math.sin(a) * (radius - 20);
    ctx.fillText(String(n), x, y);
  }

  const minuteAngle = toRad(minute * 6 - 90);
  const hourAngle = toRad(((hour % 12) + minute / 60) * 30 - 90);

  ctx.lineCap = 'round';
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(minuteAngle) * (radius - 30), cy + Math.sin(minuteAngle) * (radius - 30));
  ctx.stroke();

  ctx.strokeStyle = '#f97316';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(hourAngle) * (radius - 60), cy + Math.sin(hourAngle) * (radius - 60));
  ctx.stroke();

  ctx.fillStyle = '#e2e8f0';
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();
}

function updateUI() {
  drawClock(clocks.target, state.targetHour, state.targetMinute, true);
  targetTimeEl.textContent = formatTime(state.targetHour, state.targetMinute);

  for (const key of ['p1', 'p2']) {
    const player = state.players[key];
    readoutEls[key].textContent = formatTime(player.hour, player.minute);
    scoreEls[key].textContent = `Точки: ${player.score}`;
    drawClock(clocks[key], player.hour, player.minute);
  }
}

function nextTask() {
  if (state.tasks.length === 0) {
    state.tasks = buildTaskPool();
  }
  const next = state.tasks.pop();
  state.targetHour = next.hour;
  state.targetMinute = next.minute;
  state.resolvingRound = false;
  updateUI();
}

function handToClockValues(handLandmarks) {
  const wrist = handLandmarks[0];
  const middleTip = handLandmarks[12];
  const dx = middleTip.x - wrist.x;
  const dy = middleTip.y - wrist.y;
  const angle = Math.atan2(dx, -dy);
  const normalizedAngle = (angle + Math.PI * 2) % (Math.PI * 2);

  const minute = Math.round((normalizedAngle / (Math.PI * 2)) * 60) % 60;
  const hour = ((Math.round((normalizedAngle / (Math.PI * 2)) * 12) + 11) % 12) + 1;
  return { hour, minute };
}

function applyHandToPlayer(playerKey, handedness, landmarks) {
  const values = handToClockValues(landmarks);
  const player = state.players[playerKey];

  if (handedness === 'Right') {
    player.hour = normalize(values.hour, 1, 12);
    player.hasHour = true;
  } else if (handedness === 'Left') {
    player.minute = Math.round(values.minute / 5) * 5;
    if (player.minute === 60) player.minute = 0;
    player.hasMinute = true;
  }
}

function isPlayerSolved(player) {
  if (!player.hasHour || !player.hasMinute) return false;
  const minuteDiff = Math.abs(player.minute - state.targetMinute);
  const hourMatch = (player.hour % 12) === (state.targetHour % 12);
  return hourMatch && minuteDiff <= 2;
}

function resolveRoundIfNeeded() {
  if (state.gameOver || state.resolvingRound) return;

  const p1Solved = isPlayerSolved(state.players.p1);
  const p2Solved = isPlayerSolved(state.players.p2);
  if (!p1Solved && !p2Solved) return;

  state.resolvingRound = true;
  let winner = null;

  if (p1Solved && !p2Solved) winner = 'p1';
  if (!p1Solved && p2Solved) winner = 'p2';

  if (!winner) {
    statusEl.textContent = 'Равенство в този рунд. Нова задача...';
    setTimeout(nextTask, 900);
    return;
  }

  state.players[winner].score += 1;
  updateUI();

  if (state.players[winner].score >= WIN_POINTS) {
    state.gameOver = true;
    const winnerName = winner === 'p1' ? 'Играч 1' : 'Играч 2';
    statusEl.textContent = `🏆 ${winnerName} печели играта с ${WIN_POINTS} точки!`;
    return;
  }

  const winnerName = winner === 'p1' ? 'Играч 1' : 'Играч 2';
  statusEl.textContent = `✅ ${winnerName} беше пръв и взима точка! Следваща задача...`;
  setTimeout(nextTask, 900);
}

function onResults(results) {
  if (state.gameOver) return;

  state.players.p1.hasHour = false;
  state.players.p1.hasMinute = false;
  state.players.p2.hasHour = false;
  state.players.p2.hasMinute = false;

  if (!results.multiHandLandmarks || !results.multiHandedness) {
    statusEl.textContent = 'Покажете ръце пред камерата.';
    updateUI();
    return;
  }

  for (let i = 0; i < results.multiHandLandmarks.length; i += 1) {
    const landmarks = results.multiHandLandmarks[i];
    const handedness = results.multiHandedness[i].label;
    const centerX = landmarks.reduce((sum, p) => sum + p.x, 0) / landmarks.length;
    const playerKey = centerX < 0.5 ? 'p1' : 'p2';
    applyHandToPlayer(playerKey, handedness, landmarks);
  }

  if (!state.resolvingRound) {
    statusEl.textContent = `Играч 1: ${state.players.p1.hasHour ? 'час ✓' : 'час …'}, ${state.players.p1.hasMinute ? 'минути ✓' : 'минути …'} | Играч 2: ${state.players.p2.hasHour ? 'час ✓' : 'час …'}, ${state.players.p2.hasMinute ? 'минути ✓' : 'минути …'}`;
  }

  updateUI();
  resolveRoundIfNeeded();
}

async function init() {
  state.tasks = buildTaskPool();
  nextTask();

  const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 4,
    modelComplexity: 1,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.55,
    selfieMode: true,
  });

  hands.onResults(onResults);

  const camera = new Camera(webcam, {
    onFrame: async () => {
      await hands.send({ image: webcam });
    },
    width: 960,
    height: 720,
  });

  await camera.start();
}

document.getElementById('new-round').addEventListener('click', () => {
  if (state.gameOver) return;
  statusEl.textContent = 'Прескочена задача. Нова цел...';
  nextTask();
});

init().catch((error) => {
  console.error(error);
  statusEl.textContent = 'Грешка при достъп до камерата. Разрешете camera permissions.';
});
