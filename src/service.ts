import { resolve, dirname } from "path";
import { homedir, platform } from "os";
import {
  mkdirSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  readFileSync,
} from "fs";
import { execSync } from "child_process";

const SERVICE_NAME = "com.agent-task-board";
const LABEL = "agent-task-board";

function getCliPath(): string {
  return resolve(__dirname, "cli.js");
}

function getNodePath(): string {
  return process.execPath;
}

function getLogDir(): string {
  const dir = resolve(homedir(), ".agent-task-board", "logs");
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── macOS LaunchAgent ───

function getMacPlistPath(): string {
  return resolve(homedir(), "Library", "LaunchAgents", `${SERVICE_NAME}.plist`);
}

function generatePlist(port: number): string {
  const logDir = getLogDir();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${SERVICE_NAME}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${getNodePath()}</string>
    <string>${getCliPath()}</string>
    <string>start</string>
    <string>--port</string>
    <string>${port}</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${resolve(logDir, "stdout.log")}</string>
  <key>StandardErrorPath</key>
  <string>${resolve(logDir, "stderr.log")}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>${dirname(getNodePath())}:/usr/local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;
}

function macInstall(port: number): void {
  const plistPath = getMacPlistPath();

  if (existsSync(plistPath)) {
    console.log("Service already installed. Uninstalling first...");
    macUninstall();
  }

  writeFileSync(plistPath, generatePlist(port));
  execSync(`launchctl load -w "${plistPath}"`);
  console.log(`✅ Service installed and started!`);
  console.log(`   Web UI: http://localhost:${port}`);
  console.log(`   Logs:   ~/.agent-task-board/logs/`);
  console.log(`   Plist:  ${plistPath}`);
}

function macUninstall(): void {
  const plistPath = getMacPlistPath();
  if (!existsSync(plistPath)) {
    console.log("Service is not installed.");
    return;
  }
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`);
  } catch {}
  unlinkSync(plistPath);
  console.log("✅ Service uninstalled.");
}

function macStatus(): void {
  try {
    const result = execSync(
      `launchctl list | grep ${SERVICE_NAME} 2>/dev/null`,
      { encoding: "utf-8" }
    ).trim();
    if (result) {
      const parts = result.split("\t");
      const pid = parts[0];
      const exitCode = parts[1];
      console.log(`✅ Service is running (PID: ${pid})`);
      if (exitCode !== "0" && pid === "-") {
        console.log(`⚠️  Last exit code: ${exitCode}`);
      }
    } else {
      console.log("⏹  Service is not running.");
    }
  } catch {
    const plistPath = getMacPlistPath();
    if (existsSync(plistPath)) {
      console.log("⏹  Service is installed but not running.");
    } else {
      console.log("⏹  Service is not installed.");
    }
  }
}

// ─── Linux systemd ───

function getSystemdPath(): string {
  const dir = resolve(homedir(), ".config", "systemd", "user");
  mkdirSync(dir, { recursive: true });
  return resolve(dir, `${LABEL}.service`);
}

function generateSystemdUnit(port: number): string {
  return `[Unit]
Description=Agent Task Board
After=network.target

[Service]
Type=simple
ExecStart=${getNodePath()} ${getCliPath()} start --port ${port}
Restart=always
RestartSec=5
Environment=PATH=${dirname(getNodePath())}:/usr/local/bin:/usr/bin:/bin
StandardOutput=append:${resolve(getLogDir(), "stdout.log")}
StandardError=append:${resolve(getLogDir(), "stderr.log")}

[Install]
WantedBy=default.target
`;
}

function linuxInstall(port: number): void {
  const servicePath = getSystemdPath();

  if (existsSync(servicePath)) {
    console.log("Service already installed. Uninstalling first...");
    linuxUninstall();
  }

  writeFileSync(servicePath, generateSystemdUnit(port));
  execSync("systemctl --user daemon-reload");
  execSync(`systemctl --user enable --now ${LABEL}`);
  console.log(`✅ Service installed and started!`);
  console.log(`   Web UI: http://localhost:${port}`);
  console.log(`   Logs:   ~/.agent-task-board/logs/`);
  console.log(`   Unit:   ${servicePath}`);
}

function linuxUninstall(): void {
  const servicePath = getSystemdPath();
  if (!existsSync(servicePath)) {
    console.log("Service is not installed.");
    return;
  }
  try {
    execSync(`systemctl --user disable --now ${LABEL} 2>/dev/null`);
  } catch {}
  unlinkSync(servicePath);
  execSync("systemctl --user daemon-reload");
  console.log("✅ Service uninstalled.");
}

function linuxStatus(): void {
  try {
    const result = execSync(`systemctl --user is-active ${LABEL} 2>/dev/null`, {
      encoding: "utf-8",
    }).trim();
    if (result === "active") {
      const info = execSync(`systemctl --user show ${LABEL} --property=MainPID`, {
        encoding: "utf-8",
      }).trim();
      console.log(`✅ Service is running (${info})`);
    } else {
      console.log(`⏹  Service status: ${result}`);
    }
  } catch {
    const servicePath = getSystemdPath();
    if (existsSync(servicePath)) {
      console.log("⏹  Service is installed but not running.");
    } else {
      console.log("⏹  Service is not installed.");
    }
  }
}

// ─── Public API ───

export function serviceInstall(port: number): void {
  const os = platform();
  if (os === "darwin") {
    macInstall(port);
  } else if (os === "linux") {
    linuxInstall(port);
  } else {
    console.error(`❌ System service not supported on ${os}.`);
    console.error("   Please use 'npm start' or a process manager like pm2.");
    process.exit(1);
  }
}

export function serviceUninstall(): void {
  const os = platform();
  if (os === "darwin") {
    macUninstall();
  } else if (os === "linux") {
    linuxUninstall();
  } else {
    console.error(`❌ System service not supported on ${os}.`);
    process.exit(1);
  }
}

export function serviceStatus(): void {
  const os = platform();
  if (os === "darwin") {
    macStatus();
  } else if (os === "linux") {
    linuxStatus();
  } else {
    console.error(`❌ System service not supported on ${os}.`);
    process.exit(1);
  }
}
