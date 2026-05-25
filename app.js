let dbConfig = {};
let dbFichas = {};
let currentWorkout = [];
let currentFichaData = {};
let session = 1;
let exerciseIdx = 0;
let timeLeft = 5;
let phaseDuration = 5;
let isResting = false;
let isSessionRest = false;
let isPreparing = true;
let isPaused = false;
let timerInterval;
let selectedFicha = "";

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playBeep(freq, duration, type = "sine") {
  if (audioCtx.state === "suspended") audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(
    0.0001,
    audioCtx.currentTime + duration,
  );
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function carregarTreinos() {
  fetch("treinos.json")
    .then((res) => res.json())
    .then((data) => {
      dbConfig = data.config;
      dbFichas = data.fichas;
      renderizarMenu();
    })
    .catch((err) => {
      console.error("Erro ao ler treinos.json:", err);
      document.getElementById("menu-dynamic-btns").innerHTML =
        "<p style='color:red'>Erro ao carregar treinos.</p>";
    });
}

function renderizarMenu() {
  const menuContainer = document.getElementById("menu-dynamic-btns");
  menuContainer.innerHTML = "";

  Object.keys(dbFichas).forEach((key) => {
    const btn = document.createElement("button");
    btn.className = "btn-choice";
    btn.innerText = dbFichas[key].nome;
    btn.onclick = () => showList(key);
    menuContainer.appendChild(btn);
  });
}

function showList(type) {
  selectedFicha = type;
  currentFichaData = dbFichas[type];
  currentWorkout = currentFichaData.exercicios;

  document.getElementById("selection-screen").style.display = "none";
  document.getElementById("list-screen").style.display = "block";

  const ap = currentFichaData.apresentacao || {};
  const icone = ap.icone || "";
  const descricao = ap.descricao || "";
  const nivel = ap.nivel || "";

  document.getElementById("list-icone").innerText = icone;
  document.getElementById("list-title").innerText = currentFichaData.nome.replace(/^[\S]+\s/, "");
  document.getElementById("list-descricao").innerText = descricao;
  document.getElementById("list-descricao").style.display = descricao ? "block" : "none";

  // Stats
  const tempoAtiv = currentFichaData.tipo === "cardio"
    ? currentFichaData.tempoRitmoNormal
    : currentFichaData.tempoAtividade;
  const tempoDesc = currentFichaData.tipo === "cardio"
    ? currentFichaData.tempoCaminhada
    : currentFichaData.tempoDescanso;

  document.getElementById("stat-exercicios").innerText = currentWorkout.length;
  document.getElementById("stat-voltas").innerText = dbConfig.voltasTotal + "x";
  document.getElementById("stat-atividade").innerText = tempoAtiv + "s";
  document.getElementById("stat-descanso").innerText = tempoDesc + "s";

  // Badges
  const tipoBadge = document.getElementById("ficha-tipo-badge");
  tipoBadge.innerText = currentFichaData.tipo === "cardio" ? "🫀 Cardio" : "🏋️ Funcional";
  tipoBadge.className = "ficha-tipo-badge tipo-" + currentFichaData.tipo;

  const nivelBadge = document.getElementById("ficha-nivel-badge");
  nivelBadge.innerText = nivel;
  nivelBadge.style.display = nivel ? "inline-block" : "none";
  const nivelClass = { "Iniciante": "nivel-iniciante", "Intermediário": "nivel-intermediario", "Avançado": "nivel-avancado" };
  nivelBadge.className = "ficha-nivel-badge " + (nivelClass[nivel] || "");

  // Exercise list
  const ul = document.getElementById("exercise-ul");
  ul.innerHTML = "";
  currentWorkout.forEach((ex, i) => {
    const li = document.createElement("li");
    li.innerHTML = `<span class="ex-num">${i + 1}</span><span>${ex}</span>`;
    ul.appendChild(li);
  });
}

function goBack() {
  document.getElementById("list-screen").style.display = "none";
  document.getElementById("selection-screen").style.display = "block";
}

function startCountdown() {
  document.getElementById("list-screen").style.display = "none";
  document.getElementById("timer-screen").style.display = "block";
  document.getElementById("current-ficha-header").innerText =
    "FICHA " + selectedFicha;
  document.getElementById("total-ex-num").innerText = currentWorkout.length;
  document.getElementById("current-session").parentElement.innerHTML =
    "VOLTA: <span id='current-session'>1</span>/" + dbConfig.voltasTotal;

  isPreparing = true;
  isPaused = false;
  session = 1;
  exerciseIdx = 0;
  timeLeft = dbConfig.preparo;
  phaseDuration = dbConfig.preparo;
  runTimer();
}

function getTempoAtividade() {
  if (currentFichaData.tipo === "cardio") {
    return currentFichaData.tempoRitmoNormal;
  }
  return currentFichaData.tempoAtividade;
}

function getTempoDescanso() {
  if (currentFichaData.tipo === "cardio") {
    return currentFichaData.tempoCaminhada;
  }
  return currentFichaData.tempoDescanso;
}

function getLabelWork() {
  if (currentFichaData.labels && currentFichaData.labels.work) {
    return currentFichaData.labels.work;
  }
  return dbConfig.labels.work;
}

function getLabelRest() {
  if (currentFichaData.labels && currentFichaData.labels.rest) {
    return currentFichaData.labels.rest;
  }
  return dbConfig.labels.rest;
}

function runTimer() {
  updateDisplay();
  timerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 3 && timeLeft > 0) playBeep(440, 0.1);
    if (timeLeft < 0) {
      handleTransition();
    }
    updateDisplay();
  }, 1000);
}

