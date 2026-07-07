/**
 * RR.js
 * ---------------------------------------------------------
 * Round Robin CPU Scheduling Algorithm (preemptive, fixed time quantum)
 *
 * RoundRobin.buildTrace(processes, quantum) -> {
 *   initialQueue: [{ pid, remaining }],   // who's waiting before anything runs
 *   steps: [{
 *     type: 'run' | 'idle',
 *     pid, start, end,
 *     queueSnapshot: [{ pid, remaining }], // wait queue *after* this step
 *     newlyCompleted: pid | null
 *   }],
 *   table:    [{ pid, arrival, burst, completion, waitingTime, turnaroundTime, responseTime }],
 *   averages: { waitingTime, turnaroundTime, responseTime }
 * }
 * ---------------------------------------------------------
 */
(function (global) {
  "use strict";

  function buildTrace(processes, quantum) {
    if (!Array.isArray(processes) || processes.length === 0) {
      throw new Error("RoundRobin.buildTrace: 'processes' must be a non-empty array.");
    }
    if (!Number.isFinite(quantum) || quantum <= 0) {
      throw new Error("RoundRobin.buildTrace: 'quantum' must be a positive number.");
    }

    const procs = processes
      .map((p, idx) => ({
        pid: p.pid,
        arrival: p.arrival,
        burst: p.burst,
        remaining: p.burst,
        firstStart: null,
        completion: null,
        originalIndex: idx,
      }))
      .sort((a, b) => a.arrival - b.arrival || a.originalIndex - b.originalIndex);

    const n = procs.length;
    const steps = [];
    const readyQueue = [];
    const arrivedIndexSet = new Set();

    let time = procs[0].arrival;
    let completedCount = 0;

    function enqueueArrivals(atTime) {
      const justArrived = procs
        .filter((p) => !arrivedIndexSet.has(p.originalIndex) && p.arrival <= atTime)
        .sort((a, b) => a.arrival - b.arrival || a.originalIndex - b.originalIndex);
      justArrived.forEach((p) => {
        arrivedIndexSet.add(p.originalIndex);
        readyQueue.push(p);
      });
    }

    function snapshot() {
      return readyQueue.map((p) => ({ pid: p.pid, remaining: p.remaining }));
    }

    enqueueArrivals(time);
    const initialQueue = snapshot();

    while (completedCount < n) {
      if (readyQueue.length === 0) {
        const nextArrival = procs
          .filter((p) => !arrivedIndexSet.has(p.originalIndex))
          .reduce((min, p) => Math.min(min, p.arrival), Infinity);

        if (nextArrival === Infinity) break;

        const idleStart = time;
        if (nextArrival > time) time = nextArrival;
        enqueueArrivals(time);

        steps.push({
          type: "idle",
          pid: "Idle",
          start: idleStart,
          end: time,
          queueSnapshot: snapshot(),
          newlyCompleted: null,
        });
        continue;
      }

      const current = readyQueue.shift();
      if (current.firstStart === null) current.firstStart = time;

      const runFor = Math.min(quantum, current.remaining);
      const startTime = time;
      const endTime = time + runFor;

      current.remaining -= runFor;
      time = endTime;

      enqueueArrivals(time);

      let newlyCompleted = null;
      if (current.remaining > 0) {
        readyQueue.push(current);
      } else {
        current.completion = time;
        completedCount += 1;
        newlyCompleted = current.pid;
      }

      steps.push({
        type: "run",
        pid: current.pid,
        start: startTime,
        end: endTime,
        queueSnapshot: snapshot(),
        newlyCompleted,
      });
    }

    const table = procs
      .slice()
      .sort((a, b) => a.originalIndex - b.originalIndex)
      .map((p) => {
        const turnaroundTime = p.completion - p.arrival;
        const waitingTime = turnaroundTime - p.burst;
        const responseTime = p.firstStart - p.arrival;
        return {
          pid: p.pid,
          arrival: p.arrival,
          burst: p.burst,
          completion: p.completion,
          waitingTime,
          turnaroundTime,
          responseTime,
        };
      });

    const averages = {
      waitingTime: average(table.map((r) => r.waitingTime)),
      turnaroundTime: average(table.map((r) => r.turnaroundTime)),
      responseTime: average(table.map((r) => r.responseTime)),
    };

    return { initialQueue, steps, table, averages };
  }

  function average(nums) {
    if (nums.length === 0) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    return Math.round((sum / nums.length) * 100) / 100;
  }

  const RoundRobin = { buildTrace };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = RoundRobin;
  } else {
    global.RoundRobin = RoundRobin;
  }
})(typeof window !== "undefined" ? window : globalThis);


