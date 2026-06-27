const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const log = require('electron-log');

// Cấu hình ghi log ra file
log.transports.file.level = 'info';
log.transports.file.maxSize = 20 * 1024 * 1024; // Nâng dung lượng tối đa lên 20MB
// Ghi đè các hàm console cơ bản (console.log, console.error...) để tự động lưu vào file
Object.assign(console, log.functions);

// Bắt lỗi hệ thống chưa được xử lý (tránh crash ngầm mà không có log)
process.on('uncaughtException', (error) => {
    log.error('Uncaught Exception:', error);
});
process.on('unhandledRejection', (error) => {
    log.error('Unhandled Rejection:', error);
});

log.info('--- KHỞI ĐỘNG ỨNG DỤNG ---');
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

// Tính năng xóa file log từ ReactJS
ipcMain.handle('log:clear', () => {
    log.transports.file.getFile().clear();
    log.info('--- FILE LOG ĐÃ ĐƯỢC LÀM SẠCH BỞI NGƯỜI DÙNG ---');
    return true;
});

// Tính năng mở thư mục chứa file log (rất tiện để lấy file)
ipcMain.handle('log:open', () => {
    const { shell } = require('electron');
    const logFilePath = log.transports.file.getFile().path;
    shell.showItemInFolder(logFilePath);
    return true;
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
    // Nếu đang chạy trên macOS/Linux (máy ảo), ép nó kết nối về MySQL của máy Windows (103.87.232.1)
    const extraArgs = process.platform !== 'win32' 
        ? ['--spring.datasource.url=jdbc:mysql://103.87.232.1:3306/manager_studio?useSSL=false&allowPublicKeyRetrieval=true&useUnicode=true&characterEncoding=UTF-8'] 
        : [];

    springBootProcess = spawn(javaBin, ['-jar', jarPath, ...extraArgs]);

    // springBootProcess.stdout.on('data', (data) => {
    //     console.log(`Spring Boot: ${data}`);
    // });

    springBootProcess.stdout.on('data', (data) => {
        const logOutput = data.toString();
        // In log ra để dễ debug (đã được electron-log lưu vào file)
        console.log(`[Backend]: ${logOutput}`);

        // Dùng Regex tìm dòng log: "Tomcat started on port(s): 54321" HOẶC "Tomcat started on port 8081"
        const portMatch = logOutput.match(/Tomcat started on port(?:\(s\))?(?::)?\s*(\d+)/);
        
        if (portMatch) {
            const actualPort = portMatch[1]; // Lấy con số nhóm đầu tiên trong Regex
            console.log(`⚡ Bắt được cổng Backend đang chạy: ${actualPort}`);
            
            // 3. CHỈ MỞ GIAO DIỆN REACT KHI ĐÃ LẤY ĐƯỢC CỔNG
            if (!mainWindow) {
                createReactWindow(actualPort);
            }
        }
    });

    // Lắng nghe cả lỗi của Spring Boot để ghi vào file log
    springBootProcess.stderr.on('data', (data) => {
        console.error(`[Backend Error]: ${data.toString()}`);
    });
}


function createReactWindow(backendPort) {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        icon: path.join(__dirname, 'assets', 'logo-studio.png'),
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
    log.info('Đang khởi động Backend (Spring Boot)...');
    startBackend();
});

// Khi tất cả cửa sổ bị đóng (bấm nút X)
app.on('window-all-closed', () => {
    // Đảm bảo thoát hoàn toàn ứng dụng (Kể cả trên macOS)
    app.quit();
});

// Tắt hoàn toàn Spring Boot khi đóng phần mềm
app.on('will-quit', () => {
    if (springBootProcess) {
        log.info('Đang tắt Backend...');
        if (process.platform === 'win32') {
            const { execSync } = require('child_process');
            try {
                // Lệnh taskkill trên Windows để ép buộc (force) tắt cây tiến trình Java
                execSync(`taskkill /pid ${springBootProcess.pid} /t /f`);
            } catch (e) {
                log.error('Lỗi khi tắt Backend:', e);
            }
        } else {
            // Trên Mac/Linux, gửi tín hiệu ngắt mạnh
            springBootProcess.kill('SIGKILL');
        }
    }
});