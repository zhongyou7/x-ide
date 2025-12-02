const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const chokidar = require('chokidar');
const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);
const app = express();
// 优先从环境变量读取端口，没有则使用默认值8000
const PORT = process.env.PORT || 8000;

// 访问次数统计文件路径
const VISIT_COUNT_FILE = path.join(__dirname, 'data', 'visit-count.json');

// 初始化访问次数文件
async function initVisitCount() {
    try {
        // 创建data目录（如果不存在）
        await fs.mkdir(path.dirname(VISIT_COUNT_FILE), { recursive: true });
        
        // 检查文件是否存在
        await fs.access(VISIT_COUNT_FILE);
    } catch (error) {
        // 如果文件不存在，创建初始文件
        await fs.writeFile(VISIT_COUNT_FILE, JSON.stringify({ count: 0 }), 'utf8');
    }
}

// 获取并增加访问次数
async function getAndIncrementVisitCount() {
    try {
        // 读取当前访问次数
        const data = await fs.readFile(VISIT_COUNT_FILE, 'utf8');
        const visitData = JSON.parse(data);
        
        // 增加访问次数
        visitData.count += 1;
        
        // 保存更新后的访问次数
        await fs.writeFile(VISIT_COUNT_FILE, JSON.stringify(visitData), 'utf8');
        
        return visitData.count;
    } catch (error) {
        console.error('获取访问次数失败:', error);
        return 1; // 失败时返回默认值
    }
}