(function () {
  "use strict";

  const processBody = document.getElementById("processBody");
  const errorMsg = document.getElementById("errorMsg");
  const PALETTE = ["#5b8cff", "#ff9f5b", "#4cd18a", "#ff6b6b", "#c792ea", "#f4d35e", "#4dd0e1", "#f78fb3"];
  const colorMap = {};

  // Stepping state
  let trace = null;
  let stepIndex = 0;
  let completedRows = []; // table rows for processes that have finished so far, in completion order
  let playTimer = null;

  function colorFor(pid) {
    if (!colorMap[pid]) {
      const idx = Object.keys(colorMap).length % PALETTE.length;
      colorMap[pid] = PALETTE[idx];
    }
    return colorMap[pid];
  }

  function addRow(pid, arrival, burst) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="text" class="pid-input" value="${pid}" /></td>
      <td><input type="number" class="arrival-input" min="0" step="1" value="${arrival}" /></td>
      <td><input type="number" class="burst-input" min="1" step="1" value="${burst}" /></td>
      <td class="row-actions"><button title="Remove">✕</button></td>
    `;
    tr.querySelector("button").addEventListener("click", () => {
      tr.remove();
    });
    processBody.appendChild(tr);
  }

  function loadSample() {
    processBody.innerHTML = "";
    addRow("P1", 0, 5);
    addRow("P2", 1, 3);
    addRow("P3", 2, 8);
    addRow("P4", 3, 6);
    document.getElementById("quantumInput").value = 2;
  }

  function readProcesses() {
    const rows = Array.from(processBody.querySelectorAll("tr"));
    const processes = rows.map((row) => ({
      pid: row.querySelector(".pid-input").value.trim(),
      arrival: Number(row.querySelector(".arrival-input").value),
      burst: Number(row.querySelector(".burst-input").value),
    }));

    if (processes.length === 0) throw new Error("Add at least one process.");
    for (const p of processes) {
      if (!p.pid) throw new Error("Every process needs a PID.");
      if (!Number.isFinite(p.arrival) || p.arrival < 0) throw new Error(`Invalid arrival time for ${p.pid}.`);
      if (!Number.isFinite(p.burst) || p.burst <= 0) throw new Error(`Invalid burst time for ${p.pid}.`);
    }
    const pids = processes.map((p) => p.pid);
    if (new Set(pids).size !== pids.length) throw new Error("PIDs must be unique.");

    return processes;
  }

  // ---- Rendering -------------------------------------------------------

  function renderGanttUpTo(idx) {
    const ganttEl = document.getElementById("gantt");
    const ticksEl = document.getElementById("ganttTicks");
    ganttEl.innerHTML = "";
    ticksEl.innerHTML = "";

    const shown = trace ? trace.steps.slice(0, idx) : [];
    if (shown.length === 0) return;

    const totalSpan = shown[shown.length - 1].end - shown[0].start;
    const pxPerUnit = totalSpan > 0 ? Math.max(24, Math.min(60, 900 / totalSpan)) : 40;

    shown.forEach((seg) => {
      const width = (seg.end - seg.start) * pxPerUnit;
      const block = document.createElement("div");
      block.className = "gantt-block" + (seg.pid === "Idle" ? " gantt-idle" : "");
      block.style.width = width + "px";
      if (seg.pid !== "Idle") block.style.background = colorFor(seg.pid);
      block.textContent = seg.pid;
      block.title = `${seg.pid}: ${seg.start} → ${seg.end}`;
      ganttEl.appendChild(block);

      const tick = document.createElement("div");
      tick.className = "gantt-tick";
      tick.style.width = width + "px";
      tick.textContent = seg.start;
      ticksEl.appendChild(tick);
    });

    const lastTick = document.createElement("div");
    lastTick.textContent = shown[shown.length - 1].end;
    lastTick.style.marginLeft = "2px";
    ticksEl.appendChild(lastTick);
  }

  function renderQueue(queueItems, upNextPid) {
    const el = document.getElementById("waitQueue");
    el.innerHTML = "";
    if (!queueItems || queueItems.length === 0) {
      const empty = document.createElement("span");
      empty.className = "queue-empty";
      empty.textContent = "— nothing waiting —";
      el.appendChild(empty);
      return;
    }
    queueItems.forEach((item, i) => {
      const chip = document.createElement("div");
      chip.className = "queue-chip" + (i === 0 && item.pid === upNextPid ? " queue-chip-next" : "");
      chip.style.borderColor = colorFor(item.pid);
      chip.innerHTML = `<span class="pid-swatch" style="background:${colorFor(item.pid)}"></span>${item.pid} <span class="queue-remaining">(${item.remaining} left)</span>`;
      el.appendChild(chip);
    });
  }

  function renderTable() {
    const body = document.getElementById("resultsBody");
    body.innerHTML = "";
    completedRows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="pid-swatch" style="background:${colorFor(row.pid)}"></span>${row.pid}</td>
        <td>${row.arrival}</td>
        <td>${row.burst}</td>
        <td>${row.completion}</td>
        <td>${row.waitingTime}</td>
        <td>${row.turnaroundTime}</td>
        <td>${row.responseTime}</td>
      `;
      body.appendChild(tr);
    });
  }

  function renderAverages() {
    if (completedRows.length === 0) {
      document.getElementById("avgWait").textContent = "–";
      document.getElementById("avgTurn").textContent = "–";
      document.getElementById("avgResp").textContent = "–";
      return;
    }
    const avg = (key) =>
      Math.round((completedRows.reduce((s, r) => s + r[key], 0) / completedRows.length) * 100) / 100;
    document.getElementById("avgWait").textContent = avg("waitingTime");
    document.getElementById("avgTurn").textContent = avg("turnaroundTime");
    document.getElementById("avgResp").textContent = avg("responseTime");
  }

  function renderStatus() {
    const statusEl = document.getElementById("stepStatus");
    if (!trace) {
      statusEl.textContent = "Click \"Start Simulation\" to begin.";
      return;
    }
    const total = trace.steps.length;
    const time = stepIndex === 0 ? trace.steps[0]?.start ?? 0 : trace.steps[stepIndex - 1].end;
    if (stepIndex >= total) {
      statusEl.textContent = `Done — all ${total} steps complete at t = ${time}.`;
    } else {
      const upNext = trace.steps[stepIndex];
      statusEl.textContent = `Step ${stepIndex} / ${total} · t = ${time} · up next: ${upNext.pid === "Idle" ? "CPU idle" : upNext.pid}`;
    }
  }

  function updateButtons() {
    const total = trace ? trace.steps.length : 0;
    const done = !trace || stepIndex >= total;
    document.getElementById("nextBtn").disabled = done || !!playTimer;
    document.getElementById("playAllBtn").disabled = done || !!playTimer;
  }

  // ---- Stepping control --------------------------------------------------

  function startSimulation() {
    stopPlaying();
    errorMsg.textContent = "";
    try {
      const processes = readProcesses();
      const quantum = Number(document.getElementById("quantumInput").value);
      if (!Number.isFinite(quantum) || quantum <= 0) {
        throw new Error("Time quantum must be a positive number.");
      }
      trace = RoundRobin.buildTrace(processes, quantum);
      stepIndex = 0;
      completedRows = [];

      renderGanttUpTo(0);
      renderQueue(trace.initialQueue, trace.steps[0] && trace.steps[0].pid);
      renderTable();
      renderAverages();
      renderStatus();
      updateButtons();
    } catch (err) {
      trace = null;
      errorMsg.textContent = err.message;
      renderGanttUpTo(0);
      renderQueue([]);
      renderTable();
      renderAverages();
      renderStatus();
      updateButtons();
    }
  }

  function doNextStep() {
    if (!trace || stepIndex >= trace.steps.length) return false;

    const step = trace.steps[stepIndex];
    stepIndex += 1;

    if (step.newlyCompleted) {
      const row = trace.table.find((r) => r.pid === step.newlyCompleted);
      if (row) completedRows.push(row);
    }

    renderGanttUpTo(stepIndex);
    const upNext = stepIndex < trace.steps.length ? trace.steps[stepIndex].pid : null;
    renderQueue(step.queueSnapshot, upNext);
    renderTable();
    renderAverages();
    renderStatus();
    updateButtons();

    return stepIndex < trace.steps.length;
  }

  function stopPlaying() {
    if (playTimer) {
      clearInterval(playTimer);
      playTimer = null;
    }
  }

  function playAll() {
    if (!trace || stepIndex >= trace.steps.length) return;
    stopPlaying();
    updateButtons();
    playTimer = setInterval(() => {
      const more = doNextStep();
      if (!more) stopPlaying();
    }, 450);
  }

  document.getElementById("addRowBtn").addEventListener("click", () => addRow("", 0, 1));
  document.getElementById("loadSampleBtn").addEventListener("click", () => {
    stopPlaying();
    loadSample();
  });
  document.getElementById("startBtn").addEventListener("click", startSimulation);
  document.getElementById("nextBtn").addEventListener("click", doNextStep);
  document.getElementById("playAllBtn").addEventListener("click", playAll);

  // Initialize with the sample scenario from the project spec.
  loadSample();
  startSimulation();
})();