// 文件系统管理器 - 支持浏览器API和服务器API双模式
class FileSystemManager {
    constructor() {
        this.currentDirectoryHandle = null;
        this.fileHandles = new Map();
        this.directoryHandles = new Map();
        this.currentPath = '/';
        this.useServerAPI = false; // 默认使用浏览器API
        this.serverBasePath = ''; // 服务器基础路径
    }

    // 检测是否应使用服务器API
    shouldUseServerAPI() {
        // 如果不在HTTPS环境且不在localhost，使用服务器API
        if (window.location.protocol !== 'https:' && 
            window.location.hostname !== 'localhost' && 
            window.location.hostname !== '127.0.0.1') {
            return true;
        }
        
        // 如果浏览器不支持文件系统API，使用服务器API
        if (!window.showDirectoryPicker) {
            return true;
        }
        
        return this.useServerAPI;
    }

    // 请求用户选择目录
    async selectDirectory() {
        try {
            // 检测是否应该使用服务器API
            if (this.shouldUseServerAPI()) {
                console.log('使用服务器API模式');
                this.useServerAPI = true;
                
                // 使用服务器API获取根目录
                const result = await this.selectServerDirectory();
                if (result.success) {
                    this.serverBasePath = result.path;
                    this.currentPath = '/';
                    console.log('服务器目录选择成功:', result.path);
                    return { success: true, path: '/' };
                } else {
                    // 如果服务器API失败，回退到浏览器API
                    console.warn('服务器API失败，尝试浏览器API:', result.error);
                    return this.selectBrowserDirectory();
                }
            }
            
            // 使用浏览器API
            return this.selectBrowserDirectory();
        } catch (error) {
            console.error('选择目录失败:', error);
            return { success: false, error: '选择目录失败: ' + error.message };
        }
    }

    // 使用浏览器API选择目录
    async selectBrowserDirectory() {
        try {
            // 检查浏览器是否支持文件系统API
            if (!window.showDirectoryPicker) {
                return { success: false, error: '您的浏览器不支持文件系统API，请使用最新版本的Chrome、Edge或Opera浏览器' };
            }

            // 获取兼容性报告
            if (window.enhancedCompatibilityFix) {
                const report = window.enhancedCompatibilityFix.getCompatibilityReport();
                console.log('文件系统选择前的兼容性报告:', report);
                
                // 如果不是安全上下文，提供明确指导
                if (!report.isSecureContext) {
                    return { 
                        success: false, 
                        error: 'Chrome 安全限制：需要安全上下文（HTTPS或localhost）。请使用 Node.js 服务器模式（推荐）或确保通过安全连接访问。',
                        solutions: [
                            '使用 START_SERVERS.bat 启动 Node.js 服务器',
                            '通过 http://localhost:8000 访问',
                            '确保网站使用 HTTPS 协议'
                        ]
                    };
                }
            }

            // 增强的目录选择器调用
            let directoryHandle;
            try {
                directoryHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'desktop',
                    id: 'x-ide-directory-picker'
                });
            } catch (error) {
                console.error('目录选择失败:', error);
                
                // 提供详细的错误信息和解决方案
                if (error.name === 'SecurityError') {
                    return { 
                        success: false, 
                        error: 'Chrome 安全限制：请确保网站可信且用户交互正常。\n\n解决方案：\n1. 使用 Node.js 服务器模式（推荐）\n2. 通过 http://localhost:8000 访问\n3. 确保在用户点击按钮后立即选择目录\n4. 检查浏览器安全设置',
                        solutions: [
                            '使用 START_SERVERS.bat 启动 Node.js 服务器',
                            '通过 http://localhost:8000 访问',
                            '确保通过用户点击触发文件选择',
                            '检查 Chrome 安全设置'
                        ]
                    };
                } else if (error.name === 'AbortError') {
                    return { success: false, error: '用户取消了目录选择' };
                } else if (error.name === 'NotAllowedError') {
                    return { success: false, error: '权限被拒绝：请允许访问文件系统' };
                }
                
                throw error; // 重新抛出其他错误
            }
            
            this.currentDirectoryHandle = directoryHandle;
            this.directoryHandles.set('/', directoryHandle);
            
