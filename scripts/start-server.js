const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const standaloneServer = path.join(process.cwd(), ".next", "standalone", "server.js");

if (fs.existsSync(standaloneServer)) {
  console.log("==> [Startup] Detected Next.js standalone build. Launching node .next/standalone/server.js...");

  // Ensure public and static are linked to standalone directory
  const standaloneNext = path.join(process.cwd(), ".next", "standalone", ".next");
  const staticSrc = path.join(process.cwd(), ".next", "static");
  const staticDest = path.join(standaloneNext, "static");

  if (fs.existsSync(staticSrc) && !fs.existsSync(staticDest)) {
    try {
      if (!fs.existsSync(standaloneNext)) fs.mkdirSync(standaloneNext, { recursive: true });
      fs.cpSync(staticSrc, staticDest, { recursive: true });
    } catch (e) {
      console.warn("Warning: Could not copy static assets to standalone directory:", e.message);
    }
  }

  const publicSrc = path.join(process.cwd(), "public");
  const publicDest = path.join(process.cwd(), ".next", "standalone", "public");
  if (fs.existsSync(publicSrc) && !fs.existsSync(publicDest)) {
    try {
      fs.cpSync(publicSrc, publicDest, { recursive: true });
    } catch (e) {
      console.warn("Warning: Could not copy public assets to standalone directory:", e.message);
    }
  }

  const child = spawn(process.execPath, [standaloneServer], {
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
} else {
  console.log("==> [Startup] Launching Next.js standard start...");
  const child = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["next", "start"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    process.exit(code ?? (signal ? 1 : 0));
  });
}
