const processes = [];
const colors = [
    '#3b82f6', // blue
    '#8b5cf6', // purple
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f43f5e', // rose
    '#6366f1'  // indigo
];



document.getElementById('add-process-btn').addEventListener('click', addProcess);
document.getElementById('load-sample-btn').addEventListener('click', loadSampleScenario);
document.getElementById('clear-all-btn').addEventListener('click', clearAll);
document.getElementById('simulate-btn').addEventListener('click', runSimulation);

function updateProcessTable() {
    const tbody = document.getElementById('process-list-body');
    tbody.innerHTML = '';

    if (processes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-secondary);">No processes added yet. Click "Load Sample Scenario" or enter details above.</td></tr>';
        return;
    }

    processes.forEach((p, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${p.pid}</strong></td>
            <td>${p.arrivalTime}</td>
            <td>${p.burstTime}</td>
            <td><button class="btn btn-danger" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="removeProcess(${idx})">Remove</button></td>
        `;
        tbody.appendChild(tr);
    });
}

function addProcess() {
    const pidInput = document.getElementById('pid');
    const atInput = document.getElementById('arrival-time');
    const btInput = document.getElementById('burst-time');

    let pid = pidInput.value.trim();
    const arrivalTime = parseInt(atInput.value);
    const burstTime = parseInt(btInput.value);

    if (isNaN(arrivalTime) || arrivalTime < 0) {
        alert('Arrival Time must be a non-negative integer.');
        return;
    }
    if (isNaN(burstTime) || burstTime <= 0) {
        alert('Burst Time must be a positive integer.');
        return;
    }

    if (!pid) {
        pid = 'P' + (processes.length + 1);
    }

    // Check duplicate pid
    if (processes.some(p => p.pid === pid)) {
        alert('Process ID must be unique.');
        return;
    }

    processes.push({ pid, arrivalTime, burstTime });
    updateProcessTable();

    pidInput.value = '';
    atInput.value = '0';
    btInput.value = '5';
}

function removeProcess(idx) {
    processes.splice(idx, 1);
    updateProcessTable();
}

function loadSampleScenario() {
    processes.length = 0;
    processes.push({ pid: 'P1', arrivalTime: 0, burstTime: 5 });
    processes.push({ pid: 'P2', arrivalTime: 1, burstTime: 3 });
    processes.push({ pid: 'P3', arrivalTime: 2, burstTime: 8 });
    processes.push({ pid: 'P4', arrivalTime: 3, burstTime: 6 });
    updateProcessTable();
}

function clearAll() {
    processes.length = 0;
    updateProcessTable();
    document.getElementById('gantt-section').style.display = 'none';
    document.getElementById('results-section').style.display = 'none';
}

window.removeProcess = removeProcess;

// JS Fallback FCFS Scheduling logic
function simulateFCFS_JS(procList) {
    const localProcesses = JSON.parse(JSON.stringify(procList));
    localProcesses.sort((a, b) => a.arrivalTime - b.arrivalTime);

    const timeline = [];
    let currentTime = 0;

    localProcesses.forEach((p, idx) => {
        if (currentTime < p.arrivalTime) {
            timeline.push({
                pid: 'Idle',
                startTime: currentTime,
                endTime: p.arrivalTime,
                isIdle: true
            });
            currentTime = p.arrivalTime;
        }

        const startTime = currentTime;
        const endTime = currentTime + p.burstTime;

        p.startTime = startTime;
        p.completionTime = endTime;
        p.turnaroundTime = p.completionTime - p.arrivalTime;
        p.waitingTime = p.turnaroundTime - p.burstTime;
        p.responseTime = p.startTime - p.arrivalTime;

        timeline.push({
            pid: p.pid,
            startTime: startTime,
            endTime: endTime,
            color: colors[idx % colors.length],
            isIdle: false
        });

        currentTime = endTime;
    });

    return { processes: localProcesses, timeline };
}

function runSimulation() {
    if (processes.length === 0) {
        alert('Please add at least one process to simulate.');
        return;
    }

    const resultData = simulateFCFS_JS(processes);
    renderSimulation(resultData.processes, resultData.timeline);
}

function renderSimulation(simulatedProcesses, timeline) {
    // Display Gantt Chart
    const ganttTimeline = document.getElementById('gantt-timeline');
    const ganttTimeLabels = document.getElementById('gantt-time-labels');
    ganttTimeline.innerHTML = '';
    ganttTimeLabels.innerHTML = '';

    const totalSimTime = timeline[timeline.length - 1].endTime;

    timeline.forEach((block, idx) => {
        const blockDuration = block.endTime - block.startTime;
        const percentage = (blockDuration / totalSimTime) * 100;

        const blockEl = document.createElement('div');
        blockEl.className = 'gantt-block' + (block.isIdle ? ' idle' : '');
        blockEl.style.width = `${percentage}%`;
        if (!block.isIdle) {
            // Assign color based on PID or index
            const processIndex = processes.findIndex(p => p.pid === block.pid);
            blockEl.style.backgroundColor = colors[processIndex !== -1 ? processIndex : idx % colors.length];
        }
        blockEl.innerHTML = `<div>${block.pid}</div><div style="font-size: 0.75rem; font-weight: normal; opacity: 0.8;">(${blockDuration})</div>`;
        ganttTimeline.appendChild(blockEl);
    });

    // Add time labels
    const zeroLabel = document.createElement('span');
    zeroLabel.className = 'gantt-time-label';
    zeroLabel.style.left = '0%';
    zeroLabel.textContent = '0';
    ganttTimeLabels.appendChild(zeroLabel);

    let cumulativePercent = 0;
    timeline.forEach((block) => {
        const blockDuration = block.endTime - block.startTime;
        cumulativePercent += (blockDuration / totalSimTime) * 100;

        const label = document.createElement('span');
        label.className = 'gantt-time-label';
        label.style.left = `${cumulativePercent}%`;
        label.textContent = block.endTime;
        ganttTimeLabels.appendChild(label);
    });

    document.getElementById('gantt-section').style.display = 'block';

    // Populate Metrics Table in original order
    const resultsTbody = document.getElementById('results-table-body');
    resultsTbody.innerHTML = '';

    let sumTat = 0;
    let sumWt = 0;
    let sumRt = 0;

    // Make sure table output is in the same order as inputted processes
    processes.forEach((p) => {
        const calculated = simulatedProcesses.find(lp => lp.pid === p.pid);
        if (calculated) {
            sumTat += calculated.turnaroundTime;
            sumWt += calculated.waitingTime;
            sumRt += calculated.responseTime;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${calculated.pid}</strong></td>
                <td>${calculated.arrivalTime}</td>
                <td>${calculated.burstTime}</td>
                <td>${calculated.completionTime}</td>
                <td>${calculated.turnaroundTime}</td>
                <td>${calculated.waitingTime}</td>
                <td>${calculated.responseTime}</td>
            `;
            resultsTbody.appendChild(tr);
        }
    });

    const avgTat = (sumTat / processes.length).toFixed(2);
    const avgWt = (sumWt / processes.length).toFixed(2);
    const avgRt = (sumRt / processes.length).toFixed(2);

    document.getElementById('avg-tat').textContent = avgTat;
    document.getElementById('avg-wt').textContent = avgWt;
    document.getElementById('avg-rt').textContent = avgRt;

    document.getElementById('results-section').style.display = 'block';
}

updateProcessTable();