            console.log('成功选择目录:', directoryHandle.name);
            return { success: true, path: '/' };
        } catch (error) {
            console.error('浏览器目录选择失败:', error);
            
            // 提供最终的错误信息和解决方案
            return { 
                success: false, 
                error: `选择目录失败: ${error.message}`,
                solutions: [
                    '使用 Node.js 服务器模式（推荐）',
                    '通过 http://localhost:8000 访问',
                    '使用最新版本的 Chrome 或 Edge 浏览器',
                    '确保通过用户点击触发文件选择'
                ]
            };
        }
    }

    // 使用服务器API选择目录
    async selectServerDirectory() {
        try {
            // 请求用户输入目录路径
            const defaultPath = prompt('请输入工作目录路径（例如：C:\\Projects 或 /home/user/projects）:', 'C:\\');
            if (!defaultPath) {
                return { success: false, error: '用户取消了目录选择' };
            }

            // 验证目录是否存在
            const response = await fetch('/api/directory/exists?path=' + encodeURIComponent(defaultPath));
            const result = await response.json();
            
            if (result.exists) {
                this.serverBasePath = defaultPath;
                return { success: true, path: defaultPath };
            } else {
                // 询问是否创建目录
                if (confirm('目录不存在，是否创建？')) {
                    const createResponse = await fetch('/api/folder/create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ path: defaultPath })
                    });
                    const createResult = await createResponse.json();
                    
                    if (createResult.success) {
                        this.serverBasePath = defaultPath;
                        return { success: true, path: defaultPath };
                    } else {
                        return { success: false, error: '创建目录失败: ' + createResult.error };
                    }
                } else {
                    return { success: false, error: '目录不存在' };
                }
            }
        } catch (error) {
            console.error('服务器目录选择失败:', error);
            // 如果服务器API不可用，回退到浏览器API
            console.warn('服务器API不可用，回退到浏览器API');
            return this.selectBrowserDirectory();
        }
    }

    // 读取目录内容
    async readDirectory(dirPath = '/') {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.readServerDirectory(dirPath);
            }

            const dirHandle = this.directoryHandles.get(dirPath);
            if (!dirHandle) {
                return { 
                    success: false, 
                    error: `目录不存在: ${dirPath}`,
                    code: 'DIRECTORY_NOT_FOUND'
                };
            }

            // 检查目录句柄类型和有效性
            if (!dirHandle || typeof dirHandle.values !== 'function') {
                console.error('无效的目录句柄:', dirHandle);
                return { 
                    success: false, 
                    error: '目录句柄无效或已损坏，请重新选择文件夹',
                    code: 'INVALID_DIRECTORY_HANDLE'
                };
            }

            const items = [];
            try {
                for await (const entry of dirHandle.values()) {
                    const item = {
                        name: entry.name,
                        kind: entry.kind,
                        path: dirPath === '/' ? `/${entry.name}` : `${dirPath}/${entry.name}`
                    };

                    if (entry.kind === 'file') {
                        this.fileHandles.set(item.path, entry);
                    } else {
                        this.directoryHandles.set(item.path, entry);
                    }

                    items.push(item);
                }
            } catch (iterateError) {
                console.error('遍历目录失败:', iterateError);
                return { 
                    success: false, 
                    error: `无法读取目录内容: ${iterateError.message}`,
                    code: 'DIRECTORY_ITERATION_ERROR'
                };
            }

            return { success: true, items };
        } catch (error) {
            console.error('读取目录失败:', error);
            return { 
                success: false, 
                error: error.message,
                code: error.name || 'READ_DIRECTORY_ERROR'
            };
        }
    }

    // 使用服务器API读取目录
    async readServerDirectory(dirPath) {
        try {
            const response = await fetch('/api/directory/read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: this.serverBasePath + dirPath 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 转换数据格式以匹配浏览器API格式
                const items = result.items.map(item => ({
                    name: item.name,
                    kind: item.type === 'file' ? 'file' : 'directory',
                    path: dirPath === '/' ? `/${item.name}` : `${dirPath}/${item.name}`
                }));
                
                console.log(`服务器读取目录成功: ${dirPath}`, items);
                return { success: true, items: items };
            } else {
                return { success: false, error: result.error || '读取目录失败' };
            }
        } catch (error) {
            console.error('服务器读取目录失败:', error);
            return { success: false, error: '服务器读取目录失败: ' + error.message };
        }
    }

    // 读取文件内容
    async readFile(filePath) {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.readServerFile(filePath);
            }

            const fileHandle = this.fileHandles.get(filePath);
            if (!fileHandle) {
                return { success: false, error: '文件不存在' };
            }

            // 检查文件句柄类型和有效性
            if (!fileHandle || typeof fileHandle.getFile !== 'function') {
                console.error('无效的文件句柄:', fileHandle);
                return { 
                    success: false, 
                    error: '文件句柄无效或已损坏，请重新选择文件夹',
                    code: 'INVALID_FILE_HANDLE'
                };
            }

            const file = await fileHandle.getFile();
            const content = await file.text();
            return { success: true, content };
        } catch (error) {
            console.error('读取文件失败:', error);
            return { 
                success: false, 
                error: error.message,
                code: error.name || 'READ_ERROR'
            };
        }
    }

    // 使用服务器API读取文件
    async readServerFile(filePath) {
        try {
            const response = await fetch('/api/file/read', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: this.serverBasePath + filePath 
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`服务器读取文件成功: ${filePath}`);
                return { success: true, content: result.content };
            } else {
                return { success: false, error: result.error || '读取文件失败' };
            }
        } catch (error) {
            console.error('服务器读取文件失败:', error);
            return { success: false, error: '服务器读取文件失败: ' + error.message };
        }
    }

    // 写入文件内容
    async writeFile(filePath, content) {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.writeServerFile(filePath, content);
            }

            const fileHandle = this.fileHandles.get(filePath);
            if (!fileHandle) {
                return { success: false, error: '文件不存在' };
            }

            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 使用服务器API写入文件
    async writeServerFile(filePath, content) {
        try {
            const response = await fetch('/api/file/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: this.serverBasePath + filePath,
                    content: content
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`服务器写入文件成功: ${filePath}`);
                return { success: true };
            } else {
                return { success: false, error: result.error || '写入文件失败' };
            }
        } catch (error) {
            console.error('服务器写入文件失败:', error);
            return { success: false, error: '服务器写入文件失败: ' + error.message };
        }
    }

    // 创建新文件
    async createFile(dirPath, fileName) {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.createServerFile(dirPath, fileName);
            }

            // 首先确保目录路径存在
            const ensureResult = await this.ensureDirectoryPath(dirPath);
            if (!ensureResult.success) {
                return ensureResult;
            }

            const dirHandle = this.directoryHandles.get(dirPath);
            if (!dirHandle) {
                return { success: false, error: '无法获取目录句柄: ' + dirPath };
            }

            const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
            const filePath = dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`;
            this.fileHandles.set(filePath, fileHandle);

            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 使用服务器API创建文件
    async createServerFile(dirPath, fileName) {
        try {
            const fullPath = this.serverBasePath + dirPath + '/' + fileName;
            const response = await fetch('/api/file/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: fullPath,
                    content: ''
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const newFile = {
                    name: fileName,
                    type: 'file',
                    path: dirPath === '/' ? `/${fileName}` : `${dirPath}/${fileName}`,
                    size: 0,
                    lastModified: Date.now()
                };
                
                console.log(`服务器创建文件成功: ${newFile.path}`);
                return { success: true, file: newFile };
            } else {
                return { success: false, error: result.error || '创建文件失败' };
            }
        } catch (error) {
            console.error('服务器创建文件失败:', error);
            return { success: false, error: '服务器创建文件失败: ' + error.message };
        }
    }

    // 创建新文件夹
    async createDirectory(parentPath, dirName) {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.createServerDirectory(parentPath, dirName);
            }

            console.log('创建文件夹:', parentPath, dirName);
            
            // 首先确保父目录路径存在
            const ensureResult = await this.ensureDirectoryPath(parentPath);
            if (!ensureResult.success) {
                console.error('确保目录路径失败:', ensureResult.error);
                return ensureResult;
            }

            const parentHandle = this.directoryHandles.get(parentPath);
            if (!parentHandle) {
                console.error('无法获取父目录句柄:', parentPath);
                return { success: false, error: '无法获取父目录句柄: ' + parentPath };
            }

            console.log('父目录句柄:', parentHandle);
            
            // 检查权限
            try {
                // 尝试验证权限
                await parentHandle.queryPermission({ mode: 'readwrite' });
            } catch (permissionError) {
                console.warn('权限检查失败:', permissionError);
            }

            const dirHandle = await parentHandle.getDirectoryHandle(dirName, { create: true });
            const dirPath = parentPath === '/' ? `/${dirName}` : `${parentPath}/${dirName}`;
            this.directoryHandles.set(dirPath, dirHandle);

            console.log('文件夹创建成功:', dirPath);
            return { success: true, path: dirPath };
        } catch (error) {
            console.error('创建文件夹失败:', error);
            if (error.name === 'NotAllowedError') {
                return { success: false, error: '权限不足：无法创建文件夹，请确保有写入权限' };
            } else if (error.name === 'SecurityError') {
                return { success: false, error: '安全错误：无法访问文件系统' };
            } else if (error.name === 'TypeError') {
                return { success: false, error: '类型错误：可能是权限问题或浏览器不支持' };
            }
            return { success: false, error: '创建文件夹失败: ' + error.message };
        }
    }

    // 使用服务器API创建文件夹
    async createServerDirectory(parentPath, dirName) {
        try {
            const fullPath = this.serverBasePath + parentPath + '/' + dirName;
            const response = await fetch('/api/folder/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: fullPath
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                const newDir = {
                    name: dirName,
                    type: 'directory',
                    path: parentPath === '/' ? `/${dirName}` : `${parentPath}/${dirName}`
                };
                
                console.log(`服务器创建文件夹成功: ${newDir.path}`);
                return { success: true, directory: newDir };
            } else {
                return { success: false, error: result.error || '创建文件夹失败' };
            }
        } catch (error) {
            console.error('服务器创建文件夹失败:', error);
            return { success: false, error: '服务器创建文件夹失败: ' + error.message };
        }
    }

    // 删除文件或文件夹
    async deleteItem(itemPath) {
        try {
            // 如果使用服务器API
            if (this.useServerAPI) {
                return await this.deleteServerItem(itemPath);
            }

            const pathParts = itemPath.split('/');
            const name = pathParts.pop();
            const parentPath = pathParts.join('/') || '/';
            
            const parentHandle = this.directoryHandles.get(parentPath);
            if (!parentHandle) {
                return { success: false, error: '父目录不存在' };
            }

            await parentHandle.removeEntry(name, { recursive: true });
            
            // 从缓存中移除
            this.fileHandles.delete(itemPath);
            this.directoryHandles.delete(itemPath);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 使用服务器API删除文件或文件夹
    async deleteServerItem(itemPath) {
        try {
            const fullPath = this.serverBasePath + itemPath;
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    path: fullPath
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`服务器删除成功: ${itemPath}`);
                return { success: true };
            } else {
                return { success: false, error: result.error || '删除失败' };
            }
        } catch (error) {
            console.error('服务器删除失败:', error);
            return { success: false, error: '服务器删除失败: ' + error.message };
        }
    }

    // 重命名文件或文件夹
    async renameItem(oldPath, newName) {
        try {
            const pathParts = oldPath.split('/');
            const oldName = pathParts.pop();
            const parentPath = pathParts.join('/') || '/';
            
            const parentHandle = this.directoryHandles.get(parentPath);
            if (!parentHandle) {
                return { success: false, error: '父目录不存在' };
            }

            // 获取原项目
            let itemHandle;
            try {
                itemHandle = await parentHandle.getFileHandle(oldName);
            } catch {
                itemHandle = await parentHandle.getDirectoryHandle(oldName);
            }

            // 创建新项
            if (itemHandle.kind === 'file') {
                await parentHandle.getFileHandle(newName, { create: true });
            } else {
                await parentHandle.getDirectoryHandle(newName, { create: true });
            }

            // 删除原项
            await parentHandle.removeEntry(oldName);

            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 重命名文件（兼容接口）
    async renameFile(oldPath, newPath) {
        console.log('FileSystemManager.renameFile called with:', oldPath, newPath);
        try {
            const pathParts = newPath.split('/');
            const newName = pathParts.pop();
            const result = await this.renameItem(oldPath, newName);
            console.log('renameFile result:', result);
            return result;
        } catch (error) {
            console.error('renameFile error:', error);
            return { success: false, error: error.message };
        }
    }

    // 移动文件（兼容接口）
    async moveFile(sourcePath, targetPath) {
        console.log('FileSystemManager.moveFile called with:', sourcePath, targetPath);
        try {
            // 获取源文件信息
            const sourceName = sourcePath.split('/').pop();
            const targetDir = targetPath.split('/').slice(0, -1).join('/') || '/';
            const targetName = targetPath.split('/').pop();
            
            // 确保目标目录存在
            const ensureResult = await this.ensureDirectoryPath(targetDir);
            if (!ensureResult.success) {
                return ensureResult;
            }
            
            // 复制文件内容
            const readResult = await this.readFile(sourcePath);
            if (!readResult.success) {
                return readResult;
            }
            
            // 在目标位置创建新文件
            const createResult = await this.createFile(targetDir, targetName);
            if (!createResult.success) {
                return createResult;
            }
            
            // 写入内容
            const writeResult = await this.writeFile(targetPath, readResult.content);
            if (!writeResult.success) {
                return writeResult;
            }
            
            // 删除源文件
            const deleteResult = await this.deleteItem(sourcePath);
            if (!deleteResult.success) {
                return deleteResult;
            }
            
            console.log('moveFile completed successfully');
            return { success: true };
        } catch (error) {
            console.error('moveFile error:', error);
            return { success: false, error: error.message };
        }
    }

    // 复制文件（兼容接口）
    async copyFile(sourcePath, targetPath) {
        console.log('FileSystemManager.copyFile called with:', sourcePath, targetPath);
        try {
            // 获取源文件信息
            const sourceName = sourcePath.split('/').pop();
            const targetDir = targetPath.split('/').slice(0, -1).join('/') || '/';
            const targetName = targetPath.split('/').pop();
            
            // 确保目标目录存在
            const ensureResult = await this.ensureDirectoryPath(targetDir);
            if (!ensureResult.success) {
                return ensureResult;
            }
            
            // 读取源文件内容
            const readResult = await this.readFile(sourcePath);
            if (!readResult.success) {
                return readResult;
            }
            
            // 在目标位置创建新文件
            const createResult = await this.createFile(targetDir, targetName);
            if (!createResult.success) {
                return createResult;
            }
            
            // 写入内容到目标文件
            const writeResult = await this.writeFile(targetPath, readResult.content);
            if (!writeResult.success) {
                return writeResult;
            }
            
            console.log('copyFile completed successfully');
            return { success: true };
        } catch (error) {
            console.error('copyFile error:', error);
            return { success: false, error: error.message };
        }
    }

    // 获取文件信息
    async getFileInfo(filePath) {
        try {
            const fileHandle = this.fileHandles.get(filePath);
            if (!fileHandle) {
                return { success: false, error: '文件不存在' };
            }

            // 检查文件句柄类型和有效性
            if (!fileHandle || typeof fileHandle.getFile !== 'function') {
                console.error('无效的文件句柄:', fileHandle);
                return { 
                    success: false, 
                    error: '文件句柄无效或已损坏，请重新选择文件夹',
                    code: 'INVALID_FILE_HANDLE'
                };
            }

            const file = await fileHandle.getFile();
            return {
                success: true,
                info: {
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                }
            };
        } catch (error) {
            console.error('获取文件信息失败:', error);
            return { 
                success: false, 
                error: error.message,
                code: error.name || 'GET_INFO_ERROR'
            };
        }
    }

    // 确保目录路径存在，如果不存在则创建
    async ensureDirectoryPath(dirPath) {
        try {
            // 检查是否已经缓存了该目录
            if (this.directoryHandles.has(dirPath)) {
                return { success: true };
            }
            
            // 如果路径是根目录，确保根目录句柄存在
            if (dirPath === '/') {
                // 如果根目录句柄不存在，尝试获取它
                if (!this.directoryHandles.has('/')) {
                    // 如果当前目录句柄存在，使用它作为根目录
                    if (this.currentDirectoryHandle) {
                        this.directoryHandles.set('/', this.currentDirectoryHandle);
                        return { success: true };
                    } else {
                        return { success: false, error: '根目录句柄不存在' };
                    }
                }
                return { success: true };
            }
            
            // 递归确保父目录存在
            const pathParts = dirPath.split('/').filter(part => part);
            let currentPath = '/';
            
            for (const part of pathParts) {
                const parentHandle = this.directoryHandles.get(currentPath);
                if (!parentHandle) {
                    return { success: false, error: `父目录不存在: ${currentPath}` };
                }
                
                const newPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`;
                
                // 尝试获取子目录句柄，如果不存在则创建
                let childHandle;
                try {
                    childHandle = await parentHandle.getDirectoryHandle(part);
                } catch {
                    // 目录不存在，创建它
                    try {
                        childHandle = await parentHandle.getDirectoryHandle(part, { create: true });
                    } catch (createError) {
                        return { success: false, error: `无法创建目录 ${part}: ${createError.message}` };
                    }
                }
                
                this.directoryHandles.set(newPath, childHandle);
                currentPath = newPath;
            }
            
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 检查支持性
    static isSupported() {
        return 'showDirectoryPicker' in window && 
               'showOpenFilePicker' in window && 
               'showSaveFilePicker' in window;
    }
}

// 导出文件系统管理器
window.FileSystemManager = FileSystemManager;