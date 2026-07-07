const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec, spawn } = require('child_process');

const PORT = 3000;
const STATIC_DIR = path.join(__dirname, 'UI');

// MIME types for static file serving
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Helper to compile C++ code if executable doesn't exist
function ensureExecutable(algorithm, callback) {
    const dir = algorithm === 'fcfs' ? 'FCFS' : 'SJF';
    const sourceFile = path.join(__dirname, dir, `${algorithm}.cpp`);
    const exeFile = path.join(__dirname, dir, `${algorithm}_simulator.exe`);

    if (fs.existsSync(exeFile)) {
        return callback(null, exeFile);
    }

    console.log(`Executable not found. Compiling ${sourceFile}...`);
    const compileCmd = `g++ -O3 "${sourceFile}" -o "${exeFile}"`;
    exec(compileCmd, (err, stdout, stderr) => {
        if (err) {
            console.error(`Compilation error: ${stderr}`);
            return callback(new Error(`Failed to compile ${algorithm}.cpp: ${stderr}`));
        }
        console.log(`Successfully compiled ${exeFile}`);
        callback(null, exeFile);
    });
}

const server = http.createServer((req, res) => {
    console.log(`${req.method} ${req.url}`);

    // API Route for simulation
    if (req.method === 'POST' && req.url === '/api/simulate') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { algorithm, processes } = data;

                if (!algorithm || !['fcfs', 'sjf'].includes(algorithm)) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Invalid algorithm specified' }));
                }

                if (!processes || !Array.isArray(processes) || processes.length === 0) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Processes array is empty or invalid' }));
                }

                // Ensure the C++ exe exists (compiles if missing)
                ensureExecutable(algorithm, (err, exePath) => {
                    if (err) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: err.message }));
                    }

                    // Spawn the C++ process with `--json`
                    const child = spawn(exePath, ['--json']);
                    let stdoutData = '';
                    let stderrData = '';

                    child.stdout.on('data', chunk => {
                        stdoutData += chunk.toString();
                    });

                    child.stderr.on('data', chunk => {
                        stderrData += chunk.toString();
                    });

                    child.on('close', code => {
                        if (code !== 0) {
                            console.error(`C++ program exited with code ${code}. Error: ${stderrData}`);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ error: `C++ program error: ${stderrData}` }));
                        }

                        try {
                            const resultJson = JSON.parse(stdoutData);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify(resultJson));
                        } catch (e) {
                            console.error(`Failed to parse C++ stdout: ${stdoutData}`);
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: 'C++ simulator returned invalid JSON' }));
                        }
                    });

                    // Construct stdin input for C++ simulator:
                    // N
                    // PID_1 AT_1 BT_1
                    // PID_2 AT_2 BT_2
                    let inputStr = `${processes.length}\n`;
                    processes.forEach(p => {
                        inputStr += `${p.pid} ${p.arrivalTime} ${p.burstTime}\n`;
                    });

                    // Write to stdin and close input stream
                    child.stdin.write(inputStr);
                    child.stdin.end();
                });

            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
            }
        });
        return;
    }

    // Static Files Serving
    let filePath = path.join(STATIC_DIR, req.url === '/' ? 'index.html' : req.url);
    const extname = path.extname(filePath);
    let contentType = MIME_TYPES[extname] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 Not Found</h1>', 'utf-8');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`CPU Scheduling Simulator server running at:`);
    console.log(`👉 http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
