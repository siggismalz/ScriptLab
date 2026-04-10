const {app,BrowserWindow} = require("electron");
const path = require("path");

let mainwindow;

const mainwindow_erstellen = () => {
  mainwindow = new BrowserWindow({
    height: 800,
    width: 800,
    webPreferences: {
      preload: path.join(__dirname,"preload.js"),
      nodeIntegration: false,
      allowRunningInsecureContent: true
    }
  });

  mainwindow.loadFile(path.join(__dirname,"..","client","html","index.html"));
};

app.on("ready",() => {
  mainwindow_erstellen();
});