const webcam = document.getElementById('webcam');
const targetTimeEl = document.getElementById('target-time');
const statusEl = document.getElementById('status');
const scoreEl = document.getElementById('score');
const readoutEls = {
  p1: document.getElementById('readout-p1'),
  p2: document.getElementById('readout-p2'),
};

const clocks = {
  p1: document.getElementById('clock-p1').getContext('2d'),
  p2: document.getElementById('clock-p2').getContext('2d'),
};

const state = {
  targetHour: 12,
  targetMinute: 0,
  rounds: 0,
  players: {
    p1: { hour: 12, minute: 0, hasHour: false, hasMinute: false },
    p2: { hour: 12, minute: 0, hasHour: false, hasMinute: false },
  },
};

const normalize = (value, min, max) => Math.min(max, Math.max(min, value));
const toRad = (deg) => (deg * Math.PI) / 180;

function formatTime(hour, minute) {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function generateRound() {
  state.targetHour = Math.floor(Math.random() * 12) + 1;
  state.targetMinute = Math.floor(Math.random() * 12) * 5;
  targetTimeEl.textContent = formatTime(state.targetHour, state.targetMinute);
  statusEl.textContent = 'Нов рунд! Настройте часовниците.';
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

function drawClock(ctx, hour, minute) {
  const { width, height } = ctx.canvas;
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * 0.42;

  ctx.clearRect(0, 0, width, height);

  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#cbd5e1';
  for (let n = 1; n <= 12; n += 1) {
    const a = toRad(n * 30 - 90);
    const x = cx + Math.cos(a) * (radius - 20);
    const y = cy + Math.sin(a) * (radius - 20);
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
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

function updateReadouts() {
  for (const key of ['p1', 'p2']) {
    const player = state.players[key];
    readoutEls[key].textContent = formatTime(player.hour, player.minute);
    drawClock(clocks[key], player.hour, player.minute);
  }
}

function checkWin() {
  const targetMinutes = state.targetMinute;
  const targetHour = state.targetHour % 12;

  const ok = ['p1', 'p2'].every((key) => {
    const p = state.players[key];
    if (!p.hasHour || !p.hasMinute) return false;
    const hourDiff = Math.abs((p.hour % 12) - targetHour);
    const minuteDiff = Math.abs(p.minute - targetMinutes);
    return hourDiff <= 0 && minuteDiff <= 2;
  });

  if (ok) {
    state.rounds += 1;
    scoreEl.textContent = `Рундове: ${state.rounds}`;
    statusEl.textContent = '✅ И двамата успяхте! Нов рунд след 1.2 сек…';
    setTimeout(generateRound, 1200);
  }
}

function applyHandToPlayer(playerKey, handedness, handLandmarks) {
  const values = handToClockValues(handLandmarks);
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

function onResults(results) {
  state.players.p1.hasHour = false;
  state.players.p1.hasMinute = false;
  state.players.p2.hasHour = false;
  state.players.p2.hasMinute = false;

  if (!results.multiHandLandmarks || !results.multiHandedness) {
    statusEl.textContent = 'Покажете ръце пред камерата.';
    updateReadouts();
    return;
  }

  const count = results.multiHandLandmarks.length;

  for (let i = 0; i < count; i += 1) {
    const landmarks = results.multiHandLandmarks[i];
    const handedness = results.multiHandedness[i].label;
    const centerX = landmarks.reduce((sum, point) => sum + point.x, 0) / landmarks.length;
    const playerKey = centerX < 0.5 ? 'p1' : 'p2';
    applyHandToPlayer(playerKey, handedness, landmarks);
  }

  const p1 = state.players.p1;
  const p2 = state.players.p2;
  statusEl.textContent = `Играч 1: ${p1.hasHour ? 'час ✓' : 'час …'}, ${p1.hasMinute ? 'минути ✓' : 'минути …'} | Играч 2: ${p2.hasHour ? 'час ✓' : 'час …'}, ${p2.hasMinute ? 'минути ✓' : 'минути …'}`;

  updateReadouts();
  checkWin();
}

async function init() {
  updateReadouts();
  generateRound();

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

document.getElementById('new-round').addEventListener('click', generateRound);

init().catch((error) => {
  console.error(error);
  statusEl.textContent = 'Грешка при достъп до камерата. Разрешете camera permissions.';
});