// 获取当前访问次数（不增加）
async function getCurrentVisitCount() {
    try {
        const data = await fs.readFile(VISIT_COUNT_FILE, 'utf8');
        const visitData = JSON.parse(data);
        return visitData.count;
    } catch (error) {
        console.error('获取当前访问次数失败:', error);
        return 0;
    }
}

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// 文件系统操作
const fileOperations = {
    // 读取文件内容
    readFile: async (filePath) => {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 写入文件内容
    writeFile: async (filePath, content) => {
        try {
            await fs.writeFile(filePath, content, 'utf8');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 检查目录是否存在
    directoryExists: async (dirPath) => {
        try {
            const stats = await fs.stat(dirPath);
            return { exists: stats.isDirectory() };
        } catch (error) {
            return { exists: false };
        }
    },

    // 创建新文件
    createFile: async (filePath) => {
        try {
            const fullPath = path.resolve(filePath);
            const dir = path.dirname(fullPath);
            
            // 确保目录存在，但跳过系统根目录（避免权限错误）
            const rootDir = path.parse(dir).root;
            if (dir !== rootDir) {
                await fs.mkdir(dir, { recursive: true });
            }
            
            // 写入文件
            await fs.writeFile(fullPath, '', 'utf8');
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 创建新文件夹
    createFolder: async (folderPath) => {
        try {
            const absolutePath = path.resolve(folderPath);
            await fs.mkdir(absolutePath, { recursive: true });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 删除文件或文件夹
    delete: async (itemPath) => {
        try {
            const stats = await fs.stat(itemPath);
            if (stats.isDirectory()) {
                await fs.rmdir(itemPath, { recursive: true });
            } else {
                await fs.unlink(itemPath);
            }
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 重命名文件或文件夹
    rename: async (oldPath, newPath) => {
        try {
            await fs.rename(oldPath, newPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 移动文件或文件夹
    move: async (sourcePath, targetPath) => {
        try {
            const fileName = path.basename(sourcePath);
            const destinationPath = path.join(targetPath, fileName);
            await fs.rename(sourcePath, destinationPath);
            return { success: true, destinationPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 获取目录内容
    readDirectory: async (dirPath) => {
        try {
            const items = await fs.readdir(dirPath, { withFileTypes: true });
            const result = [];
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item.name);
                const stats = await fs.stat(fullPath);
                
                result.push({
                    name: item.name,
                    path: fullPath,
                    type: item.isDirectory() ? 'directory' : 'file',
                    size: stats.size,
                    modified: stats.mtime,
                    created: stats.birthtime
                });
            }
            
            return { success: true, items: result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    },

    // 检查路径是否存在
    exists: async (itemPath) => {
        try {
            await fs.access(itemPath);
            return { success: true, exists: true };
        } catch {
            return { success: true, exists: false };
        }
    }
};

// API路由
// 检查目录是否存在
app.get('/api/directory/exists', async (req, res) => {
    const { path } = req.query;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少目录路径' });
    }
    
    const result = await fileOperations.directoryExists(path);
    res.json(result);
});

// 读取目录内容
app.post('/api/directory/read', async (req, res) => {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少目录路径' });
    }
    
    try {
        const items = await fs.readdir(path, { withFileTypes: true });
        const result = {
            success: true,
            items: items.map(item => ({
                name: item.name,
                type: item.isDirectory() ? 'directory' : 'file',
                size: 0, // 可以添加获取文件大小的逻辑
                lastModified: 0 // 可以添加获取修改时间的逻辑
            }))
        };
        res.json(result);
    } catch (error) {
        console.error('读取目录失败:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// 读取文件
app.get('/api/file/read', async (req, res) => {
    const { path } = req.query;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少文件路径' });
    }
    
    const result = await fileOperations.readFile(path);
    res.json(result);
});

// 写入文件
app.post('/api/file/write', async (req, res) => {
    const { path, content } = req.body;
    if (!path || content === undefined) {
        return res.status(400).json({ success: false, error: '缺少文件路径或内容' });
    }
    
    const result = await fileOperations.writeFile(path, content);
    res.json(result);
});

// 创建文件
app.post('/api/file/create', async (req, res) => {
    const { path, content } = req.body;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少文件路径' });
    }
    
    const result = await fileOperations.createFile(path, content || '');
    res.json(result);
});

// 创建文件夹
app.post('/api/folder/create', async (req, res) => {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少文件夹路径' });
    }
    
    const result = await fileOperations.createFolder(path);
    res.json(result);
});

// 删除文件或文件夹
app.post('/api/delete', async (req, res) => {
    const { path } = req.body;
    if (!path) {
        return res.status(400).json({ success: false, error: '缺少路径' });
    }
    
    const result = await fileOperations.delete(path);
    res.json(result);
});

// 重命名文件或文件夹
app.post('/api/rename', async (req, res) => {
    const { oldPath, newPath } = req.body;
    if (!oldPath || !newPath) {
        return res.status(400).json({ success: false, error: '缺少路径参数' });
    }
    
    const result = await fileOperations.rename(oldPath, newPath);
    res.json(result);
});

// 移动文件或文件夹
app.put('/api/item/move', async (req, res) => {
    const { sourcePath, targetPath } = req.body;
    if (!sourcePath || !targetPath) {
        return res.status(400).json({ success: false, error: '源路径和目标路径都是必需的' });
    }
    
    const result = await fileOperations.move(sourcePath, targetPath);
    res.json(result);
});

// 读取目录内容
app.get('/api/directory/read', async (req, res) => {
    const { path: dirPath } = req.query;
    if (!dirPath) {
        return res.status(400).json({ success: false, error: '目录路径是必需的' });
    }
    
    const result = await fileOperations.readDirectory(dirPath);
    res.json(result);
});

// 检查路径是否存在
app.get('/api/item/exists', async (req, res) => {
    const { path: itemPath } = req.query;
    if (!itemPath) {
        return res.status(400).json({ success: false, error: '路径是必需的' });
    }
    
    const result = await fileOperations.exists(itemPath);
    res.json(result);
});

// 执行命令
app.post('/api/command/execute', async (req, res) => {
    const { command, cwd } = req.body;
    if (!command) {
        return res.status(400).json({ success: false, error: '命令是必需的' });
    }
    
    try {
        const { stdout, stderr } = await execPromise(command, { cwd });
        res.json({ success: true, stdout, stderr });
    } catch (error) {
        res.json({ success: false, error: error.message, stdout: error.stdout, stderr: error.stderr });
    }
});

// 获取访问次数API
app.get('/api/visit-count', async (req, res) => {
    try {
        // 获取并增加访问次数
        const count = await getAndIncrementVisitCount();
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 获取当前访问次数（不增加）
app.get('/api/visit-count/current', async (req, res) => {
    try {
        const count = await getCurrentVisitCount();
        res.json({ success: true, count });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 文件监视
class FileWatcher {
    constructor() {
        this.watchers = new Map();
    }

    watch(path, callback) {
        if (this.watchers.has(path)) {
            this.watchers.get(path).close();
        }

        const watcher = chokidar.watch(path, {
            persistent: true,
            ignoreInitial: true
        });

        watcher.on('all', (event, path) => {
            callback({ event, path });
        });

        this.watchers.set(path, watcher);
        return watcher;
    }

    unwatch(path) {
        if (this.watchers.has(path)) {
            this.watchers.get(path).close();
            this.watchers.delete(path);
        }
    }
}

const fileWatcher = new FileWatcher();

// WebSocket连接处理（简化版，实际项目中应使用socket.io）
app.get('/api/watch', (req, res) => {
    const { path: watchPath } = req.query;
    if (!watchPath) {
        return res.status(400).json({ success: false, error: '监视路径是必需的' });
    }

    // 设置SSE头
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
    });

    // 开始监视
    const watcher = fileWatcher.watch(watchPath, (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
    });

    // 客户端断开连接时停止监视
    req.on('close', () => {
        fileWatcher.unwatch(watchPath);
    });
});

// 启动服务器
async function startServer() {
    try {
        // 初始化访问次数文件
        await initVisitCount();
        
        // 启动服务器
        app.listen(PORT, () => {
            console.log(`X IDE 文件服务器运行在端口 ${PORT}`);
            console.log(`访问 http://localhost:${PORT} 查看应用`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

module.exports = { app, fileOperations, fileWatcher };