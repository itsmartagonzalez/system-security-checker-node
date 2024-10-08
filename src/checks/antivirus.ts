import { execPowershell, executeQuery } from "../utils/utils";
import os from "os";
import { execSync } from "child_process";

const ANTIVIRUS_PROCESSES = "clamav|sophos|eset|comodo|avg|avast|bitdefender";

export function checkAntivirus() {
  const system = os.platform();
  if (system === "darwin") {
    const queries = [
      "SELECT * FROM xprotect_entries;",
      "SELECT * FROM xprotect_meta;",
      "SELECT * FROM launchd WHERE name LIKE '%com.apple.MRT%' OR name LIKE '%com.apple.XProtect%';",
      "SELECT * FROM processes WHERE name LIKE '%MRT%' OR name LIKE '%XProtect%';",
    ];
    for (const q of queries) {
      const result = executeQuery(q);
      if (result.length > 0) {
        return "XProtect/MRT (Built-in macOS protection)";
      }
    }
  } else if (system === "win32") {
    const result = execPowershell(
      `wmic /node:localhost /namespace:\\\\root\\SecurityCenter2 path AntiVirusProduct Get DisplayName | findstr /V /B /C:displayName`
    ).toString();
    return result.trim() || null;
  } else if (system === "linux") {
    // Search for known antivirus related processes
    const processes = execSync(
      `systemctl list-units --type=service --state=running | grep -i -E '${ANTIVIRUS_PROCESSES}' | awk '{ $1=$2=$3=$4=\"\"; print $0 }'`
    )
      .toString()
      .split("\n")
      .map((s) => s.trim())
      .join(", ");

    if (processes) {
      return processes;
    }
  }

  return null;
}

export function antivirusToString(antivirus: string | null) {
  if (!antivirus) return "❌ No antivirus detected.";
  return `✅ Antivirus protection detected: ${antivirus}`;
}
