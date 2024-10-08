import os from "os";
import {execPowershell, executeQuery} from "../utils/utils";
import {execSync} from "child_process";

function checkMacOsScreenLock() {
  try {
    const output = execSync("sysadminctl -screenLock status 2>&1")
      .toString()
      .trim();

    if (output.includes("screenLock is off")) {
      return null;
    } else if (output.includes("screenLock delay is immediate")) {
      return 1;
    } else {
      const match = output.match(/screenLock delay is (\d+) seconds/);
      if (match && match[1]) {
        const seconds = parseInt(match[1], 10);
        return Math.floor(seconds / 60);
      }
    }
  } catch (error) {
    console.error(
      "Error al verificar el estado de la pantalla de bloqueo:",
      error
    );
  }

  return null;
}

function checkWindowsScreenLock() {
  let timeout;

  const haveBattery =
    execPowershell(
      "Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue"
    )
      .toString()
      .trim() !== "";
  const pluggedIn = execPowershell(
    `powercfg -q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String -Pattern "Current AC Power Setting Index"`
  ).toString();
  const pluggedInTimeout = pluggedIn.split(":")[1].trim();

  if (haveBattery) {
    const onBattery = execPowershell(
      `powercfg -q SCHEME_CURRENT SUB_VIDEO VIDEOIDLE | Select-String -Pattern "Current DC Power Setting Index"`
    ).toString();

    const onBatteryTimeout = onBattery.split(":")[1].trim();

    timeout = Math.max(
      parseInt(onBatteryTimeout, 16),
      parseInt(pluggedInTimeout, 16)
    );
  } else {
    timeout = parseInt(pluggedInTimeout, 16);
  }

  if (timeout === 0) {
    return null;
  }
  return timeout / 60;
}

function checkLinuxScreenLock() {
  let linuxDesktop = execSync("env | grep XDG_SESSION_DESKTOP")
    .toString()
    .split("=")?.[1]
    .trim();

  if (linuxDesktop === "ubuntu") {
    linuxDesktop = "gnome";
  }

  const lockEnabled = execSync(
    `gsettings get org.${linuxDesktop}.desktop.screensaver lock-enabled`
  )
    .toString()
    .trim();

  if (lockEnabled === "true") {
    // Get the idle time before the screen lock activates
    const idleDelaySeconds = execSync(
      `gsettings get org.${linuxDesktop}.desktop.session idle-delay`
    )
      .toString()
      .split(" ")?.[1];
    return parseInt(idleDelaySeconds, 10) / 60;
  }
  return null;
}

export function checkScreenLock() {
  const system = os.platform();
  if (system === "darwin") {
    return checkMacOsScreenLock();
  } else if (system === "win32") {
    return checkWindowsScreenLock();
  } else if (system === "linux") {
    return checkLinuxScreenLock();
  }
  throw new Error("Unsupported operating system.");
}

export function screenLockToString(screenLockTime: number | null) {
  if (screenLockTime !== null) {
    const unit = "minutes";
    return `✅ Screen lock activates after ${screenLockTime} ${unit} of inactivity.`;
  }
  return "❌ Screen lock is not configured or is disabled.";
}
