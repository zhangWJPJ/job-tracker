const { app, BrowserWindow, Menu, session, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
let httpServer = null;
const PORT = 19876;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: '秋招投递管理助手',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  Menu.setApplicationMenu(null);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });
}

// 启动本地HTTP服务，接收浏览器插件发送的投递记录
function startHttpServer() {
  httpServer = http.createServer((req, res) => {
    // CORS 跨域支持
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (req.method === 'POST' && req.url === '/add-record') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        try {
          const data = JSON.parse(body);
          console.log('收到插件投递记录:', data);
          // 发送给渲染进程处理
          if (mainWindow) {
            mainWindow.webContents.send('add-record-from-extension', data);
            mainWindow.show();
            mainWindow.focus();
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, message: '投递记录已保存' }));
        } catch(e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: false, message: '数据格式错误' }));
        }
      });
    } else if (req.method === 'GET' && req.url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: '秋招投递管理助手运行中' }));
    } else {
      res.writeHead(404);
      res.end();
    }
  });
  
  httpServer.listen(PORT, () => {
    console.log(`本地HTTP服务已启动: http://localhost:${PORT}`);
  });
  
  httpServer.on('error', (err) => {
    console.error('HTTP服务启动失败:', err.message);
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone') {
      callback(true);
    } else {
      callback(false);
    }
  });
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'audioCapture' || permission === 'microphone') {
      return true;
    }
    return false;
  });
  createWindow();
  startHttpServer();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (httpServer) {
    httpServer.close();
  }
  if (process.platform !== 'darwin') app.quit();
});
