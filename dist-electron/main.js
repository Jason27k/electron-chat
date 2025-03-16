import { app as o, BrowserWindow as t, ipcMain as l } from "electron";
import { fileURLToPath as m } from "node:url";
import i from "node:path";
const s = i.dirname(m(import.meta.url));
process.env.APP_ROOT = i.join(s, "..");
const n = process.env.VITE_DEV_SERVER_URL, w = i.join(process.env.APP_ROOT, "dist-electron"), r = i.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = n ? i.join(process.env.APP_ROOT, "public") : r;
let e;
function a() {
  e = new t({
    icon: i.join(process.env.VITE_PUBLIC, "electron-vite.svg"),
    webPreferences: {
      preload: i.join(s, "preload.mjs"),
      contextIsolation: !0,
      nodeIntegration: !1
    },
    ...process.platform === "darwin" ? {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 10, y: 10 }
    } : {
      frame: !1
    },
    minWidth: 800,
    minHeight: 600,
    backgroundColor: "#ffffff"
  }), l.on("window-control", (d, c) => {
    if (e)
      switch (c) {
        case "minimize":
          e.minimize();
          break;
        case "maximize":
          e.isMaximized() ? e.unmaximize() : e.maximize();
          break;
        case "close":
          e.close();
          break;
      }
  }), e.webContents.on("did-finish-load", () => {
    e == null || e.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  }), n ? e.loadURL(n) : e.loadFile(i.join(r, "index.html"));
}
o.on("window-all-closed", () => {
  process.platform !== "darwin" && (o.quit(), e = null);
});
o.on("activate", () => {
  t.getAllWindows().length === 0 && a();
});
o.whenReady().then(a);
export {
  w as MAIN_DIST,
  r as RENDERER_DIST,
  n as VITE_DEV_SERVER_URL
};
