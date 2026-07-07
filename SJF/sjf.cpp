#include <iostream>
#include <vector>
#include <algorithm>
#include <iomanip>
#include <string>

struct Process {
    std::string pid;
    int arrivalTime;
    int burstTime;
    int completionTime;
    int turnaroundTime;
    int waitingTime;
    int responseTime;
    bool completed;
    int originalIndex;
};

// Function to calculate Shortest Job First (Non-preemptive)
void calculateSJF(std::vector<Process>& processes, std::vector<Process>& timeline) {
    int n = processes.size();
    if (n == 0) return;

    // Initialize completion state
    for (auto& p : processes) {
        p.completed = false;
    }

    int currentTime = 0;
    int completedCount = 0;

    while (completedCount < n) {
        int selectedIdx = -1;
        int minBurstTime = 1e9;
        int minArrivalTime = 1e9;

        // Find the process that is ready and has the shortest burst time
        for (int i = 0; i < n; i++) {
            if (!processes[i].completed && processes[i].arrivalTime <= currentTime) {
                if (processes[i].burstTime < minBurstTime) {
                    minBurstTime = processes[i].burstTime;
                    minArrivalTime = processes[i].arrivalTime;
                    selectedIdx = i;
                } else if (processes[i].burstTime == minBurstTime) {
                    // Tie-breaker: choose process with earlier arrival time
                    if (processes[i].arrivalTime < minArrivalTime) {
                        minArrivalTime = processes[i].arrivalTime;
                        selectedIdx = i;
                    }
                }
            }
        }

        if (selectedIdx == -1) {
            // CPU is idle. Advance to the next arriving process.
            int nextArrival = 1e9;
            for (int i = 0; i < n; i++) {
                if (!processes[i].completed && processes[i].arrivalTime < nextArrival) {
                    nextArrival = processes[i].arrivalTime;
                }
            }
            // Add Idle block to timeline
            Process idle;
            idle.pid = "Idle";
            idle.arrivalTime = currentTime;
            idle.burstTime = nextArrival - currentTime;
            idle.completionTime = nextArrival;
            timeline.push_back(idle);

            currentTime = nextArrival;
        } else {
            processes[selectedIdx].completionTime = currentTime + processes[selectedIdx].burstTime;
            processes[selectedIdx].turnaroundTime = processes[selectedIdx].completionTime - processes[selectedIdx].arrivalTime;
            processes[selectedIdx].waitingTime = processes[selectedIdx].turnaroundTime - processes[selectedIdx].burstTime;
            processes[selectedIdx].responseTime = currentTime - processes[selectedIdx].arrivalTime;
            processes[selectedIdx].completed = true;

            timeline.push_back(processes[selectedIdx]);
            currentTime = processes[selectedIdx].completionTime;
            completedCount++;
        }
    }
}

int main(int argc, char* argv[]) {
    bool jsonMode = false;
    if (argc > 1 && std::string(argv[1]) == "--json") {
        jsonMode = true;
    }

    if (jsonMode) {
        int n;
        if (!(std::cin >> n) || n <= 0) {
            std::cout << "{\"error\": \"Invalid process count\"}\n";
            return 1;
        }

        std::vector<Process> processes(n);
        for (int i = 0; i < n; i++) {
            std::cin >> processes[i].pid >> processes[i].arrivalTime >> processes[i].burstTime;
            processes[i].originalIndex = i;
        }

        std::vector<Process> timeline;
        calculateSJF(processes, timeline);

        // Print JSON Output
        std::cout << "{\n  \"processes\": [\n";
        for (int i = 0; i < n; i++) {
            std::cout << "    {\n"
                      << "      \"pid\": \"" << processes[i].pid << "\",\n"
                      << "      \"arrivalTime\": " << processes[i].arrivalTime << ",\n"
                      << "      \"burstTime\": " << processes[i].burstTime << ",\n"
                      << "      \"completionTime\": " << processes[i].completionTime << ",\n"
                      << "      \"turnaroundTime\": " << processes[i].turnaroundTime << ",\n"
                      << "      \"waitingTime\": " << processes[i].waitingTime << ",\n"
                      << "      \"responseTime\": " << processes[i].responseTime << "\n"
                      << "    }" << (i == n - 1 ? "" : ",") << "\n";
        }
        std::cout << "  ],\n  \"timeline\": [\n";
        for (size_t i = 0; i < timeline.size(); i++) {
            std::cout << "    {\n"
                      << "      \"pid\": \"" << timeline[i].pid << "\",\n"
                      << "      \"startTime\": " << (timeline[i].completionTime - timeline[i].burstTime) << ",\n"
                      << "      \"endTime\": " << timeline[i].completionTime << ",\n"
                      << "      \"isIdle\": " << (timeline[i].pid == "Idle" ? "true" : "false") << "\n"
                      << "    }" << (i == timeline.size() - 1 ? "" : ",") << "\n";
        }
        std::cout << "  ]\n}\n";

    } else {
        int n;
        std::cout << "=== SJF CPU Scheduling Simulator ===\n";
        std::cout << "Enter number of processes: ";
        if (!(std::cin >> n) || n <= 0) {
            std::cerr << "Invalid number of processes.\n";
            return 1;
        }

        std::vector<Process> processes(n);
        for (int i = 0; i < n; i++) {
            std::cout << "\nProcess " << i + 1 << " ID (e.g. P1): ";
            std::cin >> processes[i].pid;
            std::cout << "Arrival Time: ";
            std::cin >> processes[i].arrivalTime;
            std::cout << "Burst Time: ";
            std::cin >> processes[i].burstTime;
            processes[i].originalIndex = i;
        }

        std::vector<Process> timeline;
        calculateSJF(processes, timeline);

        // Display Gantt Chart
        std::cout << "\n=== Gantt Chart ===\n";
        for (const auto& block : timeline) {
            int startTime = block.completionTime - block.burstTime;
            std::cout << "[" << block.pid << " " << startTime << "-" << block.completionTime << "] ";
        }
        std::cout << "\n\n";

        // Display Metrics Table
        std::cout << std::left << std::setw(12) << "Process ID" 
                  << std::setw(15) << "Arrival Time" 
                  << std::setw(12) << "Burst Time" 
                  << std::setw(18) << "Completion Time" 
                  << std::setw(18) << "Turnaround Time" 
                  << std::setw(15) << "Waiting Time" 
                  << std::setw(15) << "Response Time" << "\n";
                  
        double totalTAT = 0, totalWT = 0, totalRT = 0;
        for (const auto& p : processes) {
            totalTAT += p.turnaroundTime;
            totalWT += p.waitingTime;
            totalRT += p.responseTime;
            
            std::cout << std::left << std::setw(12) << p.pid 
                      << std::setw(15) << p.arrivalTime 
                      << std::setw(12) << p.burstTime 
                      << std::setw(18) << p.completionTime 
                      << std::setw(18) << p.turnaroundTime 
                      << std::setw(15) << p.waitingTime 
                      << std::setw(15) << p.responseTime << "\n";
        }

        std::cout << std::fixed << std::setprecision(2);
        std::cout << "\nAverage Turnaround Time: " << (totalTAT / n) << "\n";
        std::cout << "Average Waiting Time: " << (totalWT / n) << "\n";
        std::cout << "Average Response Time: " << (totalRT / n) << "\n";
    }

    return 0;
}
