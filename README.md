# CPU Scheduling Algorithm Simulator

An interactive, responsive, web-based simulation tool designed to demonstrate and visualize different CPU scheduling algorithms used by Operating Systems.

This simulator runs scheduling logic entirely in the browser using HTML and vanilla JavaScript.

## Project Structure
- `FCFS/FCFS.js`: Contains the JavaScript scheduling logic and simulation runner for FCFS.
- `SJF/SJF.js`: Contains the JavaScript scheduling logic and simulation runner for SJF.
- `UI/index.html`: Main dashboard to navigate between the scheduler simulators.
- `UI/FCFS.html`: Web interface for FCFS simulation.
- `UI/SJF.html`: Web interface for SJF simulation.
- `UI/style.css`: Unified stylesheet featuring modern typography and a dark glassmorphic design.

---

## Running the Web Simulator

Since the application runs entirely client-side using vanilla HTML, CSS, and JS, no server setup or compilation is required.

1. Locate the file `UI/index.html` in your project folder.
2. Open `index.html` directly in any modern web browser (by double-clicking it or using your browser's "Open File" option).
3. Select an algorithm (such as FCFS or SJF) from the dashboard to run and visualize scheduling simulations.

---

## Sample Scenario & Results

### Input Data
- **P1**: Arrival = 0, Burst = 5
- **P2**: Arrival = 1, Burst = 3
- **P3**: Arrival = 2, Burst = 8
- **P4**: Arrival = 3, Burst = 6

### FCFS Results
- **Execution Order**: P1 $\rightarrow$ P2 $\rightarrow$ P3 $\rightarrow$ P4
- **Timeline**: P1 [0-5], P2 [5-8], P3 [8-16], P4 [16-22]
- **Average Turnaround Time**: 11.25 ms
- **Average Waiting Time**: 5.75 ms
- **Average Response Time**: 5.75 ms

### SJF Results
- **Execution Order**: P1 $\rightarrow$ P2 $\rightarrow$ P4 $\rightarrow$ P3
- **Timeline**: P1 [0-5], P2 [5-8], P4 [8-14], P3 [14-22]
- **Average Turnaround Time**: 10.75 ms
- **Average Waiting Time**: 5.25 ms
- **Average Response Time**: 5.25 ms
