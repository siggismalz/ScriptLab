const {app,BrowserWindow} = require("electron");
const path = require("path");

let mainwindow;

const mainwindow_erstellen = () => {
  mainwindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      preload: path.join(__dirname,"preload.js"),
      nodeIntegration: false,
      allowRunningInsecureContent: true
    }
  });

  //mainwindow.loadFile(path.join(__dirname,"..","client","html","index.html"));
  mainwindow.loadURL("http://127.0.0.1:5500/client/html/index.html")
  mainwindow.menuBarVisible = false
};

app.on("ready",() => {
  mainwindow_erstellen();
});