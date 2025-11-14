// 文件管理器
class FileManager {
    constructor(app) {
        this.app = app;
        this.currentDirectory = '/';
        this.currentDirectoryHandle = null;
        this.selectedFiles = new Set();
        this.fileTree = new Map();
        this.watchers = new Map();
        this.fileSystem = new FileSystemManager();
        
        // 调试：列出文件系统管理器的所有方法
        console.log('FileSystemManager methods:', Object.getOwnPropertyNames(FileSystemManager.prototype));
        console.log('FileSystem instance methods:', Object.getOwnPropertyNames(this.fileSystem));
        console.log('FileSystem instance:', this.fileSystem);
        
        this.setupFileContextMenu();
        this.setupFileOperationButtons();
        this.setupFileSelection();
    }

    // 基本初始化（不访问文件系统）
    async initBasic() {
        try {
            console.log('文件管理器基本初始化开始...');
            
            // 设置文件操作按钮事件处理
            this.setupFileOperationButtons();
            this.setupFileContextMenu();
            this.setupFileSelection();
            this.setupFileSearch();
            
            // 添加打开文件夹按钮的点击事件
            const openFolderButton = document.getElementById('open-folder-button');
            if (openFolderButton) {
                openFolderButton.onclick = async () => {
                    console.log('用户点击了打开文件夹按钮');
                    await this.init(); // 用户交互时调用完整初始化
                };
                console.log('打开文件夹按钮事件绑定完成');
            }
            
            // 显示提示信息，引导用户点击打开文件夹
            this.showSuccess('请点击"打开文件夹"按钮选择工作目录');
            
            console.log('文件管理器基本初始化完成');
        } catch (error) {
            console.error('文件管理器基本初始化失败:', error);
        }
    }
    
    // 完整初始化（包含文件系统访问，必须由用户交互触发）
    async init() {
        try {
            // 检查增强兼容性修复是否可用
            if (window.enhancedCompatibilityFix) {
                const report = window.enhancedCompatibilityFix.getCompatibilityReport();
                console.log('初始化前的兼容性报告:', report);
                
                // 如果不是安全上下文，建议使用服务器模式
                if (!report.isSecureContext) {
                    const message = `⚠️ Chrome 安全限制警告

当前环境：${window.location.protocol}//${window.location.hostname}

由于浏览器安全限制，文件系统API无法正常工作。

💡 推荐解决方案：
1. 启动 Node.js 服务器
2. 通过 http://localhost:8000 访问
3. 或者确保网站使用 HTTPS 协议

是否现在切换到服务器模式？`;
                    
                    if (confirm(message)) {
                        // 强制使用服务器模式
                        this.fileSystem.useServerAPI = true;
                        console.log('用户选择切换到服务器模式');
                    } else {
                        console.log('用户继续使用当前模式，可能遇到限制');
                    }
                }
            }

            // 检查浏览器支持
            if (!FileSystemManager.isSupported()) {
                this.showError('您的浏览器不支持文件系统API，请使用最新版本的Chrome、Edge或Opera浏览器');
                return;
            }

            console.log('开始初始化文件管理器...');
            
            // 请求用户选择工作目录
            const result = await this.fileSystem.selectDirectory();
            if (result.success) {
                this.currentDirectory = result.path;
                this.currentDirectoryHandle = this.fileSystem.currentDirectoryHandle; // 同步设置句柄
                console.log('工作目录选择成功:', result.path);
                console.log('目录句柄设置:', this.currentDirectoryHandle);
                
                // 验证目录句柄是否正确设置
                if (!this.currentDirectoryHandle && !this.fileSystem.useServerAPI) {
                    this.showError('目录句柄未正确设置，请重新选择工作目录');
                    return;
                }
                
                await this.loadFileTree();
                this.showSuccess('工作目录已选择: ' + result.path);
            } else {
                console.error('工作目录选择失败:', result.error);
                
                // 增强的错误处理
                let errorMessage = '无法选择工作目录: ' + result.error;
                let solutions = result.solutions || [];
                
                if (result.error.includes('Chrome 安全限制')) {
                    errorMessage = '❌ ' + result.error;
                    solutions = [
                        '使用 START_SERVERS.bat 启动 Node.js 服务器（推荐）',
                        '通过 http://localhost:8000 访问',
                        '确保通过用户点击触发文件选择',
                        '检查浏览器安全设置'
                    ];
                }
                
                this.showError(errorMessage);
                
                // 显示解决方案
                if (solutions.length > 0) {
                    console.log('可用解决方案:');
                    solutions.forEach((solution, index) => {
                        console.log(`${index + 1}. ${solution}`);
                    });
                }
                
                // 提供重试选项
                const retryMessage = solutions.length > 0 ? 
                    `${errorMessage}\n\n解决方案：\n${solutions.map(s => `• ${s}`).join('\n')}\n\n是否重试？` :
                    `${errorMessage}\n\n是否重试？`;
                
                if (confirm(retryMessage)) {
                    return this.init();
                }
            }
            
            // 绑定事件和加载最近文件
            this.bindEvents();
            this.loadRecentFiles();
            
        } catch (error) {
            console.error('文件管理器初始化失败:', error);
            this.showError('文件管理器初始化失败: ' + error.message);
        }
    }

    // 清理资源
    destroy() {
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
    }

    bindEvents() {
        // 拖拽文件到编辑器
        const editorContainer = document.getElementById('monaco-editor');
        if (editorContainer) {
            editorContainer.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });

