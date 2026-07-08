/**
 * MLFQ.js
 * ---------------------------------------------------------
 * Multilevel Feedback Queue CPU Scheduling Algorithm
 * 3 levels: Queue 0 (RR, quantum q0) -> Queue 1 (RR, quantum q1) -> Queue 2 (FCFS)
 *
 * MLFQ.buildTrace(processes, config) -> {
 *   initialQueues: [ [{pid, remaining}], [...], [...] ], // 3 queues, before anything runs
 *   steps: [{
 *     type: 'run' | 'idle',
 *     pid, start, end, queueLevel,      // which queue (0/1/2) it ran from, null if idle
 *     queueSnapshots: [ [...], [...], [...] ],  // state of all 3 queues *after* this step
 *     event: 'demoted' | 'promoted' | 'completed' | null,
 *   }],
 *   table:    [{ pid, arrival, burst, completion, waitingTime, turnaroundTime, responseTime }],
 *   averages: { waitingTime, turnaroundTime, responseTime }
 * }
 *
 * config = { quantums: [q0, q1], agingThreshold: number }
 *   - quantums[0] = time slice for Queue 0 (top)
 *   - quantums[1] = time slice for Queue 1 (mid)
 *   - Queue 2 (bottom) is FCFS, no quantum
 *   - agingThreshold = ticks a process can wait without running before being promoted 1 level
 * ---------------------------------------------------------
 */
