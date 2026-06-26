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
    const fs = require('fs');
    if (process.platform !== 'win32') {
        try {
            fs.chmodSync(javaBin, 0o755);
        } catch (err) {
            console.error("Lỗi cấp quyền thực thi cho Java:", err);
        }
    }
    springBootProcess = spawn(javaBin, ['-jar', jarPath]);

    // springBootProcess.stdout.on('data', (data) => {
    //     console.log(`Spring Boot: ${data}`);
    // });

    springBootProcess.stdout.on('data', (data) => {
        const logOutput = data.toString();
        // In log ra để dễ debug
        console.log(`[Backend]: ${logOutput}`);

        // Dùng Regex tìm dòng log: "Tomcat started on port(s): 54321 (http)"
        const portMatch = logOutput.match(/Tomcat started on port\(s\):\s*(\d+)/);
        
        if (portMatch) {
            const actualPort = portMatch[1]; // Lấy con số nhóm đầu tiên trong Regex
            console.log(`⚡ Bắt được cổng Backend đang chạy: ${actualPort}`);
            
            // 3. CHỈ MỞ GIAO DIỆN REACT KHI ĐÃ LẤY ĐƯỢC CỔNG
            if (!mainWindow) {
                createReactWindow(actualPort);
            }
        }
    })
}


function createReactWindow(backendPort) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // TRUYỀN PORT VÀO REACTJS THÔNG QUA URL QUERY STRING
    // Hàm này sẽ tạo ra đường dẫn: file://.../frontend/index.html?apiPort=54321
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'), {
        search: `apiPort=${backendPort}` 
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