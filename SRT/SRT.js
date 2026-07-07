// SRT.js
// Implements the Shortest Remaining Time (SRT) preemptive CPU scheduling
// algorithm and wires it up to the SRT.html page (input table, Gantt chart,
// results table, and average metrics).

(function () {
    "use strict";

    // ---- Sample scenario from the project spec ----
    const SAMPLE_PROCESSES = [
        { pid: "P1", arrival: 0, burst: 5 },
        { pid: "P2", arrival: 1, burst: 3 },
        { pid: "P3", arrival: 2, burst: 8 },
        { pid: "P4", arrival: 3, burst: 6 },
    ];

    // A fixed palette so each process gets a consistent, distinct color
    // across the Gantt chart blocks.
    const COLORS = [
        "#1e5fa8", "#c9612d", "#2d6a4f", "#8e44ad",
        "#c0392b", "#16a085", "#b8860b", "#5b6ee1",
    ];

    let rowCounter = 0;

    const tbody = document.getElementById("process-tbody");
    const addRowBtn = document.getElementById("add-row-btn");
    const resetBtn = document.getElementById("reset-btn");
    const runBtn = document.getElementById("run-btn");
    const errorMsg = document.getElementById("error-msg");

    const ganttChartEl = document.getElementById("gantt-chart");
    const ganttTicksEl = document.getElementById("gantt-ticks");
    const resultsTbody = document.getElementById("results-tbody");
    const avgWaitingEl = document.getElementById("avg-waiting");
    const avgTurnaroundEl = document.getElementById("avg-turnaround");
    const avgResponseEl = document.getElementById("avg-response");

    // ---------------------------------------------------------------
    // Row management (input table)
    // ---------------------------------------------------------------

    function addRow(pid, arrival, burst) {
        rowCounter++;
        const tr = document.createElement("tr");
        tr.dataset.rowId = String(rowCounter);

        const pidValue = pid !== undefined ? pid : "P" + rowCounter;
        const arrivalValue = arrival !== undefined ? arrival : 0;
        const burstValue = burst !== undefined ? burst : 1;

        tr.innerHTML =
            '<td><input type="text" class="pid-input" value="' + pidValue + '"></td>' +
            '<td><input type="number" min="0" class="arrival-input" value="' + arrivalValue + '"></td>' +
            '<td><input type="number" min="1" class="burst-input" value="' + burstValue + '"></td>' +
            '<td><button type="button" class="srt-btn btn-remove remove-row-btn">Remove</button></td>';

        tbody.appendChild(tr);

        tr.querySelector(".remove-row-btn").addEventListener("click", function () {
            tr.remove();
        });
    }

    function clearRows() {
        tbody.innerHTML = "";
    }

    function loadSampleScenario() {
        clearRows();
        SAMPLE_PROCESSES.forEach(function (p) {
            addRow(p.pid, p.arrival, p.burst);
        });
        errorMsg.textContent = "";
    }

    function readProcessesFromTable() {
        const rows = Array.from(tbody.querySelectorAll("tr"));
        const processes = [];
        const seenIds = new Set();

        for (const row of rows) {
            const pid = row.querySelector(".pid-input").value.trim();
            const arrival = parseInt(row.querySelector(".arrival-input").value, 10);
            const burst = parseInt(row.querySelector(".burst-input").value, 10);

            if (!pid) {
                throw new Error("Every process needs a non-empty Process ID.");
            }
            if (seenIds.has(pid)) {
                throw new Error('Duplicate Process ID "' + pid + '". IDs must be unique.');
            }
            seenIds.add(pid);

            if (Number.isNaN(arrival) || arrival < 0) {
                throw new Error('Process "' + pid + '" has an invalid Arrival Time.');
            }
            if (Number.isNaN(burst) || burst <= 0) {
                throw new Error('Process "' + pid + '" has an invalid Burst Time (must be > 0).');
            }

            processes.push({ pid: pid, arrival: arrival, burst: burst });
        }

        if (processes.length === 0) {
            throw new Error("Add at least one process before running the simulation.");
        }

        return processes;
    }

    // ---------------------------------------------------------------
    // SRT (Shortest Remaining Time, preemptive) simulation
    // ---------------------------------------------------------------

    function simulateSRT(inputProcesses) {
        // Work on internal copies so we never mutate the caller's data.
        const procs = inputProcesses.map(function (p, index) {
            return {
                pid: p.pid,
                order: index,           // used only for stable tie-breaking
                arrival: p.arrival,
                burst: p.burst,
                remaining: p.burst,
                firstStart: null,
                completion: null,
            };
        });

        const n = procs.length;
        let completed = 0;
        let time = Math.min.apply(null, procs.map(function (p) { return p.arrival; }));

        const gantt = []; // list of {pid, start, end}
        let lastPid = null;

        // Safety cap so a malformed input can never hang the browser.
        const totalBurst = procs.reduce(function (s, p) { return s + p.burst; }, 0);
        const maxTime = time + totalBurst + procs.length + 1000;

        while (completed < n && time < maxTime) {
            const available = procs.filter(function (p) {
                return p.arrival <= time && p.remaining > 0;
            });

            if (available.length === 0) {
                if (lastPid === "IDLE" && gantt.length > 0) {
                    gantt[gantt.length - 1].end = time + 1;
                } else {
                    gantt.push({ pid: "IDLE", start: time, end: time + 1 });
                }
                lastPid = "IDLE";
                time++;
                continue;
            }

            // Choose smallest remaining time; tie-break by earlier arrival,
            // then by original input order.
            available.sort(function (a, b) {
                if (a.remaining !== b.remaining) return a.remaining - b.remaining;
                if (a.arrival !== b.arrival) return a.arrival - b.arrival;
                return a.order - b.order;
            });

            const current = available[0];

            if (current.firstStart === null) {
                current.firstStart = time;
            }

            if (lastPid === current.pid && gantt.length > 0) {
                gantt[gantt.length - 1].end = time + 1;
            } else {
                gantt.push({ pid: current.pid, start: time, end: time + 1 });
            }

            current.remaining--;
            lastPid = current.pid;
            time++;

            if (current.remaining === 0) {
                current.completion = time;
                completed++;
            }
        }

        const results = procs.map(function (p) {
            const turnaround = p.completion - p.arrival;
            const waiting = turnaround - p.burst;
            const response = p.firstStart - p.arrival;
            return {
                pid: p.pid,
                arrival: p.arrival,
                burst: p.burst,
                completion: p.completion,
                turnaround: turnaround,
                waiting: waiting,
                response: response,
            };
        });

        const averages = {
            waiting: average(results.map(function (r) { return r.waiting; })),
            turnaround: average(results.map(function (r) { return r.turnaround; })),
            response: average(results.map(function (r) { return r.response; })),
        };

        return { gantt: gantt, results: results, averages: averages };
    }

    function average(arr) {
        if (arr.length === 0) return 0;
        const sum = arr.reduce(function (a, b) { return a + b; }, 0);
        return sum / arr.length;
    }

    // ---------------------------------------------------------------
    // Rendering
    // ---------------------------------------------------------------

    function colorForPid(pid, orderedPids) {
        const idx = orderedPids.indexOf(pid);
        return COLORS[idx % COLORS.length];
    }

    function renderGantt(gantt) {
        ganttChartEl.innerHTML = "";
        ganttTicksEl.innerHTML = "";

        if (gantt.length === 0) {
            ganttChartEl.innerHTML = '<span style="color:#777; padding: 0.75rem;">No schedule produced.</span>';
            return;
        }

        const orderedPids = [];
        gantt.forEach(function (block) {
            if (block.pid !== "IDLE" && orderedPids.indexOf(block.pid) === -1) {
                orderedPids.push(block.pid);
            }
        });

        const totalDuration = gantt[gantt.length - 1].end - gantt[0].start;
        const pxPerUnit = 36; // matches min-width of a gantt block

        gantt.forEach(function (block) {
            const duration = block.end - block.start;
            const div = document.createElement("div");
            div.className = "gantt-block" + (block.pid === "IDLE" ? " gantt-idle" : "");
            div.style.width = (duration * pxPerUnit) + "px";
            if (block.pid !== "IDLE") {
                div.style.background = colorForPid(block.pid, orderedPids);
            }
            div.innerHTML = '<span>' + block.pid + '</span>' +
                '<span style="font-weight:normal; font-size:0.65rem; opacity:0.85;">' +
                block.start + '–' + block.end + '</span>';
            ganttChartEl.appendChild(div);
        });

        // Timeline ticks under the chart, one per time unit boundary.
        const startTime = gantt[0].start;
        const endTime = gantt[gantt.length - 1].end;
        for (let t = startTime; t <= endTime; t++) {
            const tick = document.createElement("div");
            tick.className = "gantt-tick";
            tick.style.width = pxPerUnit + "px";
            tick.textContent = t;
            ganttTicksEl.appendChild(tick);
        }
        void totalDuration; // (kept for potential future proportional scaling)
    }

    function renderResults(results, averages) {
        resultsTbody.innerHTML = "";

        results
            .slice()
            .sort(function (a, b) { return a.pid.localeCompare(b.pid, undefined, { numeric: true }); })
            .forEach(function (r) {
                const tr = document.createElement("tr");
                tr.innerHTML =
                    "<td>" + r.pid + "</td>" +
                    "<td>" + r.arrival + "</td>" +
                    "<td>" + r.burst + "</td>" +
                    "<td>" + r.completion + "</td>" +
                    "<td>" + r.turnaround + "</td>" +
                    "<td>" + r.waiting + "</td>" +
                    "<td>" + r.response + "</td>";
                resultsTbody.appendChild(tr);
            });

        avgWaitingEl.textContent = averages.waiting.toFixed(2);
        avgTurnaroundEl.textContent = averages.turnaround.toFixed(2);
        avgResponseEl.textContent = averages.response.toFixed(2);
    }

    // ---------------------------------------------------------------
    // Event wiring
    // ---------------------------------------------------------------

    function runSimulation() {
        errorMsg.textContent = "";
        let processes;
        try {
            processes = readProcessesFromTable();
        } catch (err) {
            errorMsg.textContent = err.message;
            return;
        }

        const { gantt, results, averages } = simulateSRT(processes);
        renderGantt(gantt);
        renderResults(results, averages);
    }

    addRowBtn.addEventListener("click", function () {
        addRow();
    });

    resetBtn.addEventListener("click", function () {
        loadSampleScenario();
        resultsTbody.innerHTML = '<tr><td colspan="7" style="color:#777;">No results yet.</td></tr>';
        avgWaitingEl.textContent = "-";
        avgTurnaroundEl.textContent = "-";
        avgResponseEl.textContent = "-";
        ganttChartEl.innerHTML = '<span style="color:#777; padding: 0.75rem;">Run the simulation to see the Gantt chart.</span>';
        ganttTicksEl.innerHTML = "";
    });

    runBtn.addEventListener("click", runSimulation);

    // Initialize the page with the sample scenario pre-loaded.
    document.addEventListener("DOMContentLoaded", function () {
        loadSampleScenario();
    });

    // In case this script runs after DOMContentLoaded already fired
    // (e.g., due to the `defer` attribute timing), initialize immediately
    // if the tbody is empty.
    if (document.readyState !== "loading" && tbody.children.length === 0) {
        loadSampleScenario();
    }
})();