(function (global) {
  "use strict";

  const DEFAULT_AGING_THRESHOLD = 8;

  function buildTrace(processes, config) {
    if (!Array.isArray(processes) || processes.length === 0) {
      throw new Error("MLFQ.buildTrace: 'processes' must be a non-empty array.");
    }
    const quantums = (config && config.quantums) || [2, 4];
    if (quantums.length < 2 || quantums.some((q) => !Number.isFinite(q) || q <= 0)) {
      throw new Error("MLFQ.buildTrace: 'config.quantums' must be [q0, q1], both positive.");
    }
    const agingThreshold =
      config && Number.isFinite(config.agingThreshold) && config.agingThreshold > 0
        ? config.agingThreshold
        : DEFAULT_AGING_THRESHOLD;

    // Internal process state
    const procs = processes.map((p, idx) => ({
      pid: p.pid,
      arrival: p.arrival,
      burst: p.burst,
      remaining: p.burst,
      originalIndex: idx,
      currentQueue: 0,
      quantumUsed: 0,       // progress within current quantum slice (levels 0/1 only)
      lastServiceTime: p.arrival, // last tick this process ran, or its arrival if never run
      firstStart: null,
      completion: null,
    }));

    const n = procs.length;
    const queues = [[], [], []]; // arrays of process refs, FIFO order
    const arrivedSet = new Set();

    let time = Math.min(...procs.map((p) => p.arrival));
    let completedCount = 0;

    function enqueueArrivals(atTime) {
      procs
        .filter((p) => !arrivedSet.has(p.originalIndex) && p.arrival <= atTime)
        .sort((a, b) => a.arrival - b.arrival || a.originalIndex - b.originalIndex)
        .forEach((p) => {
          arrivedSet.add(p.originalIndex);
          queues[0].push(p);
        });
    }

    function snapshot() {
      return queues.map((q) => q.map((p) => ({ pid: p.pid, remaining: p.remaining })));
    }

    function removeFromQueue(level, proc) {
      const idx = queues[level].indexOf(proc);
      if (idx !== -1) queues[level].splice(idx, 1);
    }

    function applyAging(currentPid) {
      // Check queues 1 and 2 for anyone who has waited too long without running.
      // Promote at most one step per process per tick; walk from lowest queue up
      // so a chain-promotion in one tick still respects one-level-at-a-time.
      for (let level = 2; level >= 1; level--) {
        const waiting = queues[level].filter((p) => p.pid !== currentPid);
        waiting.forEach((p) => {
          if (time - p.lastServiceTime >= agingThreshold) {
            removeFromQueue(level, p);
            p.currentQueue = level - 1;
            p.quantumUsed = 0;
            p.lastServiceTime = time; // reset the clock so it doesn't re-age instantly
            queues[level - 1].push(p);
          }
        });
      }
    }

    enqueueArrivals(time);
    const initialQueues = snapshot();

    const steps = [];
    let runningPid = null; // pid running on the previous tick, to coalesce gantt blocks

    while (completedCount < n) {
      enqueueArrivals(time);
      applyAging(runningPid);

      // Peek highest-priority nonempty queue
      const level = queues.findIndex((q) => q.length > 0);

      if (level === -1) {
        // CPU idle: nobody has arrived yet
        const nextArrival = Math.min(
          ...procs.filter((p) => !arrivedSet.has(p.originalIndex)).map((p) => p.arrival)
        );
        const idleStart = time;
        time = nextArrival;
        enqueueArrivals(time);
        steps.push({
          type: "idle",
          pid: "Idle",
          start: idleStart,
          end: time,
          queueLevel: null,
          queueSnapshots: snapshot(),
          event: null,
        });
        runningPid = null;
        continue;
      }

      const current = queues[level][0]; // peek, don't pop yet
      if (current.firstStart === null) current.firstStart = time;

      // Run for 1 tick
      current.remaining -= 1;
      current.lastServiceTime = time + 1;
      if (level < 2) current.quantumUsed += 1;
      time += 1;

      let event = null;

      if (current.remaining === 0) {
        // Finished
        removeFromQueue(level, current);
        current.completion = time;
        completedCount += 1;
        event = "completed";
        runningPid = null;
      } else if (level < 2 && current.quantumUsed >= quantums[level]) {
        // Used up its quantum at Queue 0 or 1 -> demote
        removeFromQueue(level, current);
        current.currentQueue = level + 1;
        current.quantumUsed = 0;
        queues[level + 1].push(current);
        event = "demoted";
        runningPid = null; // next tick starts a fresh dispatch even if same pid gets picked again
      } else {
        // Still has work left, still within its slice (or FCFS at level 2) -> stays at front
        runningPid = current.pid;
      }

      // Coalesce into gantt blocks: extend previous step if same pid+level ran contiguously
      const prev = steps[steps.length - 1];
      if (
        prev &&
        prev.type === "run" &&
        prev.pid === current.pid &&
        prev.queueLevel === level &&
        prev.end === time - 1 &&
        !event // don't merge across a demotion/completion boundary
      ) {
        prev.end = time;
        prev.queueSnapshots = snapshot();
        if (event) prev.event = event;
      } else {
        steps.push({
          type: "run",
          pid: current.pid,
          start: time - 1,
          end: time,
          queueLevel: level,
          queueSnapshots: snapshot(),
          event: event,
        });
      }
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

    return { initialQueues, steps, table, averages, config: { quantums, agingThreshold } };
  }

  function average(nums) {
    if (nums.length === 0) return 0;
    const sum = nums.reduce((a, b) => a + b, 0);
    return Math.round((sum / nums.length) * 100) / 100;
  }

  const MLFQ = { buildTrace, DEFAULT_AGING_THRESHOLD };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = MLFQ;
  } else {
    global.MLFQ = MLFQ;
  }
})(typeof window !== "undefined" ? window : globalThis);


