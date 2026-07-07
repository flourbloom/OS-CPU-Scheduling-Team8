# CPU Scheduling Algorithm Simulator

An interactive, responsive, web-based simulation tool designed to demonstrate and visualize different CPU scheduling algorithms used by Operating Systems.

This simulator runs scheduling logic inside **compiled C++ executables** and displays the output (Gantt chart and table metrics) in a modern web browser.

## Project Structure
- `FCFS/fcfs.cpp`: Contains the C++ scheduling logic and console interface for FCFS.
- `SJF/sjf.cpp`: Contains the C++ scheduling logic and console interface for SJF.
- `UI/index.html`: Main dashboard to navigate between the scheduler simulators.
- `UI/FCFS.html`: Web interface for FCFS simulation.
- `UI/SJF.html`: Web interface for SJF simulation.
- `UI/style.css`: Unified stylesheet featuring modern typography and a dark glassmorphic design.
- `server.js`: Node.js server bridging the Web UI and the compiled C++ executables.

---

## Running the Web Simulator (C++ Executable Backend)

To allow the browser to run calculations directly from the C++ binaries, start the local Node.js server:

1. Open a terminal in the project directory.
2. Run the Node.js server:
   ```bash
   node server.js
   ```
3. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```
4. Load the sample scenario or add processes, and click **Run Simulation**. The server will automatically compile the `.cpp` source files (using `g++`) on your first request and execute the compiled binary (`.exe`) to return the results.

*Note: If the Node.js server is offline or the pages are loaded via `file://` protocol, the UI will display a warning and automatically fall back to browser-side JavaScript simulation so the webpage remains fully interactive.*

---

## Running the Standalone C++ Console Applications

The core algorithms can also be compiled and executed directly from the terminal as standalone command-line programs:

### Compiling and Running FCFS
```bash
g++ -O3 FCFS/fcfs.cpp -o FCFS/fcfs_simulator
./FCFS/fcfs_simulator
```

### Compiling and Running SJF
```bash
g++ -O3 SJF/sjf.cpp -o SJF/sjf_simulator
./SJF/sjf_simulator
```

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
