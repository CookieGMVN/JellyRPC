const { app, BrowserWindow, ipcMain, safeStorage, Tray, Menu } = require('electron');
const path = require('node:path');
const fs = require("node:fs");
const { v4 } = require('uuid');
const { getJellyfinToken, getJellyfinSessions } = require('./utils/Jellyfin');
const RPC = require("@xhayper/discord-rpc");

if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;
let tray;
let intervalId;

const client = new RPC.Client({ clientId: "1379172787360501872", transport: "ipc" });

app.setLoginItemSettings({
  openAtLogin: true,
  path: app.getPath('exe'),
});

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    // Set these properties for better tray experience
    show: false, // Don't show until ready
    skipTaskbar: false, // Show in taskbar initially
    icon: path.join(__dirname, 'icon.png'), // Set the window icon
  });

  mainWindow.removeMenu();

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Show window when it's ready to avoid flashing
  mainWindow.once('ready-to-show', () => {
    if (!fs.existsSync(path.join(app.getPath("userData"), "config.json"))) mainWindow.show();
  });

  // Hide window instead of closing it
  mainWindow.on("close", (ev) => {
    if (!app.isQuitting) {
      ev.preventDefault();
      mainWindow.hide();
      mainWindow.setSkipTaskbar(true); // Hide from taskbar when minimized to tray
      return false;
    }
  });
};

// Handle the app running in background
app.on('window-all-closed', () => {
  // Don't quit the app when all windows are closed
  // This keeps it running in the background
});

app.whenReady().then(async () => {
  createWindow();
  traySetup();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });

  const filePath = path.join(app.getPath("userData"), "config.json");
  if (fs.existsSync(filePath)) {
    const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const decryptedUsername = safeStorage.decryptString(Buffer.from(content.username, "hex")).toString();
    const decryptedPassword = safeStorage.decryptString(Buffer.from(content.password, "hex")).toString();

    const token = await getJellyfinToken(content.url, decryptedUsername, decryptedPassword, content.deviceId);

    if (!token) {
      mainWindow.show();
      mainWindow.setSkipTaskbar(false);
      mainWindow.webContents.send("creds-error");
    } else {
      mainWindow.webContents.send("creds-set");

      updatePresence(content.url, token, content.deviceId);
    }
  }

  ipcMain.on('set-creds', (event, { url, username, password }) => {
    console.log(`Saving credentials for ${url} with username ${username}`);
    saveCreds(url, username, password);
  });
});

function traySetup() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  tray.setToolTip("JellyRPC");

  // Create context menu for the tray icon
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show App',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.setSkipTaskbar(false);
        }
      }
    },
    {
      label: 'Hide App',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
          mainWindow.setSkipTaskbar(true);
        }
      }
    },
    {
      label: "Reset Credentials",
      click: () => {
        resetCreds();
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true; // Set flag to allow the app to quit
        app.quit();
      }
    }
  ]);

  // Set the context menu
  tray.setContextMenu(contextMenu);

  // Optional: Show window on tray click
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
        mainWindow.setSkipTaskbar(true);
      } else {
        mainWindow.show();
        mainWindow.setSkipTaskbar(false);
      }
    }
  });
}

function saveCreds(url, username, password) {
  const filePath = path.join(app.getPath("userData"), "config.json");

  const content = {
    url: url,
    deviceId: v4(),
    username: safeStorage.encryptString(username).toString("hex"),
    password: safeStorage.encryptString(password).toString("hex")
  };

  fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf-8');
  mainWindow.webContents.send("creds-set");

  updatePresence(url, content.username, content.deviceId);
}

function resetCreds() {
  const filePath = path.join(app.getPath("userData"), "config.json");
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    mainWindow.webContents.send("creds-reset");
    mainWindow.show();
    mainWindow.setSkipTaskbar(false);
  }
  clearInterval(intervalId);

  client.destroy();
}

async function updatePresence(url, token, deviceId) {
  client.login();

  client.on("error", (error) => {
    console.error('Discord RPC Error:', error);
  });

  client.on("ready", () => {
    console.log("Discord RPC client is ready!");
    intervalId = setInterval(async () => {
      try {
        const sessions = await getJellyfinSessions(url, token, deviceId);

        if (!sessions || sessions.length <= 0) return client.user.clearActivity();

        const playingSessions = sessions.filter(session => session.NowPlayingItem);

        if (playingSessions.length <= 0) return client.user.clearActivity();

        const currentSession = playingSessions[0];
        const playingItem = currentSession.NowPlayingItem;

        const startTimestamp = Date.now() - (currentSession.PlayState.PositionTicks / 10000);
        const endTimestamp = startTimestamp + (playingItem.RunTimeTicks / 10000);

        return client.user.setActivity({
          type: 2,
          details: playingItem.Name,
          state: playingItem.Album + " - " + playingItem.Artists.join(", "),
          largeImageKey: url + "/Items/" + playingItem.Id + "/Images/Primary",
          largeImageText: "Playing on " + currentSession.Client,
          smallImageKey: currentSession.PlayState.IsPaused ? "paused" : "playing",
          smallImageText: currentSession.PlayState.IsPaused ? "Paused" : "Playing",
          startTimestamp,
          endTimestamp
        });
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    }, 1000);
  });
}