(function () {
  "use strict";

  const processBody = document.getElementById("processBody");
  const errorMsg = document.getElementById("errorMsg");
  const PALETTE = ["#5b8cff", "#ff9f5b", "#4cd18a", "#ff6b6b", "#c792ea", "#f4d35e", "#4dd0e1", "#f78fb3"];
  const QUEUE_COLORS = ["#5b8cff", "#ff9f5b", "#4cd18a"]; // matches --mlfq-q0/q1/q2
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
    document.getElementById("quantum0Input").value = 2;
    document.getElementById("quantum1Input").value = 4;
    document.getElementById("agingInput").value = 8;
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
      const qLabel = seg.pid !== "Idle" ? `<div class="qtag">Q${seg.queueLevel}</div>` : "";
      block.innerHTML = `<div>${seg.pid}</div>${qLabel}`;
      block.title = `${seg.pid}: ${seg.start} → ${seg.end}${seg.event ? " (" + seg.event + ")" : ""}`;
      ganttEl.appendChild(block);

      const tick = document.createElement("div");
      tick.className = "gantt-tick";
      tick.style.width = width + "px";
      tick.textContent = seg.start;
      ticksEl.appendChild(tick);
    });

    const lastTick = document.createElement("div");
    lastTick.className = "gantt-tick";
    lastTick.style.width = "0px";
    lastTick.style.minWidth = "0px";
    lastTick.style.flex = "0 0 0px";
    lastTick.style.overflow = "visible";
    lastTick.textContent = shown[shown.length - 1].end;
    ticksEl.appendChild(lastTick);
  }

  function renderQueueLevel(containerId, items, isNextLevel, upNextPid) {
    const el = document.getElementById(containerId);
    el.innerHTML = "";
    if (!items || items.length === 0) {
      const empty = document.createElement("span");
      empty.className = "queue-empty";
      empty.textContent = "— empty —";
      el.appendChild(empty);
      return;
    }
    items.forEach((item, i) => {
      const chip = document.createElement("div");
      const isNext = isNextLevel && i === 0 && item.pid === upNextPid;
      chip.className = "queue-chip" + (isNext ? " queue-chip-next" : "");
      chip.style.borderColor = colorFor(item.pid);
      chip.innerHTML = `<span class="pid-swatch" style="background:${colorFor(item.pid)}"></span>${item.pid} <span class="queue-remaining">(${item.remaining} left)</span>`;
      el.appendChild(chip);
    });
  }

  function renderQueues(queueSnapshots, upNextPid, upNextLevel) {
    const snaps = queueSnapshots || [[], [], []];
    renderQueueLevel("queueLevel0", snaps[0], upNextLevel === 0, upNextPid);
    renderQueueLevel("queueLevel1", snaps[1], upNextLevel === 1, upNextPid);
    renderQueueLevel("queueLevel2", snaps[2], upNextLevel === 2, upNextPid);
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
      const label = upNext.pid === "Idle" ? "CPU idle" : `${upNext.pid} (Q${upNext.queueLevel})`;
      statusEl.textContent = `Step ${stepIndex} / ${total} · t = ${time} · up next: ${label}`;
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
      const quantum0 = Number(document.getElementById("quantum0Input").value);
      const quantum1 = Number(document.getElementById("quantum1Input").value);
      const agingThreshold = Number(document.getElementById("agingInput").value);
      if (!Number.isFinite(quantum0) || quantum0 <= 0 || !Number.isFinite(quantum1) || quantum1 <= 0) {
        throw new Error("Both time quantums must be positive numbers.");
      }
      if (!Number.isFinite(agingThreshold) || agingThreshold <= 0) {
        throw new Error("Aging threshold must be a positive number.");
      }
      trace = MLFQ.buildTrace(processes, { quantums: [quantum0, quantum1], agingThreshold });
      stepIndex = 0;
      completedRows = [];

      renderGanttUpTo(0);
      const firstStep = trace.steps[0];
      renderQueues(trace.initialQueues, firstStep && firstStep.pid, firstStep && firstStep.queueLevel);
      renderTable();
      renderAverages();
      renderStatus();
      updateButtons();
    } catch (err) {
      trace = null;
      errorMsg.textContent = err.message;
      renderGanttUpTo(0);
      renderQueues([[], [], []], null, null);
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

    if (step.event === "completed") {
      const row = trace.table.find((r) => r.pid === step.pid);
      if (row) completedRows.push(row);
    }

    renderGanttUpTo(stepIndex);
    const upNext = stepIndex < trace.steps.length ? trace.steps[stepIndex] : null;
    renderQueues(step.queueSnapshots, upNext && upNext.pid, upNext && upNext.queueLevel);
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