            editorContainer.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.handleFileDrop(e.dataTransfer.files);
            });
        }

        // 文件树拖拽排序
        this.setupFileTreeDragAndDrop();
        
        // 文件搜索功能
        this.setupFileSearch();
        
        // 文件操作菜单
        this.setupFileContextMenu();
    }

    setupFileTreeDragAndDrop() {
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return;

        let draggedElement = null;

        fileTree.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('file-item')) {
                draggedElement = e.target;
                e.target.style.opacity = '0.5';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', e.target.innerHTML);
                
                // 设置拖拽图像
                const dragImage = e.target.cloneNode(true);
                dragImage.style.opacity = '0.8';
                dragImage.style.position = 'absolute';
                dragImage.style.top = '-1000px';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, e.offsetX, e.offsetY);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            }
        });

        fileTree.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('file-item')) {
                e.target.style.opacity = '';
                // 清理所有拖拽状态
                document.querySelectorAll('.file-item').forEach(item => {
                    item.classList.remove('drag-over', 'drop-before', 'drop-after');
                });
            }
        });

        fileTree.addEventListener('dragover', (e) => {
            e.preventDefault();
            const target = e.target.closest('.file-item');
            if (target && target !== draggedElement) {
                // 移除其他项的拖拽状态
                document.querySelectorAll('.file-item').forEach(item => {
                    if (item !== target) {
                        item.classList.remove('drag-over', 'drop-before', 'drop-after');
                    }
                });
                
                // 计算鼠标位置，决定是插入到前面还是后面
                const rect = target.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                target.classList.add('drag-over');
                
                if (e.clientY < midpoint) {
                    target.classList.add('drop-before');
                    target.classList.remove('drop-after');
                } else {
                    target.classList.add('drop-after');
                    target.classList.remove('drop-before');
                }
            }
        });

        fileTree.addEventListener('dragleave', (e) => {
            const target = e.target.closest('.file-item');
            if (target) {
                target.classList.remove('drag-over', 'drop-before', 'drop-after');
            }
        });

        fileTree.addEventListener('drop', (e) => {
            e.preventDefault();
            const target = e.target.closest('.file-item');
            if (target && target !== draggedElement) {
                target.classList.remove('drag-over', 'drop-before', 'drop-after');
                
                // 根据drop位置决定插入位置
                const rect = target.getBoundingClientRect();
                const midpoint = rect.top + rect.height / 2;
                
                if (e.clientY < midpoint) {
                    // 插入到目标项之前
                    fileTree.insertBefore(draggedElement, target);
                } else {
                    // 插入到目标项之后
                    fileTree.insertBefore(draggedElement, target.nextSibling);
                }
                
                this.reorderFiles(draggedElement, target);
            }
        });
    }

    reorderFiles(draggedElement, targetElement) {
        const fileTree = document.getElementById('file-tree');
        const draggedPath = draggedElement.dataset.path;
        const targetPath = targetElement.dataset.path;
        
        // 检查是否是有效的重排序（不能拖拽到文件上）
        if (targetElement.dataset.kind === 'file') {
            this.app.showError('不能将文件夹拖拽到文件上');
            return;
        }

        // 执行重排序逻辑
        const draggedInfo = this.fileTree.get(draggedPath);
        if (draggedInfo) {
            // 在实际项目中，这里应该更新文件系统的实际顺序
            // 现在只是更新UI显示
            fileTree.removeChild(draggedElement);
            
            const targetIndex = Array.from(fileTree.children).indexOf(targetElement);
            if (targetIndex >= 0) {
                fileTree.insertBefore(draggedElement, fileTree.children[targetIndex + 1]);
            } else {
                fileTree.appendChild(draggedElement);
            }
            
            this.app.showOutput(`文件顺序已更新: ${draggedInfo.name}`);
        }
    }

    // 加载文件树
    async loadFileTree(directory = this.currentDirectory) {
        try {
            // 首先确保目录路径存在
            const ensureResult = await this.fileSystem.ensureDirectoryPath(directory);
            if (!ensureResult.success) {
                this.showError('加载文件树失败: ' + ensureResult.error);
                return;
            }
            
            const result = await this.fileSystem.readDirectory(directory);
            if (result.success) {
                this.renderFileTree(result.items);
            } else {
                this.showError('加载文件树失败: ' + result.error);
            }
        } catch (error) {
            this.showError('加载文件树失败: ' + error.message);
        }
    }

    // 渲染文件树（VSCode风格）
    renderFileTree(items) {
        const fileTreeElement = document.getElementById('file-tree');
        if (!fileTreeElement) {
            console.error('文件树元素未找到');
            return;
        }
        fileTreeElement.innerHTML = '';
        
        // 添加返回上级目录项
        if (this.currentDirectory !== '/') {
            const parentItem = this.createTreeItem({
                name: '..',
                path: this.currentDirectory.split('/').slice(0, -1).join('/') || '/',
                type: 'directory',
                isParent: true
            });
            fileTreeElement.appendChild(parentItem);
        }
        
        // 将kind属性转换为type属性，确保兼容性
        const processedItems = items.map(item => ({
            ...item,
            type: item.type || item.kind || 'file'
        }));
        
        // 排序：文件夹在前，文件在后
        const sortedItems = processedItems.sort((a, b) => {
            if (a.type === b.type) {
                return a.name.localeCompare(b.name);
            }
            return a.type === 'directory' ? -1 : 1;
        });
        
        sortedItems.forEach(item => {
            const treeItem = this.createTreeItem(item);
            fileTreeElement.appendChild(treeItem);
            
            // 存储文件信息
            this.fileTree.set(item.path, {
                name: item.name,
                kind: item.type,
                element: treeItem
            });
        });
    }

    // 创建VSCode风格的树形项目 - 完全按照VSCode交互体验设计
    createTreeItem(item, level = 0, isParent = false) {
        const treeItem = document.createElement('div');
        treeItem.className = 'tree-item';
        treeItem.dataset.path = item.path;
        treeItem.dataset.type = item.type;
        treeItem.dataset.name = item.name;
        
        // 计算缩进级别
        const indentLevel = isParent ? 0 : level;
        
        // 获取图标类名
        const iconClass = item.type === 'directory' ? 'directory' : this.getFileIconClass(item.name);
        
        // 创建缩进元素 - VSCode风格的缩进
        const indentElement = document.createElement('div');
        indentElement.className = 'tree-indent';
        indentElement.style.width = `${indentLevel * 16}px`;
        
        // 创建切换按钮 - VSCode风格的展开/折叠指示器
        const toggleElement = document.createElement('div');
        toggleElement.className = 'tree-toggle';
        
        // 创建图标元素 - 使用更接近VSCode的图标表示
        const iconElement = document.createElement('div');
        iconElement.className = `tree-icon ${iconClass}`;
        
        // 创建标签元素 - 支持编辑状态
        const labelElement = document.createElement('div');
        labelElement.className = 'tree-label';
        labelElement.textContent = item.name;
        
        // 按照VSCode的顺序添加元素
        treeItem.appendChild(indentElement);
        treeItem.appendChild(toggleElement);
        treeItem.appendChild(iconElement);
        treeItem.appendChild(labelElement);
        
        // 如果是文件夹，添加展开/折叠功能
        if (item.type === 'directory' || isParent) {
            toggleElement.classList.add('collapsed');
            
            // 切换按钮点击事件 - VSCode风格的点击行为
            toggleElement.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleFolder(treeItem);
            });
            
            // 添加展开/折叠动画
            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'tree-children';
            treeItem.appendChild(childrenContainer);
        } else {
            // 如果是文件，隐藏切换按钮
            toggleElement.style.visibility = 'hidden';
        }
        
        // 双击事件 - VSCode风格的双击行为
        treeItem.addEventListener('dblclick', () => {
            if (item.type === 'directory') {
                this.toggleFolder(treeItem); // VSCode风格：双击文件夹展开/折叠
            } else {
                this.openFile(item.path);
            }
        });
        
        // 单击选择文件 - VSCode风格的选择行为
        treeItem.addEventListener('click', (e) => {
            // 只有在非编辑模式下才响应点击选择
            if (!labelElement.classList.contains('editing') && 
                !e.target.classList.contains('tree-toggle')) {
                // 支持多选功能（按住Ctrl）
                if (e.ctrlKey || e.metaKey) {
                    this.toggleFileSelection(treeItem);
                } else {
                    this.selectFile(treeItem);
                }
            }
        });
        
        // 右键菜单 - VSCode风格的上下文菜单
        treeItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            // 右键点击时选择该项但不触发导航
            if (!labelElement.classList.contains('editing')) {
                this.selectFile(treeItem);
                this.showContextMenu(e, treeItem);
            }
        });
        
        // 添加拖拽相关事件
        this.setupDragAndDrop(treeItem);
        
        // 添加键盘导航支持
        this.setupKeyboardNavigation(treeItem);
        
        return treeItem;
    }
    
    // 切换文件选择状态（多选功能）
    toggleFileSelection(treeItem) {
        const path = treeItem.dataset.path;
        if (this.selectedFiles.has(path)) {
            this.selectedFiles.delete(path);
            treeItem.classList.remove('selected');
        } else {
            this.selectedFiles.add(path);
            treeItem.classList.add('selected');
        }
    }
    
    // 设置拖拽和放置功能
    setupDragAndDrop(treeItem) {
        // 拖拽开始
        treeItem.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', treeItem.dataset.path);
            treeItem.classList.add('dragging');
            
            // 自定义拖拽图像（如果浏览器支持）
            try {
                const dragImage = treeItem.cloneNode(true);
                dragImage.style.position = 'absolute';
                dragImage.style.left = '-9999px';
                document.body.appendChild(dragImage);
                e.dataTransfer.setDragImage(dragImage, 10, 10);
                setTimeout(() => document.body.removeChild(dragImage), 0);
            } catch (err) {
                // 忽略不支持的浏览器
            }
        });
        
        // 拖拽结束
        treeItem.addEventListener('dragend', () => {
            treeItem.classList.remove('dragging');
            document.querySelectorAll('.tree-item.drag-over').forEach(item => {
                item.classList.remove('drag-over');
            });
        });
        
        // 拖拽经过
        treeItem.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // 只允许拖拽到文件夹上
            if (treeItem.dataset.type === 'directory') {
                document.querySelectorAll('.tree-item.drag-over').forEach(item => {
                    item.classList.remove('drag-over');
                });
                treeItem.classList.add('drag-over');
            }
        });
        
        // 拖拽离开
        treeItem.addEventListener('dragleave', () => {
            treeItem.classList.remove('drag-over');
        });
        
        // 放置
        treeItem.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            treeItem.classList.remove('drag-over');
            
            const sourcePath = e.dataTransfer.getData('text/plain');
            const targetPath = treeItem.dataset.path;
            
            // 防止拖拽到自身
            if (sourcePath !== targetPath) {
                // 实际项目中这里应该实现文件移动的逻辑
                this.app.showOutput(`从 ${sourcePath} 移动到 ${targetPath}`);
            }
        });
    }
    
    // 设置键盘导航支持
    setupKeyboardNavigation(treeItem) {
        treeItem.addEventListener('keydown', (e) => {
            // 空格或Enter键选中/取消选中
            if (e.key === ' ' || e.key === 'Enter') {
                e.preventDefault();
                if (treeItem.classList.contains('selected')) {
                    this.toggleFileSelection(treeItem);
                } else {
                    this.selectFile(treeItem);
                }
            }
            
            // 左箭头键折叠文件夹
            else if (e.key === 'ArrowLeft' && treeItem.dataset.type === 'directory') {
                e.preventDefault();
                if (treeItem.classList.contains('expanded')) {
                    this.toggleFolder(treeItem);
                }
            }
            
            // 右箭头键展开文件夹
            else if (e.key === 'ArrowRight' && treeItem.dataset.type === 'directory') {
                e.preventDefault();
                if (!treeItem.classList.contains('expanded')) {
                    this.toggleFolder(treeItem);
                }
            }
        });
    }

    // 获取文件图标类名 - VSCode风格的文件图标映射
    getFileIconClass(filename) {
        // 先检查文件名（包括扩展名之前的部分）
        const lowerName = filename.toLowerCase();
        
        // 特殊配置文件
        if (lowerName === '.gitignore' || lowerName === '.gitattributes' || lowerName === '.gitmodules') {
            return 'git';
        }
        if (lowerName === 'dockerfile' || lowerName === '.dockerignore') {
            return 'docker';
        }
        if (lowerName === 'package.json' || lowerName === 'package-lock.json' || lowerName === 'yarn.lock' || lowerName === 'pnpm-lock.yaml') {
            return 'package';
        }
        if (lowerName === 'tsconfig.json' || lowerName === 'jsconfig.json') {
            return 'typescript';
        }
        if (lowerName === 'webpack.config.js' || lowerName === 'vite.config.js') {
            return 'config';
        }
        
        // 获取扩展名
        const parts = filename.split('.');
        // 如果文件名以点开头但没有扩展名（如.gitignore），已经在上面处理
        const ext = parts.length > 1 ? parts.pop().toLowerCase() : '';
        
        // 编程语言和文件类型映射
        const iconMap = {
            // 前端开发
            'js': 'javascript', 'jsx': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
            'ts': 'typescript', 'tsx': 'typescript', 'mts': 'typescript', 'cts': 'typescript',
            'html': 'html', 'htm': 'html',
            'css': 'css', 'scss': 'scss', 'sass': 'scss', 'less': 'less', 'styl': 'css',
            
            // 数据格式
            'json': 'json', 'jsonc': 'json', 'json5': 'json',
            'xml': 'xml', 'xsd': 'xml', 'xsl': 'xml',
            'yaml': 'yaml', 'yml': 'yaml',
            'csv': 'csv',
            'md': 'markdown', 'markdown': 'markdown',
            'txt': 'text', 'log': 'text', 'sh': 'text', 'bat': 'text',
            
            // 后端语言
            'py': 'python', 'pyw': 'python', 'pyx': 'python',
            'java': 'java', 'class': 'java', 'jar': 'java',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin', 'kts': 'kotlin',
            'dart': 'dart',
            'cs': 'csharp',
            'fsharp': 'fsharp', 'fs': 'fsharp',
            'vb': 'vb',
            'pl': 'perl', 'pm': 'perl',
            
            // 系统语言
            'c': 'c', 'h': 'header',
            'cpp': 'cpp', 'cc': 'cpp', 'cxx': 'cpp', 'hpp': 'cpp', 'hh': 'cpp', 'hxx': 'cpp',
            'objc': 'objective-c', 'm': 'objective-c', 'mm': 'objective-c',
            'asm': 'asm', 's': 'asm',
            
            // 配置文件
            'ini': 'config', 'properties': 'config', 'conf': 'config', 'cfg': 'config',
            'env': 'config', 'env.local': 'config', 'env.development': 'config', 'env.production': 'config',
            'nginx.conf': 'config',
            
            // 图片
            'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image',
            'svg': 'image', 'ico': 'image', 'webp': 'image', 'bmp': 'image',
            'tiff': 'image', 'tif': 'image',
            
            // 视频和音频
            'mp4': 'media', 'avi': 'media', 'mov': 'media', 'wmv': 'media', 'flv': 'media',
            'mp3': 'media', 'wav': 'media', 'ogg': 'media', 'flac': 'media',
            
            // 压缩文件
            'zip': 'archive', 'rar': 'archive', '7z': 'archive', 'tar': 'archive',
            'gz': 'archive', 'bz2': 'archive', 'xz': 'archive',
            
            // 文档
            'pdf': 'pdf',
            'doc': 'word', 'docx': 'word',
            'xls': 'excel', 'xlsx': 'excel',
            'ppt': 'powerpoint', 'pptx': 'powerpoint',
            
            // 其他常见文件
            'exe': 'executable', 'dll': 'executable', 'so': 'executable', 'dylib': 'executable',
            'sql': 'sql',
            'dockerfile': 'docker'
        };
        
        return iconMap[ext] || iconMap[lowerName] || 'default';
    }

    // 切换文件夹展开/折叠 - VSCode风格的展开/折叠逻辑
    async toggleFolder(treeItem) {
        const isExpanded = treeItem.classList.contains('expanded');
        const toggle = treeItem.querySelector('.tree-toggle');
        const icon = treeItem.querySelector('.tree-icon');
        const path = treeItem.dataset.path;
        
        // 防止重复点击和加载
        if (treeItem.dataset.loading === 'true') {
            return;
        }
        
        // 添加动画类
        treeItem.classList.add('animating');
        
        if (isExpanded) {
            // 折叠文件夹 - VSCode风格的折叠行为
            treeItem.classList.remove('expanded');
            toggle.classList.remove('expanded');
            toggle.classList.add('collapsed');
            
            // 更新文件夹图标状态
            if (icon.classList.contains('directory')) {
                icon.classList.remove('expanded');
            }
            
            // 隐藏子内容 - 使用CSS控制显示/隐藏，保留DOM结构
            const childrenContainer = treeItem.querySelector('.tree-children');
            if (childrenContainer) {
                // 等待动画完成后完全隐藏
                setTimeout(() => {
                    treeItem.classList.remove('animating');
                }, 150);
            }
        } else {
            // 展开文件夹 - VSCode风格的展开行为
            treeItem.classList.add('expanded');
            toggle.classList.add('expanded');
            toggle.classList.remove('collapsed');
            
            // 更新文件夹图标状态
            if (icon.classList.contains('directory')) {
                icon.classList.add('expanded');
            }
            
            // 获取子容器
            let childrenContainer = treeItem.querySelector('.tree-children');
            
            // 如果没有加载过子内容，进行加载
            if (childrenContainer && !treeItem.dataset.loaded) {
                treeItem.dataset.loading = 'true';
                
                try {
                    // 模拟加载延迟，让体验更接近VSCode
                    await new Promise(resolve => setTimeout(resolve, 50));
                    
                    // 加载文件夹内容
                    const result = await this.fileSystem.readDirectory(path);
                    
                    if (result.success && result.data) {
                        // 过滤并排序子项 - VSCode风格的排序：文件夹在前，然后按名称排序
                        const children = result.data.filter(item => 
                            item.name !== '.' && item.name !== '..'
                        ).sort((a, b) => {
                            // 文件夹总是排在文件前面
                            const aIsDir = a.type === 'directory' || a.kind === 'directory';
                            const bIsDir = b.type === 'directory' || b.kind === 'directory';
                            
                            if (aIsDir !== bIsDir) {
                                return aIsDir ? -1 : 1;
                            }
                            
                            // 同类型按名称排序（考虑特殊字符和大小写）
                            return this.compareFileNames(a.name, b.name);
                        });
                        
                        // 清空容器
                        childrenContainer.innerHTML = '';
                        
                        // 创建子项
                        children.forEach(child => {
                            // 计算下一级的缩进
                            const level = treeItem.dataset.path === '/' ? 1 : 
                                treeItem.dataset.path.split('/').filter(Boolean).length + 1;
                            
                            const childItem = this.createTreeItem({
                                ...child,
                                path: `${path}/${child.name}`
                            }, level);
                            childrenContainer.appendChild(childItem);
                        });
                        
                        treeItem.dataset.loaded = 'true';
                    } else {
                        // 如果加载失败，显示详细的错误消息
                        const errorMessage = this.getDetailedErrorMessage(result);
                        this.showError(`无法打开文件夹: ${errorMessage}`);
                        // 回滚状态
                        treeItem.classList.remove('expanded');
                        toggle.classList.remove('expanded');
                        toggle.classList.add('collapsed');
                    }
                } catch (error) {
                    this.showError(`加载文件夹内容时发生错误: ${error.message}`);
                    // 回滚状态
                    treeItem.classList.remove('expanded');
                    toggle.classList.remove('expanded');
                    toggle.classList.add('collapsed');
                } finally {
                    treeItem.dataset.loading = 'false';
                    // 等待动画完成
                    setTimeout(() => {
                        treeItem.classList.remove('animating');
                    }, 150);
                }
            } else {
                // 已加载过内容，直接显示
                setTimeout(() => {
                    treeItem.classList.remove('animating');
                }, 150);
            }
        }
    }
    
    // VSCode风格的文件名比较函数
    compareFileNames(a, b) {
        // 特殊处理带点的文件名（如.gitignore应该排在其他文件前面）
        const aHasDot = a.startsWith('.');
        const bHasDot = b.startsWith('.');
        
        if (aHasDot !== bHasDot) {
            return aHasDot ? -1 : 1;
        }
        
        // 不区分大小写的比较
        return a.toLowerCase().localeCompare(b.toLowerCase());
    }

    // 获取详细的错误消息
    getDetailedErrorMessage(result) {
        if (!result || !result.error) {
            return '未知错误';
        }

        const error = result.error;
        const code = result.code;

        // 根据错误代码提供具体的解决方案
        const errorSolutions = {
            'INVALID_FILE_HANDLE': '文件句柄无效，请重新选择文件夹或刷新页面',
            'INVALID_DIRECTORY_HANDLE': '目录句柄无效，请重新选择文件夹或刷新页面',
            'DIRECTORY_NOT_FOUND': '目录不存在，请检查路径是否正确',
            'DIRECTORY_ITERATION_ERROR': '无法读取目录内容，请检查权限设置',
            'READ_ERROR': '读取文件失败，请检查文件权限',
            'GET_INFO_ERROR': '获取文件信息失败，文件可能已被删除或移动',
            'SecurityError': '安全错误：请确保从HTTPS或localhost访问，或检查浏览器权限设置',
            'NotAllowedError': '权限被拒绝：请允许访问文件系统权限',
            'AbortError': '操作被用户取消'
        };

        // 如果有错误代码，优先使用对应的解决方案
        if (code && errorSolutions[code]) {
            return errorSolutions[code];
        }

        // 检查错误消息中是否包含特定的关键词
        if (error.includes('getFile is not a function')) {
            return '文件系统API不兼容，请使用支持的浏览器或切换到服务器模式';
        }

        if (error.includes('Permission denied') || error.includes('NotAllowedError')) {
            return '权限被拒绝，请检查浏览器权限设置或使用服务器模式';
        }

        if (error.includes('SecurityError') || error.includes('secure context')) {
            return '安全错误：请使用HTTPS或localhost访问，或切换到服务器模式';
        }

        // 默认返回原始错误消息
        return error;
    }

    // 选择文件
    selectFile(treeItem) {
        // 清除之前的选择
        document.querySelectorAll('.tree-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        
        // 设置当前选择
        treeItem.classList.add('selected');
        this.selectedFiles.clear();
        this.selectedFiles.add(treeItem.dataset.path);
    }

    // 显示右键上下文菜单
    showContextMenu(event, treeItem) {
        // 先关闭可能存在的其他菜单
        this.hideContextMenu();
        
        // 选择当前文件
        this.selectFile(treeItem);
        
        // 创建菜单容器
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: var(--vscode-menu-background);
            border: 1px solid var(--vscode-menu-border);
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            min-width: 160px;
            font-size: 13px;
            color: var(--vscode-menu-foreground);
        `;
        
        const itemType = treeItem.dataset.type;
        const isDirectory = itemType === 'directory';
        
        // 构建菜单项
        const menuItems = [
            { label: '新建文件', action: () => this.createNewFile(), icon: '📄' },
            { label: '新建文件夹', action: () => this.createNewFolder(), icon: '📁' },
            { separator: true },
            { label: '打开', action: () => this.openSelectedFile(), icon: '📂' },
            { label: '在资源管理器中显示', action: () => this.revealInExplorer(), icon: '🔍' },
            { separator: true },
            { label: '重命名', action: () => this.renameFile(), icon: '✏️' },
            { label: '删除', action: () => this.deleteFile(), icon: '🗑️' },
            { separator: true },
            { label: '复制', action: () => this.copyFile(), icon: '📋' },
            { label: '粘贴', action: () => this.pasteFile(), icon: '📤' },
            { label: '剪切', action: () => this.cutFile(), icon: '✂️' }
        ];
        
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: var(--vscode-menu-separatorBackground);
                    margin: 4px 8px;
                `;
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'context-menu-item';
                menuItem.innerHTML = `
                    <span class="menu-item-icon">${item.icon}</span>
                    <span class="menu-item-label">${item.label}</span>
                `;
                menuItem.style.cssText = `
                    padding: 6px 12px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background-color 0.1s ease;
                `;
                
                menuItem.addEventListener('mouseenter', () => {
                    menuItem.style.background = 'var(--vscode-menu-selectionBackground)';
                    menuItem.style.color = 'var(--vscode-menu-selectionForeground)';
                });
                
                menuItem.addEventListener('mouseleave', () => {
                    menuItem.style.background = '';
                    menuItem.style.color = '';
                });
                
                menuItem.addEventListener('click', () => {
                    item.action();
                    this.hideContextMenu();
                });
                
                menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(menu);
        this.currentContextMenu = menu;
        
        // 点击其他地方关闭菜单
        setTimeout(() => {
            document.addEventListener('click', this.hideContextMenu.bind(this), { once: true });
        }, 100);
    }

    // 隐藏上下文菜单
    hideContextMenu() {
        if (this.currentContextMenu) {
            document.body.removeChild(this.currentContextMenu);
            this.currentContextMenu = null;
        }
    }

    // 创建新文件
    async createNewFile() {
        const fileName = prompt('请输入文件名:');
        if (fileName) {
            const filePath = `${this.currentDirectory}/${fileName}`;
            const result = await this.fileSystem.writeFile(filePath, '');
            if (result.success) {
                this.app.showOutput(`文件创建成功: ${fileName}`);
                await this.loadFileTree();
            } else {
                this.showError('创建文件失败: ' + result.error);
            }
        }
    }

    // 创建新文件夹
    async createNewFolder() {
        const folderName = prompt('请输入文件夹名:');
        if (folderName) {
            const folderPath = `${this.currentDirectory}/${folderName}`;
            const result = await this.fileSystem.createDirectory(folderPath);
            if (result.success) {
                this.app.showOutput(`文件夹创建成功: ${folderName}`);
                await this.loadFileTree();
            } else {
                this.showError('创建文件夹失败: ' + result.error);
            }
        }
    }

    // 打开选中的文件
    openSelectedFile() {
        const selectedPath = Array.from(this.selectedFiles)[0];
        if (selectedPath) {
            this.openFile(selectedPath);
        }
    }

    // 在资源管理器中显示
    revealInExplorer() {
        this.app.showOutput('此功能在当前环境中不可用');
    }

    // 重命名文件
    async renameFile() {
        const selectedPath = Array.from(this.selectedFiles)[0];
        if (selectedPath) {
            const newName = prompt('请输入新名称:');
            if (newName) {
                const newPath = selectedPath.split('/').slice(0, -1).concat(newName).join('/');
                
                // 调试信息
                console.log('FileSystem object:', this.fileSystem);
                console.log('Available methods:', Object.getOwnPropertyNames(this.fileSystem));
                console.log('Calling renameFile with:', selectedPath, newPath);
                
                try {
                    const result = await this.fileSystem.renameFile(selectedPath, newPath);
                    if (result.success) {
                        this.app.showOutput(`重命名成功: ${selectedPath} -> ${newPath}`);
                        await this.loadFileTree();
                    } else {
                        this.showError('重命名失败: ' + result.error);
                    }
                } catch (error) {
                    console.error('Rename error:', error);
                    this.showError('重命名失败: ' + error.message);
                }
            }
        }
    }

    // 删除文件
    async deleteFile() {
        const selectedPath = Array.from(this.selectedFiles)[0];
        if (selectedPath && confirm(`确定要删除 ${selectedPath} 吗？`)) {
            const result = await this.fileSystem.deleteItem(selectedPath);
            if (result.success) {
                this.app.showOutput(`删除成功: ${selectedPath}`);
                await this.loadFileTree();
            } else {
                this.showError('删除失败: ' + result.error);
            }
        }
    }

    // 复制文件
    copyFile() {
        const selectedPath = Array.from(this.selectedFiles)[0];
        if (selectedPath) {
            this.clipboard = { action: 'copy', path: selectedPath };
            this.app.showOutput(`已复制: ${selectedPath}`);
        }
    }

    // 剪切文件
    cutFile() {
        const selectedPath = Array.from(this.selectedFiles)[0];
        if (selectedPath) {
            this.clipboard = { action: 'cut', path: selectedPath };
            this.app.showOutput(`已剪切: ${selectedPath}`);
        }
    }

    // 粘贴文件
    async pasteFile() {
        if (this.clipboard) {
            const sourcePath = this.clipboard.path;
            const targetPath = `${this.currentDirectory}/${sourcePath.split('/').pop()}`;
            
            // 调试信息
            console.log('Clipboard action:', this.clipboard.action);
            console.log('Source path:', sourcePath);
            console.log('Target path:', targetPath);
            
            try {
                if (this.clipboard.action === 'copy') {
                    console.log('Calling copyFile...');
                    const result = await this.fileSystem.copyFile(sourcePath, targetPath);
                    if (result.success) {
                        this.app.showOutput(`粘贴成功: ${targetPath}`);
                        await this.loadFileTree();
                    } else {
                        this.showError('粘贴失败: ' + result.error);
                    }
                } else if (this.clipboard.action === 'cut') {
                    console.log('Calling moveFile...');
                    const result = await this.fileSystem.moveFile(sourcePath, targetPath);
                    if (result.success) {
                        this.app.showOutput(`移动成功: ${sourcePath} -> ${targetPath}`);
                        this.clipboard = null;
                        await this.loadFileTree();
                    } else {
                        this.showError('移动失败: ' + result.error);
                    }
                }
            } catch (error) {
                console.error('Paste error:', error);
                this.showError('粘贴失败: ' + error.message);
            }
        }
    }

    // 导航到目录
    async navigateToDirectory(directoryPath) {
        this.currentDirectory = directoryPath;
        await this.loadFileTree(directoryPath);
    }

    // 打开文件
    async openFile(filePath) {
        try {
            // 如果是README.md文件，尝试直接读取项目根目录的文件
            let targetPath = filePath;
            if (filePath === 'README.md' && this.currentDirectory) {
                // 尝试从项目根目录读取README.md
                const readmePath = this.currentDirectory + '/README.md';
                const result = await this.fileSystem.readFile(readmePath);
                if (result.success) {
                    // 触发文件打开事件，让编辑器加载内容
                    window.dispatchEvent(new CustomEvent('fileOpened', {
                        detail: { filePath: readmePath, content: result.content }
                    }));
                    return;
                }
            }
            
            const result = await this.fileSystem.readFile(targetPath);
            if (result.success) {
                // 触发文件打开事件，让编辑器加载内容
                window.dispatchEvent(new CustomEvent('fileOpened', {
                    detail: { filePath: targetPath, content: result.content }
                }));
            } else {
                this.showError('打开文件失败: ' + result.error);
            }
        } catch (error) {
            this.showError('打开文件失败: ' + error.message);
        }
    }

    // 显示成功信息
    showSuccess(message) {
        console.log(message);
        // 临时使用alert，后续可以替换为更好的成功提示组件
        alert('✅ ' + message);
    }

    // 显示错误信息
    showError(message) {
        console.error(message);
        // 使用应用的错误处理系统
        if (this.app && this.app.showError) {
            this.app.showError(message);
        } else {
            // 降级使用alert
            alert('❌ ' + message);
        }
    }

    // 设置文件监视器
    setupFileWatcher() {
        if (this.currentWatcher) {
            this.currentWatcher.close();
        }
        
        if (typeof EventSource !== 'undefined') {
            const watchUrl = `${this.apiBase}/watch?path=${encodeURIComponent(this.currentDirectory)}`;
            this.eventSource = new EventSource(watchUrl);
            
            this.eventSource.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    console.log('文件系统变化:', data);
                    // 重新加载文件树
                    this.loadFileTree();
                } catch (error) {
                    console.error('解析文件监视事件失败:', error);
                }
            };
            
            this.eventSource.onerror = (error) => {
                console.error('文件监视连接错误:', error);
                // 尝试重新连接
                setTimeout(() => {
                    if (this.eventSource) {
                        this.eventSource.close();
                        this.setupFileWatcher();
                    }
                }, 5000);
            };
        }
    }

    // 导航到目录（带监视器更新）
    async navigateToDirectory(directoryPath) {
        this.currentDirectory = directoryPath;
        // 重新设置文件监视器
        this.setupFileWatcher();
        await this.loadFileTree(directoryPath);
    }

    showInputDialog(title, message, defaultValue, callback) {
        // 创建对话框遮罩
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 999;
        `;

        // 创建对话框
        const dialog = document.createElement('div');
        dialog.className = 'input-dialog';
        dialog.innerHTML = `
            <h3>${title}</h3>
            <p style="margin-bottom: 10px; color: var(--vscode-descriptionForeground, #cccccc);">${message}</p>
            <input type="text" id="dialog-input" value="${defaultValue}" style="width: 100%; padding: 8px; margin-bottom: 15px;">
            <div class="input-dialog-buttons">
                <button class="btn-secondary" id="dialog-cancel">取消</button>
                <button class="btn-primary" id="dialog-confirm">确定</button>
            </div>
        `;

        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        // 获取输入框和按钮
        const input = dialog.querySelector('#dialog-input');
        const confirmBtn = dialog.querySelector('#dialog-confirm');
        const cancelBtn = dialog.querySelector('#dialog-cancel');

        // 聚焦输入框
        input.focus();
        input.select();

        // 事件处理
        const cleanup = () => {
            document.body.removeChild(overlay);
        };

        const handleConfirm = () => {
            const value = input.value.trim();
            cleanup();
            if (value) {
                callback(value);
            }
        };

        const handleCancel = () => {
            cleanup();
        };

        // 绑定事件
        confirmBtn.addEventListener('click', handleConfirm);
        cancelBtn.addEventListener('click', handleCancel);

        // 回车确认，ESC取消
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleConfirm();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });

        // 点击遮罩关闭
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                handleCancel();
            }
        });
    }

    setupFileOperationButtons() {
        // 新建文件按钮
        const newFileBtn = document.getElementById('new-file-btn');
        if (newFileBtn) {
            newFileBtn.addEventListener('click', () => {
                this.createNewFile(this.currentDirectory);
            });
        }

        // 新建文件夹按钮
        const newFolderBtn = document.getElementById('new-folder-btn');
        if (newFolderBtn) {
            newFolderBtn.addEventListener('click', () => {
                this.createNewFolder(this.currentDirectory);
            });
        }

        // 重命名按钮
        const renameBtn = document.getElementById('rename-btn');
        if (renameBtn) {
            renameBtn.addEventListener('click', () => {
                const selectedItem = document.querySelector('.file-item.selected');
                if (selectedItem) {
                    this.renameFile(selectedItem.dataset.path);
                } else {
                    this.app.showError('请先选择要重命名的文件或文件夹');
                }
            });
        }

        // 删除按钮
        const deleteBtn = document.getElementById('delete-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', () => {
                const selectedItem = document.querySelector('.file-item.selected');
                if (selectedItem) {
                    this.deleteFile(selectedItem.dataset.path);
                } else {
                    this.app.showError('请先选择要删除的文件或文件夹');
                }
            });
        }

        // 移动按钮
        const moveBtn = document.getElementById('move-btn');
        if (moveBtn) {
            moveBtn.addEventListener('click', () => {
                const selectedItem = document.querySelector('.file-item.selected');
                if (selectedItem) {
                    this.moveFile(selectedItem.dataset.path);
                } else {
                    this.app.showError('请先选择要移动的文件或文件夹');
                }
            });
        }

        // 为文件项添加点击选择功能
        this.setupFileSelection();
    }

    setupFileSelection() {
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return;

        fileTree.addEventListener('click', (e) => {
            const fileItem = e.target.closest('.file-item');
            if (fileItem) {
                // 移除之前的选择
                document.querySelectorAll('.file-item.selected').forEach(item => {
                    item.classList.remove('selected');
                });
                
                // 添加新的选择
                fileItem.classList.add('selected');
            }
        });
    }

    moveFile(sourcePath) {
        const fileInfo = this.fileTree.get(sourcePath);
        if (!fileInfo) return;

        this.showInputDialog('移动文件', `将 "${fileInfo.name}" 移动到哪个路径?`, this.currentDirectory || '/', async (targetPath) => {
            if (!targetPath.trim()) {
                this.showError('目标路径不能为空');
                return;
            }
            
            try {
                const result = await this.apiCall('/item/move', {
                    method: 'PUT',
                    body: JSON.stringify({ 
                        sourcePath, 
                        targetPath 
                    })
                });
                
                if (result.success) {
                    await this.loadFileTree();
                    this.app.showOutput('移动成功');
                } else {
                    this.showError('移动失败: ' + result.error);
                }
            } catch (error) {
                this.showError('移动失败: ' + error.message);
            }
        });
    }

    setupFileSearch() {
        const searchInput = document.getElementById('file-search');
        if (!searchInput) {
            // 创建搜索输入框
            const searchContainer = document.createElement('div');
            searchContainer.className = 'file-search-container';
            searchContainer.innerHTML = `
                <input type="text" id="file-search" placeholder="搜索文件..." style="width: 100%; padding: 5px; margin-bottom: 10px;">
            `;
            
            const fileTree = document.getElementById('file-tree');
            if (fileTree) {
                fileTree.parentNode.insertBefore(searchContainer, fileTree);
            }
            
            // 重新获取搜索输入框
            this.setupFileSearch();
            return;
        }

        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            this.filterFiles(searchTerm);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.filterFiles('');
            }
        });
    }

    filterFiles(searchTerm) {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileName = item.querySelector('.file-name').textContent.toLowerCase();
            const isMatch = fileName.includes(searchTerm);
            
            if (isMatch || searchTerm === '') {
                item.style.display = 'flex';
                item.style.opacity = '1';
            } else {
                item.style.display = 'none';
            }
        });

        // 高亮匹配的文本
        if (searchTerm) {
            this.highlightSearchResults(searchTerm);
        }
    }

    highlightSearchResults(searchTerm) {
        const fileItems = document.querySelectorAll('.file-item');
        
        fileItems.forEach(item => {
            const fileNameElement = item.querySelector('.file-name');
            const fileName = fileNameElement.textContent;
            
            if (fileName.toLowerCase().includes(searchTerm.toLowerCase())) {
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const highlightedName = fileName.replace(regex, '<mark>$1</mark>');
                fileNameElement.innerHTML = highlightedName;
            } else {
                fileNameElement.textContent = fileName;
            }
        });
    }

    setupFileContextMenu() {
        const fileTree = document.getElementById('file-tree');
        if (!fileTree) return;

        // 如果已存在右键菜单，先移除
        const existingMenu = document.getElementById('file-context-menu');
        if (existingMenu) {
            existingMenu.remove();
        }

        // 创建右键菜单
        const contextMenu = document.createElement('div');
        contextMenu.id = 'file-context-menu';
        contextMenu.className = 'context-menu';
        contextMenu.style.display = 'none';
        contextMenu.style.position = 'fixed';
        contextMenu.style.zIndex = '10000';
        contextMenu.innerHTML = `
            <div class="context-menu-item" data-action="rename">重命名</div>
            <div class="context-menu-item" data-action="delete">删除</div>
            <div class="context-menu-separator"></div>
            <div class="context-menu-item" data-action="new-file">新建文件</div>
            <div class="context-menu-item" data-action="new-folder">新建文件夹</div>
        `;
        
        document.body.appendChild(contextMenu);

        // 右键点击事件
        fileTree.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const target = e.target.closest('.file-item');
            if (target) {
                this.showContextMenu(e.clientX, e.clientY, target);
            }
        });

        // 点击其他地方隐藏菜单
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.style.display = 'none';
            }
        });

        // 菜单项点击事件
        contextMenu.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                this.handleContextMenuAction(action, contextMenu.dataset.target);
            }
        });

        // 防止右键菜单被其他元素遮挡
        contextMenu.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    showContextMenu(x, y, targetElement) {
        const contextMenu = document.getElementById('file-context-menu');
        if (!contextMenu) return;

        contextMenu.style.display = 'block';
        contextMenu.dataset.target = targetElement.dataset.path;

        // 先显示菜单以获取尺寸
        const rect = contextMenu.getBoundingClientRect();
        
        // 计算位置，确保菜单不超出视窗
        let left = x;
        let top = y;
        
        // 如果菜单会超出右边界，向左显示
        if (x + rect.width > window.innerWidth) {
            left = x - rect.width;
        }
        
        // 如果菜单会超出下边界，向上显示
        if (y + rect.height > window.innerHeight) {
            top = y - rect.height;
        }
        
        // 确保不会超出左边界和上边界
        left = Math.max(0, left);
        top = Math.max(0, top);
        
        contextMenu.style.left = left + 'px';
        contextMenu.style.top = top + 'px';
    }

    handleContextMenuAction(action, targetPath) {
        const contextMenu = document.getElementById('file-context-menu');
        contextMenu.style.display = 'none';

        switch (action) {
            case 'rename':
                this.renameFile(targetPath);
                break;
            case 'delete':
                this.deleteFile(targetPath);
                break;
            case 'new-file':
                this.createNewFile(targetPath);
                break;
            case 'new-folder':
                this.createNewFolder(targetPath);
                break;
        }
    }

    async renameFile(filePath) {
        console.log('renameFile called with path:', filePath);
        const fileInfo = this.fileTree.get(filePath);
        if (!fileInfo) return;

        this.showInputDialog('重命名文件', '请输入新的文件名:', fileInfo.name, async (newName) => {
            if (!newName.trim()) {
                this.showError('文件名不能为空');
                return;
            }
            
            try {
                console.log('Calling fileSystem.renameFile with:', filePath, newName);
                const result = await this.fileSystem.renameFile(filePath, newName);
                console.log('renameFile result:', result);
                if (result.success) {
                    await this.loadFileTree();
                    this.showSuccess('重命名成功');
                } else {
                    this.showError('重命名失败: ' + result.error);
                }
            } catch (error) {
                console.error('renameFile error:', error);
                this.showError('重命名失败: ' + error.message);
            }
        });
    }

    async deleteFile(filePath) {
        console.log('deleteFile called with path:', filePath);
        const fileInfo = this.fileTree.get(filePath);
        if (!fileInfo) return;

        if (!confirm(`确定要删除 "${fileInfo.name}" 吗？`)) {
            return;
        }
        
        try {
            console.log('Calling fileSystem.deleteItem with:', filePath);
            const result = await this.fileSystem.deleteItem(filePath);
            console.log('deleteItem result:', result);
            if (result.success) {
                await this.loadFileTree();
                this.app.showOutput('删除成功');
            } else {
                this.showError('删除失败: ' + result.error);
            }
        } catch (error) {
            console.error('deleteItem error:', error);
            this.showError('删除失败: ' + error.message);
        }
    }

    async createNewFile(folderPath = null) {
        const targetPath = folderPath || this.currentDirectory;
        this.showInputDialog('新建文件', '请输入新文件名:', '', async (fileName) => {
            if (!fileName.trim()) {
                this.showError('文件名不能为空');
                return;
            }
            
            try {
                const result = await this.fileSystem.createFile(targetPath, fileName);
                if (result.success) {
                    await this.loadFileTree();
                    this.showSuccess('文件创建成功');
                } else {
                    this.showError('创建文件失败: ' + result.error);
                }
            } catch (error) {
                this.showError('创建文件失败: ' + error.message);
            }
        });
    }

    async createNewFolder(folderPath = null) {
        const targetPath = folderPath || this.currentDirectory;
        
        // 检查是否有权限访问文件系统
        if (!this.currentDirectoryHandle) {
            this.showError('无法创建文件夹：根目录句柄不存在，请先选择工作目录');
            return;
        }
        
        this.showInputDialog('新建文件夹', '请输入新文件夹名:', '', async (folderName) => {
            if (!folderName.trim()) {
                this.showError('文件夹名不能为空');
                return;
            }
            
            // 验证文件夹名称
            if (!/^[a-zA-Z0-9_\-\.\u4e00-\u9fa5]+$/.test(folderName)) {
                this.showError('文件夹名包含非法字符，请使用字母、数字、下划线、连字符或中文');
                return;
            }
            
            try {
                console.log('创建文件夹:', targetPath, folderName);
                const result = await this.fileSystem.createDirectory(targetPath, folderName);
                if (result.success) {
                    await this.loadFileTree();
                    this.showSuccess(`文件夹 "${folderName}" 创建成功`);
                } else {
                    console.error('创建文件夹失败:', result.error);
                    this.showError('创建文件夹失败: ' + result.error);
                }
            } catch (error) {
                console.error('创建文件夹异常:', error);
                this.showError('创建文件夹失败: ' + error.message);
            }
        });
    }

    async openFolder() {
        try {
            // 检查浏览器兼容性
            if (window.browserCompatibilityFix) {
                const compatibility = window.browserCompatibilityFix.checkCompatibility();
                if (!compatibility.supported) {
                    console.warn('浏览器兼容性问题:', compatibility.issues);
                    this.app.showError('浏览器兼容性问题: ' + compatibility.issues.join(', '));
                }
            }

            // 使用 File System Access API
            if ('showDirectoryPicker' in window) {
                // 确保在用户交互上下文中调用
                const directoryHandle = await window.showDirectoryPicker({
                    mode: 'readwrite',
                    startIn: 'desktop'
                });
                await this.loadDirectory(directoryHandle);
                this.app.showOutput(`已打开文件夹: ${directoryHandle.name}`);
            } else {
                // 降级方案：使用 input type="file" 的 webkitdirectory
                this.app.showOutput('使用降级方案打开文件夹');
                this.fallbackOpenFolder();
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                let errorMessage = `打开文件夹失败: ${error.message}`;
                
                // 提供更具体的错误信息
                if (error.name === 'SecurityError') {
                    errorMessage = '安全错误：文件系统API需要用户手势触发。请确保在点击事件中调用。';
                } else if (error.message.includes('文件系统')) {
                    errorMessage = '文件系统访问失败：请检查浏览器权限或使用支持的浏览器。';
                }
                
                this.app.showError(errorMessage);
                console.error('文件系统错误详情:', error);
            }
        }
    }

    async loadDirectory(directoryHandle, path = '') {
        this.currentDirectory = path || '/';
        this.currentDirectoryHandle = directoryHandle;
        this.fileTree.clear();
        
        const fileTreeElement = document.getElementById('file-tree');
        fileTreeElement.innerHTML = '';
        
        await this.renderDirectory(directoryHandle, fileTreeElement, path);
        
        // 保存最近打开的文件夹
        localStorage.setItem('recent-folder', directoryHandle.name);
    }

    async renderDirectory(directoryHandle, container, path = '') {
        const entries = [];
        
        for await (const entry of directoryHandle.values()) {
            entries.push({
                name: entry.name,
                kind: entry.kind,
                handle: entry
            });
        }
        
        // 排序：文件夹在前，文件在后，按名称排序
        entries.sort((a, b) => {
            if (a.kind !== b.kind) {
                return a.kind === 'directory' ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });
        
        for (const entry of entries) {
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            itemElement.dataset.path = path + '/' + entry.name;
            itemElement.dataset.kind = entry.kind;
            
            const icon = entry.kind === 'directory' ? '📁' : this.getFileIcon(entry.name);
            itemElement.innerHTML = `
                <span class="file-icon">${icon}</span>
                <span class="file-name">${entry.name}</span>
            `;
            
            itemElement.addEventListener('click', async () => {
                if (entry.kind === 'directory') {
                    await this.toggleDirectory(entry.handle, itemElement, path + '/' + entry.name);
                } else {
                    await this.openFile(entry.handle);
                }
            });
            
            container.appendChild(itemElement);
            
            // 存储文件信息
            this.fileTree.set(path + '/' + entry.name, {
                name: entry.name,
                kind: entry.kind,
                handle: entry.handle,
                element: itemElement
            });
        }
    }

    async toggleDirectory(directoryHandle, element, path) {
        const childrenContainer = element.querySelector('.folder-children');
        
        if (childrenContainer) {
            // 折叠文件夹
            childrenContainer.remove();
            element.classList.remove('expanded');
        } else {
            // 展开文件夹
            const newChildrenContainer = document.createElement('div');
            newChildrenContainer.className = 'folder-children';
            element.appendChild(newChildrenContainer);
            
            await this.renderDirectory(directoryHandle, newChildrenContainer, path);
            element.classList.add('expanded');
        }
    }

    async openFile(fileHandle) {
        try {
            // 检查文件句柄类型和有效性
            if (!fileHandle || typeof fileHandle.getFile !== 'function') {
                console.error('无效的文件句柄:', fileHandle);
                this.app.showError('文件句柄无效或已损坏，请重新选择文件夹');
                return;
            }

            const file = await fileHandle.getFile();
            const content = await file.text();
            const path = this.currentDirectory !== '/' ? 
                this.currentDirectory + '/' + file.name : '/' + file.name;
            
            // 在编辑器中打开文件
            this.app.addTab(path, content);
            
            this.app.showOutput(`已打开文件: ${file.name}`);
            
            // 添加到最近文件列表
            this.addToRecentFiles(path);
            
        } catch (error) {
            console.error('打开文件失败:', error);
            
            // 提供具体的错误信息
            let errorMessage = '打开文件失败: ';
            if (error.message.includes('getFile is not a function')) {
                errorMessage += '文件系统API不兼容，请使用支持的浏览器或切换到服务器模式';
            } else if (error.name === 'SecurityError') {
                errorMessage += '安全错误，请检查浏览器权限设置';
            } else if (error.name === 'NotAllowedError') {
                errorMessage += '权限被拒绝，请允许文件访问权限';
            } else {
                errorMessage += error.message;
            }
            
            this.app.showError(errorMessage);
        }
    }

    async saveFile(filePath, content) {
        try {
            // 从路径中提取文件名
            const fileName = filePath.split('/').pop();
            
            // 查找文件句柄
            let fileHandle = null;
            for (const [path, info] of this.fileTree) {
                if (path.endsWith(fileName) && info.kind === 'file') {
                    fileHandle = info.handle;
                    break;
                }
            }
            
            if (!fileHandle && 'showSaveFilePicker' in window) {
                // 如果没有找到文件句柄，显示保存对话框
                fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'Text Files',
                        accept: { 'text/plain': ['.txt'] }
                    }]
                });
            }
            
            if (fileHandle) {
                // 创建写入流
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                
                return true;
            } else {
                throw new Error('无法获取文件句柄');
            }
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                throw new Error(`保存文件失败: ${error.message}`);
            }
            return false;
        }
    }

    setAutoSave(enabled, delay = 1000) {
        // 自动保存功能主要在EditorManager中处理
        if (this.app.editorManager) {
            this.app.editorManager.setAutoSave(enabled);
        }
        console.log(`自动保存 ${enabled ? '已启用' : '已禁用'}`);
    }

    fallbackOpenFolder() {
        // 创建文件输入元素
        const input = document.createElement('input');
        input.type = 'file';
        input.webkitdirectory = true;
        input.multiple = true;
        
        input.onchange = async (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                await this.loadFilesFromInput(files);
            }
        };
        
        input.click();
    }

    async loadFilesFromInput(files) {
        const fileTreeElement = document.getElementById('file-tree');
        fileTreeElement.innerHTML = '';
        
        // 按目录结构组织文件
        const fileStructure = new Map();
        
        for (const file of files) {
            const pathParts = file.webkitRelativePath.split('/');
            const fileName = pathParts.pop();
            
            let currentLevel = fileStructure;
            for (const part of pathParts) {
                if (!currentLevel.has(part)) {
                    currentLevel.set(part, new Map());
                }
                currentLevel = currentLevel.get(part);
            }
            
            currentLevel.set(fileName, file);
        }
        
        // 渲染文件树
        this.renderFileStructure(fileStructure, fileTreeElement);
        
        this.app.showOutput(`已加载 ${files.length} 个文件`);
    }

    renderFileStructure(structure, container, level = 0) {
        for (const [name, content] of structure) {
            const itemElement = document.createElement('div');
            itemElement.className = 'file-item';
            itemElement.style.paddingLeft = `${level * 20 + 8}px`;
            
            if (content instanceof Map) {
                // 文件夹
                itemElement.innerHTML = `
                    <span class="file-icon">📁</span>
                    <span class="file-name">${name}</span>
                `;
                container.appendChild(itemElement);
                
                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'folder-children';
                container.appendChild(childrenContainer);
                
                this.renderFileStructure(content, childrenContainer, level + 1);
            } else {
                // 文件
                const icon = this.getFileIcon(name);
                itemElement.innerHTML = `
                    <span class="file-icon">${icon}</span>
                    <span class="file-name">${name}</span>
                `;
                
                itemElement.addEventListener('click', async () => {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const content = e.target.result;
                        this.app.addTab(name, content);
                    };
                    reader.readAsText(content);
                });
                
                container.appendChild(itemElement);
            }
        }
    }

    handleFileDrop(files) {
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                this.app.addTab(file.name, content);
                this.app.showOutput(`已打开文件: ${file.name}`);
            };
            reader.readAsText(file);
        }
    }

    getFileIcon(fileName) {
        const extension = fileName.split('.').pop().toLowerCase();
        const iconMap = {
            'js': '📄',
            'html': '🌐',
            'css': '🎨',
            'json': '📋',
            'md': '📝',
            'py': '🐍',
            'java': '☕',
            'cpp': '⚙️',
            'c': '⚙️',
            'h': '🔧',
            'txt': '📄',
            'xml': '📄',
            'yml': '📄',
            'yaml': '📄'
        };
        return iconMap[extension] || '📄';
    }

    searchFiles(query) {
        if (!query.trim()) {
            document.getElementById('search-results').innerHTML = '';
            return;
        }

        const results = [];
        const lowerQuery = query.toLowerCase();
        
        for (const [path, info] of this.fileTree) {
            if (info.kind === 'file') {
                const fileName = info.name.toLowerCase();
                if (fileName.includes(lowerQuery)) {
                    results.push({
                        path: path,
                        name: info.name,
                        handle: info.handle
                    });
                }
            }
        }
        
        this.displaySearchResults(results);
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results');
        resultsContainer.innerHTML = '';
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">没有找到匹配的文件</div>';
            return;
        }
        
        for (const result of results) {
            const resultElement = document.createElement('div');
            resultElement.className = 'search-result';
            resultElement.innerHTML = `
                <div class="result-name">${result.name}</div>
                <div class="result-path">${result.path}</div>
            `;
            
            resultElement.addEventListener('click', async () => {
                await this.openFile(result.handle);
            });
            
            resultsContainer.appendChild(resultElement);
        }
    }

    addToRecentFiles(filePath) {
        let recentFiles = JSON.parse(localStorage.getItem('recent-files') || '[]');
        
        // 移除重复项
        recentFiles = recentFiles.filter(path => path !== filePath);
        
        // 添加到开头
        recentFiles.unshift(filePath);
        
        // 限制数量
        if (recentFiles.length > 10) {
            recentFiles = recentFiles.slice(0, 10);
        }
        
        localStorage.setItem('recent-files', JSON.stringify(recentFiles));
    }

    loadRecentFiles() {
        const recentFiles = JSON.parse(localStorage.getItem('recent-files') || '[]');
        if (recentFiles.length > 0) {
            console.log('最近文件:', recentFiles);
        }
    }

    async createNewFile(folderPath = null) {
        const targetPath = folderPath || this.currentDirectory;
        this.showInputDialog('新建文件', '请输入新文件名:', '', async (newName) => {
            if (!newName.trim()) {
                this.showError('文件名不能为空');
                return;
            }
            
            try {
                const result = await this.fileSystem.createFile(targetPath, newName);
                if (result.success) {
                    await this.loadFileTree();
                    this.showSuccess('文件创建成功');
                } else {
                    this.showError('创建文件失败: ' + result.error);
                }
            } catch (error) {
                this.showError('创建文件失败: ' + error.message);
            }
        });
    }

    async deleteFile(filePath) {
        if (confirm(`确定要删除文件 "${filePath}" 吗？`)) {
            try {
                // 这里需要实现文件删除逻辑
                // 注意：出于安全考虑，浏览器通常不允许删除用户文件
                this.app.showError('出于安全考虑，不支持删除文件功能');
            } catch (error) {
                this.app.showError(`删除文件失败: ${error.message}`);
            }
        }
    }
}

// 将FileManager类导出到全局作用域
window.FileManager = FileManager;