function handleTransition() {
  if (isPreparing) {
    isPreparing = false;
    timeLeft = getTempoAtividade();
    phaseDuration = timeLeft;
    playBeep(880, 0.5);
    return;
  }

  if (isSessionRest) {
    isSessionRest = false;
    isResting = false;
    exerciseIdx = 0;
    timeLeft = getTempoAtividade();
    phaseDuration = timeLeft;
    playBeep(880, 0.8);
  } else if (!isResting) {
    if (exerciseIdx === currentWorkout.length - 1) {
      session++;
      if (session > dbConfig.voltasTotal) {
        finishWorkout();
        return;
      }
      isSessionRest = true;
      timeLeft = dbConfig.descansoEntreVoltas;
      phaseDuration = timeLeft;
      playBeep(660, 1);
    } else if (currentFichaData.tipo === "cardio") {
      // Cardio: sem fase de descanso — avança direto para o próximo exercício
      exerciseIdx++;
      timeLeft = getTempoAtividade();
      phaseDuration = timeLeft;
      playBeep(880, 0.5);
    } else {
      isResting = true;
      timeLeft = getTempoDescanso();
      phaseDuration = timeLeft;
      playBeep(330, 0.5);
    }
  } else {
    isResting = false;
    exerciseIdx++;
    timeLeft = getTempoAtividade();
    phaseDuration = timeLeft;
    playBeep(880, 0.5);
  }
}

function updateDisplay() {
  const timerVisual = document.getElementById("timer-visual");
  const statusLabel = document.getElementById("status-label");
  const timeDisplay = document.getElementById("time-left");
  const exDisplay = document.getElementById("exercise-display");
  const labels = dbConfig.labels;

  timeDisplay.innerText = timeLeft;
  document.getElementById("current-session").innerText = Math.min(
    session,
    dbConfig.voltasTotal,
  );
  document.getElementById("current-ex-num").innerText = Math.min(
    exerciseIdx + 1,
    currentWorkout.length,
  );

  if (isPreparing) {
    statusLabel.innerText = labels.preparar;
    exDisplay.innerText = labels.comecarEm;
    timerVisual.className = "timer-circle preparing";
  } else if (isSessionRest) {
    statusLabel.innerText = labels.volta;
    exDisplay.innerText = labels.descansoLongo;
    timerVisual.className = "timer-circle session-rest";
  } else if (isResting) {
    statusLabel.innerText = getLabelRest();
    exDisplay.innerText = labels.proximo + currentWorkout[exerciseIdx + 1];
    timerVisual.className = "timer-circle resting";
  } else {
    statusLabel.innerText = getLabelWork();
    exDisplay.innerText = currentWorkout[exerciseIdx];
    timerVisual.className = "timer-circle working";
  }

  updateProgressBar();
}

function togglePause() {
  isPaused = !isPaused;
  const btn = document.getElementById("btn-pause");
  if (isPaused) {
    clearInterval(timerInterval);
    btn.innerText = "Retomar";
    btn.classList.add("paused");
  } else {
    btn.innerText = "Pausar";
    btn.classList.remove("paused");
    runTimer();
  }
}

function cancelWorkout() {
  if (confirm("Cancelar o treino atual?")) {
    location.reload();
  }
}

function repeatWorkout() {
  clearInterval(timerInterval);
  isPaused = false;
  isResting = false;
  isSessionRest = false;
  isPreparing = true;
  session = 1;
  exerciseIdx = 0;
  timeLeft = dbConfig.preparo;
  phaseDuration = dbConfig.preparo;
  document.getElementById("btn-pause").innerText = "Pausar";
  document.getElementById("btn-pause").classList.remove("paused");
  document.getElementById("current-session").parentElement.innerHTML =
    "VOLTA: <span id='current-session'>1</span>/" + dbConfig.voltasTotal;
  runTimer();
}

function updateProgressBar() {
  const elapsed = phaseDuration - timeLeft;
  const pct = phaseDuration > 0 ? Math.min(elapsed / phaseDuration, 1) : 0;
  const bar = document.getElementById("progress-bar-fill");
  if (!bar) return;

  // Interpolate color: red (0%) → yellow (50%) → green (100%)
  let r, g, b;
  if (pct < 0.5) {
    const t = pct / 0.5;
    r = 231;
    g = Math.round(76 + t * (193 - 76));
    b = 60;
  } else {
    const t = (pct - 0.5) / 0.5;
    r = Math.round(231 + t * (39 - 231));
    g = Math.round(193 + t * (174 - 193));
    b = Math.round(60 + t * (96 - 60));
  }
  bar.style.width = pct * 100 + "%";
  bar.style.background = `rgb(${r},${g},${b})`;
}

function finishWorkout() {
  clearInterval(timerInterval);
  playBeep(880, 0.2);
  setTimeout(() => playBeep(1100, 0.5), 200);
  alert("Treino Concluído com Sucesso!");
  location.reload();
  return null;
}

window.onload = carregarTreinos;
