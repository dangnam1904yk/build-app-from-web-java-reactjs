const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

ipcMain.handle('dialog:openDirectory', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (canceled) {
        return null;
    } else {
        return filePaths[0];
    }
});

let mainWindow;
let springBootProcess;

function startBackend() {
    let jarPath;
    let javaBin;

    if (!app.isPackaged) {
        // Môi trường DEV: Đọc trực tiếp từ thư mục dự án
        jarPath = path.join(__dirname, 'backend', 'app.jar');
        javaBin = 'java'; // Dùng java của hệ điều hành máy dev
    } else {
        // Môi trường PRODUCTION (Sau khi build thành .exe): 
        // File sẽ nằm trong thư mục resources của ứng dụng sau cài đặt
        jarPath = path.join(process.resourcesPath, 'backend', 'app.jar');
        
        // Nếu bạn có nhúng kèm JRE:
        const javaExecutable = process.platform === 'win32' ? 'java.exe' : 'java';
        javaBin = path.join(process.resourcesPath, 'backend', 'jre', 'bin', javaExecutable);
        // Nếu không nhúng JRE (bắt máy khách phải cài Java trước): javaBin = 'java';
    }

    // Kích hoạt Spring Boot chạy ngầm
    springBootProcess = spawn(javaBin, ['-jar', jarPath]);

    springBootProcess.stdout.on('data', (data) => {
        console.log(`Spring Boot: ${data}`);
    });
}

app.on('ready', () => {
    startBackend();

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets', 'icon.ico'),
        webPreferences: { 
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Load file giao diện ReactJS
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Tắt hoàn toàn Spring Boot khi đóng phần mềm
app.on('will-quit', () => {
    if (springBootProcess) {
        springBootProcess.kill();
    }
});