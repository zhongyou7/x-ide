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
            
            // 确保目录存在
            await fs.mkdir(dir, { recursive: true });
            
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
            // 安全检查：防止在系统根目录直接创建文件夹
            const absolutePath = path.resolve(folderPath);
            const rootDir = path.parse(absolutePath).root; // 获取根目录路径
            
            // 如果尝试在根目录直接创建文件夹，拒绝操作
            if (absolutePath === rootDir) {
                return { success: false, error: '不允许在系统根目录直接创建文件夹，请指定子目录' };
            }
            
            // 检查是否尝试在根目录的下一级直接创建文件夹（可选的额外安全检查）
            const pathParts = absolutePath.substring(rootDir.length).split(path.sep).filter(Boolean);
            if (pathParts.length === 0) {
                return { success: false, error: '不允许在系统根目录直接创建文件夹，请指定子目录' };
            }
            
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
app.listen(PORT, () => {
    console.log(`X IDE 文件服务器运行在端口 ${PORT}`);
    console.log(`访问 http://localhost:${PORT} 查看应用`);
});

module.exports = { app, fileOperations, fileWatcher };