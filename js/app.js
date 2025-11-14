// X IDE 主应用类
class XIDE {
    constructor() {
        this.currentTheme = 'vs-dark';
        this.openTabs = new Map();
        this.activeTab = null;
        this.editorManager = null;
        this.fileManager = null;
        this.terminal = null;
        this.runner = null;
        this.eventsBound = false; // 防止重复绑定事件
        
        // 等待所有脚本加载完成后再初始化
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                // 额外延迟确保所有JavaScript文件都已加载
                setTimeout(() => this.init(), 100);
            });
        } else {
            // DOM已加载完成，但需要确保所有脚本也已加载
            setTimeout(() => this.init(), 100);
        }
    }

    async init() {
        try {
            // 检查所有依赖类是否已加载
            const requiredClasses = ['FileManager', 'Terminal', 'CodeRunner', 'SearchManager', 'SettingsManager'];
            for (const className of requiredClasses) {
                if (typeof window[className] === 'undefined') {
                    console.warn(`${className} 未定义，等待加载...`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                    if (typeof window[className] === 'undefined') {
                        throw new Error(`${className} 类未正确加载`);
                    }
                }
            }
            
            // 初始化主题
            this.initTheme();
            
            // 等待 Monaco Editor 加载
            await this.loadMonacoEditor();
            
            // 初始化各个模块
            this.fileManager = new FileManager(this);
            this.terminal = new Terminal(this);
            this.runner = new CodeRunner(this);
            this.searchManager = new SearchManager(this);
            this.settingsManager = new SettingsManager(this);
            console.log('设置管理器实例创建完成');
            
            // 延迟创建EditorManager，确保Monaco Editor完全加载
            await new Promise(resolve => setTimeout(resolve, 500));
            this.editorManager = new EditorManager(this);
            
            // 等待EditorManager初始化完成
            await this.waitForEditorManager();
            
            // 初始化拖拽功能
            this.resizer = new Resizer(this);
            
            // 初始化文件管理器（延迟到用户交互时）
            if (this.fileManager) {
                // 先进行基本初始化，但不自动选择目录
                await this.fileManager.initBasic();
                console.log('文件管理器已初始化，但等待用户交互选择工作目录');
            }
            
            // 初始化自动保存设置
        if (this.editorManager) {
            this.editorManager.setAutoSave(false);
        }
            
            // 绑定事件
        this.bindEvents();
        
        // 添加fileOpened事件监听器
        window.addEventListener('fileOpened', (event) => {
            console.log('收到fileOpened事件:', event.detail);
            const { filePath, content } = event.detail;
            this.addTab(filePath, content);
        });
        
        // 恢复底部面板标签顺序
        this.restorePanelTabOrder();
        
        // 初始化设置管理器
        if (this.settingsManager) {
            console.log('正在初始化设置管理器...');
            this.settingsManager.init();
        }
            
            // 显示欢迎信息
        this.showOutput('X IDE 已启动', 'info');
        
        console.log('X IDE 初始化完成');
        
        // 延迟初始化设置管理器，确保DOM完全加载
        setTimeout(() => {
            console.log('延迟初始化设置管理器...');
            if (this.settingsManager) {
                this.settingsManager.init();
            }
        }, 1000);
        
        // 将应用实例设置为全局变量，方便设置管理器访问
        window.app = this;
        console.log('应用实例已设置为全局变量:', window.app);
        
        // 添加悬停效果
        // 标题栏帮助按钮悬停效果
        const helpButton = document.getElementById('help-button');
        if (helpButton) {
            helpButton.addEventListener('mouseenter', function() {
                this.style.backgroundColor = '#1177bb';
            });
            
            helpButton.addEventListener('mouseleave', function() {
                this.style.backgroundColor = '';
            });
            
            // 修改查看完整文档按钮的行为
            const helpReadme = document.getElementById('help-readme');
            if (helpReadme) {
                helpReadme.addEventListener('click', function() {
                    // 尝试使用Markdown渲染器打开README.md
                    if (window.app && window.app.fileManager) {
                        window.app.fileManager.openFile('README.md')
                            .then(() => {
                                // 如果打开成功，运行Markdown文件
                                if (window.app.runner) {
                                    window.app.runner.runCurrentFile();
                                }
                            })
                            .catch(error => {
                                console.error('打开README.md失败:', error);
                                // 如果打开失败，尝试直接在新窗口中打开
                                window.open('README.md', '_blank');
                            });
                    } else {
                        // 如果应用还未完全加载，直接打开
                        window.open('README.md', '_blank');
                    }
                });
            }
        }
        } catch (error) {
            console.error('初始化失败:', error);
            this.showError('初始化失败: ' + error.message);
        }
    }

    // 显示输出信息
    showOutput(message, type = 'info') {
        const outputContent = document.getElementById('output-content');
        if (outputContent) {
            const timestamp = new Date().toLocaleTimeString();
            const colorClass = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
            outputContent.innerHTML += `<div class="output-line ${colorClass}">[${timestamp}] ${message}</div>`;
            outputContent.scrollTop = outputContent.scrollHeight;
        }
    }

    // 显示错误信息
    showError(message) {
        this.showOutput(message, 'error');
    }

    // 切换API模式
    toggleAPIMode() {
        if (!this.fileManager || !this.fileManager.fileSystem) {
            this.showError('文件系统未初始化');
            return;
        }

        const currentMode = this.fileManager.fileSystem.useServerAPI ? '服务器' : '浏览器';
        const newMode = this.fileManager.fileSystem.useServerAPI ? '浏览器' : '服务器';
        
        if (confirm(`当前使用${currentMode}API模式，是否切换到${newMode}API模式？\n\n注意：切换模式后需要重新选择工作目录。`)) {
            try {
                // 切换API模式
                this.fileManager.fileSystem.useServerAPI = !this.fileManager.fileSystem.useServerAPI;
                
                // 清除当前的目录句柄
                this.fileManager.fileSystem.currentDirectoryHandle = null;
                this.fileManager.fileSystem.directoryHandles.clear();
                this.fileManager.fileSystem.fileHandles.clear();
                
                // 更新按钮显示
                this.updateAPIModeButton();
                
                // 清空文件树
                const fileTree = document.getElementById('file-tree');
                if (fileTree) {
                    fileTree.innerHTML = '';
                }
                
                // 提示用户重新选择目录
                this.showOutput(`已切换到${newMode}API模式，请重新选择工作目录`, 'success');
                
                // 自动打开文件夹选择
                setTimeout(() => {
                    if (this.fileManager) {
                        this.fileManager.openFolder();
                    }
                }, 1000);
                
            } catch (error) {
                this.showError(`切换API模式失败: ${error.message}`);
            }
        }
    }

    // 更新API模式按钮显示
    updateAPIModeButton() {
        const apiModeToggle = document.getElementById('api-mode-toggle');
        if (apiModeToggle && this.fileManager && this.fileManager.fileSystem) {
            const isServerMode = this.fileManager.fileSystem.useServerAPI;
            apiModeToggle.textContent = isServerMode ? '🖥️' : '🌐';
            apiModeToggle.title = isServerMode ? '当前使用服务器API模式，点击切换到浏览器API模式' : '当前使用浏览器API模式，点击切换到服务器API模式';
        }
    }

    // 等待EditorManager初始化完成
    async waitForEditorManager() {
        return new Promise((resolve) => {
            const checkEditorManager = () => {
                if (this.editorManager && this.editorManager.editor) {
                    console.log('EditorManager初始化完成');
                    resolve();
                } else {
                    console.log('等待EditorManager初始化...');
                    setTimeout(checkEditorManager, 100);
                }
            };
            checkEditorManager();
        });
    }

    initTheme() {
        const savedTheme = localStorage.getItem('vscode-theme') || 'vs-dark';
        this.setTheme(savedTheme);
    }

    setTheme(theme) {
        this.currentTheme = theme;
        document.documentElement.setAttribute('data-theme', 
            theme === 'vs-dark' ? 'dark' : 
            theme === 'vs' ? 'light' : 'high-contrast'
        );
        localStorage.setItem('vscode-theme', theme);
        
        // 更新 Monaco Editor 主题
        if (window.monaco && this.editorManager) {
            this.editorManager.updateTheme(theme);
        }
        
        // 更新主题切换按钮图标
        const themeBtn = document.getElementById('theme-toggle');
        if (themeBtn) {
            themeBtn.textContent = theme === 'vs-dark' ? '☀️' : '🌙';
        }
        
        // 同步更新设置管理器中的主题设置
        if (this.settingsManager) {
            this.settingsManager.settings.theme = theme;
            // 更新设置面板中的主题选择器
            const themeSelect = document.getElementById('theme-select');
            if (themeSelect) {
                themeSelect.value = theme;
            }
        }
    }

    async loadMonacoEditor() {
        return new Promise((resolve, reject) => {
            if (window.monaco) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'lib/package/min/vs/loader.js';
            script.onload = () => {
                require.config({ 
                    paths: { vs: 'lib/package/min/vs' },
                    // 配置worker路径，避免404错误
                    'vs/nls': { availableLanguages: { '*': 'zh-cn' } }
                });
                
                // 配置Monaco Editor使用本地worker文件，简化配置避免路径问题
                self.MonacoEnvironment = {
                    getWorker: function(moduleId, label) {
                        // 使用内联Worker创建函数，避免外部文件加载问题
                        const workerFunction = function() {
                            // 定义一个简单的全局define函数，避免'undefined is not defined'错误
                            self.define = function(deps, factory) {
                                if (typeof factory === 'function') {
                                    factory(function(module) {
                                        // 模拟简单的module加载
                                        return self;
                                    }, self, self);
                                }
                            };
                            self.define.amd = true;
                            
                            // 基本的worker功能，只处理核心编辑功能
                            self.onmessage = function(e) {
                                // 简单的消息处理，确保worker不会崩溃
                                if (e.data && e.data.type === 'getVersion') {
                                    self.postMessage({ type: 'version', version: '1.0' });
                                }
                            };
                        };
                        
                        // 创建worker代码字符串
                        const workerCode = workerFunction.toString().replace(/^function\s*\(\)\s*\{/, '').replace(/\}\s*$/, '');
                        
                        // 创建并返回Worker实例
                        return new Worker(URL.createObjectURL(new Blob([workerCode], { type: 'application/javascript' })));
                    }
                };
                
                require(['vs/editor/editor.main'], () => {
                    console.log('Monaco Editor 加载完成');
                    resolve();
                }, (error) => {
                    console.error('Monaco Editor 加载失败:', error);
                    reject(error);
                });
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    bindEvents() {
        // 防止重复绑定事件
        if (this.eventsBound) {
            console.log('Events already bound, skipping');
            return;
        }
        
        console.log('Binding events for the first time');
        
        // 主题切换
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => {
                const themes = ['vs-dark', 'vs', 'hc-black'];
                const currentIndex = themes.indexOf(this.currentTheme);
                const nextTheme = themes[(currentIndex + 1) % themes.length];
                this.setTheme(nextTheme);
            });
        }

        // API模式切换
        const apiModeToggle = document.getElementById('api-mode-toggle');
        if (apiModeToggle && this.fileManager) {
            apiModeToggle.addEventListener('click', () => {
                this.toggleAPIMode();
            });
            // 初始化API模式显示
            this.updateAPIModeButton();
        }

        // 设置功能已集成到设置面板中，无需额外的测试按钮

        // 运行按钮
        const runBtn = document.getElementById('run-btn');
        if (runBtn && this.runner) {
            runBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Run button clicked'); // 调试日志
                this.runner.runCurrentFile();
            });
            console.log('Run button event listener added');
        }

        // 侧边栏标签切换
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const panelName = e.target.dataset.panel;
                console.log('切换到面板:', panelName);
                this.switchSidebarPanel(panelName);
            });
        });

        // 底部面板标签切换
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const panelName = e.target.dataset.panel;
                this.switchBottomPanel(panelName);
            });
        });

        // 底部面板拖拽功能
        this.setupBottomPanelDragAndDrop();

        // 打开文件夹按钮
        const openFolderBtn = document.getElementById('open-folder-btn');
        if (openFolderBtn && this.fileManager) {
            openFolderBtn.addEventListener('click', () => {
                this.fileManager.openFolder();
            });
        }

        // 搜索功能
        const searchInput = document.getElementById('search-input');
        if (searchInput && this.fileManager) {
            searchInput.addEventListener('input', (e) => {
                this.fileManager.searchFiles(e.target.value);
            });
        }

        // 设置面板的事件监听器已移至settings-manager.js，避免重复绑定

        // 键盘快捷键
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // 窗口大小调整
        window.addEventListener('resize', () => {
            if (this.editorManager) {
                this.editorManager.layout();
            }
        });
        
        this.eventsBound = true; // 标记事件已绑定
        console.log('All events bound successfully');
        console.log('所有事件监听器绑定完成');
    }

    switchSidebarPanel(panelName) {
        console.log('切换侧边栏面板:', panelName);
        
        // 更新标签状态
        document.querySelectorAll('.sidebar-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"].sidebar-tab`).classList.add('active');

        // 更新面板显示
        document.querySelectorAll('.panel').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${panelName}-panel`).classList.add('active');
        
        // 如果切换到设置面板，确保设置管理器正确初始化
        if (panelName === 'settings' && this.settingsManager) {
            console.log('切换到设置面板，初始化设置管理器...');
            this.settingsManager.init();
        }
    }

    switchBottomPanel(panelName) {
        // 激活底部面板
        const bottomPanel = document.getElementById('bottom-panel');
        if (bottomPanel) {
            bottomPanel.classList.add('active');
        }
        
        // 更新标签状态
        document.querySelectorAll('.panel-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-panel="${panelName}"].panel-tab`).classList.add('active');

        // 更新面板显示
        document.querySelectorAll('.panel-pane').forEach(panel => {
            panel.classList.remove('active');
        });
        document.getElementById(`${panelName}-panel`).classList.add('active');
    }

    setupBottomPanelDragAndDrop() {
        const panelTabs = document.querySelector('.panel-tabs');
        if (!panelTabs) {
            console.log('Panel tabs container not found');
            return;
        }
        
        console.log('Setting up bottom panel drag and drop functionality');
        
        // 为所有面板标签添加拖拽属性
        const tabs = panelTabs.querySelectorAll('.panel-tab');
        tabs.forEach(tab => {
            tab.draggable = true;
            tab.style.cursor = 'grab';
            console.log(`Enabled drag for tab: ${tab.textContent}`);
        });

        let draggedTab = null;
        let draggedPanel = null;

        // 为所有面板标签添加拖拽功能
        const updateTabDragAttributes = () => {
            document.querySelectorAll('.panel-tab').forEach(tab => {
                tab.draggable = true;
                tab.style.cursor = 'grab';
            });
        };

        // 初始设置拖拽属性
        updateTabDragAttributes();

        // 拖拽开始
        panelTabs.addEventListener('dragstart', (e) => {
            console.log('Drag start event fired', e.target);
            if (e.target.classList.contains('panel-tab')) {
                draggedTab = e.target;
                draggedPanel = e.target.dataset.panel;
                e.target.style.opacity = '0.5';
                e.target.style.cursor = 'grabbing';
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', draggedPanel);
                e.target.classList.add('dragging');
                
                // 添加拖拽提示
                this.showOutput(`正在拖拽面板标签: ${draggedPanel}`, 'info');
                console.log(`Started dragging panel tab: ${draggedPanel}`);
            }
        });

        // 拖拽结束
        panelTabs.addEventListener('dragend', (e) => {
            console.log('Drag end event fired', e.target);
            if (e.target.classList.contains('panel-tab')) {
                e.target.style.opacity = '';
                e.target.style.cursor = 'grab';
                e.target.classList.remove('dragging');
                
                // 清除所有拖拽相关的样式
                document.querySelectorAll('.panel-tab').forEach(tab => {
                    tab.classList.remove('drop-before', 'drop-after', 'drop-target');
                });
                
                draggedTab = null;
                draggedPanel = null;
                console.log('Drag operation completed');
            }
        });

        // 拖拽经过
        panelTabs.addEventListener('dragover', (e) => {
            console.log('Drag over event fired', e.target);
            e.preventDefault();
            if (!draggedTab) return;

            const targetTab = e.target.closest('.panel-tab');
            if (targetTab && targetTab !== draggedTab) {
                // 清除之前的样式
                document.querySelectorAll('.panel-tab').forEach(tab => {
                    tab.classList.remove('drop-before', 'drop-after', 'drop-target');
                });

                // 计算拖拽位置
                const rect = targetTab.getBoundingClientRect();
                const midpoint = rect.left + rect.width / 2;
                
                if (e.clientX < midpoint) {
                    targetTab.classList.add('drop-before');
                } else {
                    targetTab.classList.add('drop-after');
                }
                
                targetTab.classList.add('drop-target');
                console.log(`Drop target: ${targetTab.textContent}, position: ${e.clientX < midpoint ? 'before' : 'after'}`);
            }
        });

        // 拖拽离开
        panelTabs.addEventListener('dragleave', (e) => {
            if (!draggedTab) return;
            
            const targetTab = e.target.closest('.panel-tab');
            if (targetTab && targetTab !== draggedTab) {
                targetTab.classList.remove('drop-before', 'drop-after', 'drop-target');
            }
        });

        // 放置
        panelTabs.addEventListener('drop', (e) => {
            console.log('Drop event fired', e.target);
            e.preventDefault();
            if (!draggedTab) return;

            const targetTab = e.target.closest('.panel-tab');
            if (targetTab && targetTab !== draggedTab) {
                targetTab.classList.remove('drop-before', 'drop-after', 'drop-target');
                
                // 重新排序面板标签
                this.reorderPanelTabs(draggedTab, targetTab, e);
                
                // 添加成功动画效果
                draggedTab.style.transform = 'scale(1.05)';
                setTimeout(() => {
                    if (draggedTab) {
                        draggedTab.style.transform = '';
                    }
                }, 200);
                
                console.log(`Dropped ${draggedTab.textContent} onto ${targetTab.textContent}`);
            }
        });

        // 监听DOM变化，为新添加的标签添加拖拽属性
        const observer = new MutationObserver(() => {
            updateTabDragAttributes();
        });

        observer.observe(panelTabs, { childList: true, subtree: true });
    }

    reorderPanelTabs(draggedTab, targetTab, event) {
        const panelTabs = document.querySelector('.panel-tabs');
        const draggedPanel = draggedTab.dataset.panel;
        const targetPanel = targetTab.dataset.panel;

        console.log(`Reordering: ${draggedPanel} -> ${targetPanel}`);

        // 计算放置位置
        const rect = targetTab.getBoundingClientRect();
        const midpoint = rect.left + rect.width / 2;
        const insertBefore = event.clientX < midpoint;

        // 获取所有标签
        const tabs = Array.from(panelTabs.querySelectorAll('.panel-tab'));
        const draggedIndex = tabs.indexOf(draggedTab);
        const targetIndex = tabs.indexOf(targetTab);

        console.log(`Dragged index: ${draggedIndex}, Target index: ${targetIndex}, Insert before: ${insertBefore}`);

        // 如果拖拽到相同位置，不做任何操作
        if (draggedIndex === targetIndex) return;

        // 重新排列标签
        if (insertBefore) {
            panelTabs.insertBefore(draggedTab, targetTab);
        } else {
            const nextSibling = targetTab.nextSibling;
            if (nextSibling) {
                panelTabs.insertBefore(draggedTab, nextSibling);
            } else {
                panelTabs.appendChild(draggedTab);
            }
        }

        // 保存新的标签顺序到本地存储
        this.savePanelTabOrder();
        
        // 显示反馈信息
        this.showOutput(`面板标签已重新排序: ${draggedPanel} ${insertBefore ? '移动到' : '移动后'} ${targetPanel}`, 'success');
        
        console.log('Tab reordering completed successfully');
    }

    savePanelTabOrder() {
        const tabs = Array.from(document.querySelectorAll('.panel-tab'));
        const tabOrder = tabs.map(tab => tab.dataset.panel);
        localStorage.setItem('bottom-panel-tab-order', JSON.stringify(tabOrder));
    }

    restorePanelTabOrder() {
        const savedOrder = localStorage.getItem('bottom-panel-tab-order');
        if (!savedOrder) return;

        try {
            const tabOrder = JSON.parse(savedOrder);
            const panelTabs = document.querySelector('.panel-tabs');
            const tabs = Array.from(panelTabs.querySelectorAll('.panel-tab'));
            
            // 按照保存的顺序重新排列标签
            tabOrder.forEach(panelName => {
                const tab = tabs.find(t => t.dataset.panel === panelName);
                if (tab) {
                    panelTabs.appendChild(tab);
                }
            });
        } catch (error) {
            console.warn('恢复面板标签顺序失败:', error);
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + S 保存
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (this.editorManager) {
                this.editorManager.saveCurrentFile();
            }
        }

        // Ctrl/Cmd + O 打开文件
        if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
            e.preventDefault();
            this.fileManager.openFile();
        }

        // Ctrl/Cmd + R 运行
        if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
            e.preventDefault();
            console.log('Keyboard shortcut Ctrl+R pressed'); // 调试日志
            this.runner.runCurrentFile();
        }

        // Ctrl/Cmd + F 搜索
        if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
            e.preventDefault();
            this.switchSidebarPanel('search');
            document.getElementById('search-input').focus();
        }
    }

    showWelcomeMessage() {
        this.showOutput('欢迎使用 X IDE！', 'info');
        this.showOutput('功能特性：', 'info');
        this.showOutput('• 支持多种编程语言语法高亮', 'info');
        this.showOutput('• 本地文件系统访问', 'info');
        this.showOutput('• 集成终端和代码运行', 'info');
        this.showOutput('• 深色/浅色主题切换', 'info');
        this.showOutput('• 响应式设计', 'info');
        this.showOutput('快捷键：', 'info');
        this.showOutput('• Ctrl+S: 保存文件', 'info');
        this.showOutput('• Ctrl+O: 打开文件', 'info');
        this.showOutput('• Ctrl+R: 运行代码', 'info');
    }

    showError(message) {
        const problemsContent = document.getElementById('problems-content');
        if (problemsContent) {
            problemsContent.innerHTML = `<div class="error-item">❌ ${message}</div>`;
            this.switchBottomPanel('problems');
        } else {
            console.error('错误:', message);
        }
    }

    showOutput(message, type = 'info') {
        const outputContent = document.getElementById('output-content');
        if (outputContent) {
            const timestamp = new Date().toLocaleTimeString();
            const colorClass = type === 'error' ? 'error' : type === 'success' ? 'success' : 'info';
            outputContent.innerHTML += `<div class="output-line ${colorClass}">[${timestamp}] ${message}</div>`;
            outputContent.scrollTop = outputContent.scrollHeight;
            
            this.switchBottomPanel('output');
        } else {
            console.log(`[${type}] ${message}`);
        }
    }

    addTab(filePath, content = '') {
        const tabId = this.generateTabId(filePath);
        
        if (this.openTabs.has(tabId)) {
            this.switchToTab(tabId);
            return;
        }

        const tabData = {
            id: tabId,
            filePath: filePath,
            content: content,
            isDirty: false
        };

        this.openTabs.set(tabId, tabData);
        this.createTabElement(tabData);
        this.switchToTab(tabId);
    }

    createTabElement(tabData) {
        const tabsContainer = document.getElementById('editor-tabs');
        const tabElement = document.createElement('div');
        tabElement.className = 'tab';
        tabElement.dataset.tabId = tabData.id;
        
        const fileName = tabData.filePath.split('/').pop() || 'untitled';
        tabElement.innerHTML = `
            <span class="file-icon">${this.getFileIcon(fileName)}</span>
            <span class="file-name">${fileName}</span>
            <span class="tab-close" onclick="event.stopPropagation(); app.closeTab('${tabData.id}')">×</span>
        `;
        
        tabElement.addEventListener('click', () => {
            this.switchToTab(tabData.id);
        });
        
        tabsContainer.appendChild(tabElement);
    }

    switchToTab(tabId) {
        // 更新标签状态
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab-id="${tabId}"]`).classList.add('active');
        
        this.activeTab = tabId;
        
        // 加载文件内容到编辑器
        const tabData = this.openTabs.get(tabId);
        if (tabData && this.editorManager) {
            this.editorManager.openFile(tabData.filePath, tabData.content);
        }
    }

    closeTab(tabId) {
        const tabData = this.openTabs.get(tabId);
        if (!tabData) return;

        // 如果文件有未保存的更改，提示保存
        if (tabData.isDirty) {
            if (!confirm(`文件 "${tabData.filePath}" 有未保存的更改，确定要关闭吗？`)) {
                return;
            }
        }

        // 移除标签
        this.openTabs.delete(tabId);
        const tabElement = document.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
            tabElement.remove();
        }

        // 如果关闭的是当前活动标签，切换到其他标签
        if (this.activeTab === tabId) {
            const remainingTabs = Array.from(this.openTabs.keys());
            if (remainingTabs.length > 0) {
                this.switchToTab(remainingTabs[0]);
            } else {
                this.activeTab = null;
                if (this.editorManager) {
                    this.editorManager.closeFile();
                }
            }
        }
    }

    generateTabId(filePath) {
        return 'tab_' + btoa(filePath).replace(/[^a-zA-Z0-9]/g, '');
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
            'yaml': '📄',
            'png': '🖼️',
            'jpg': '🖼️',
            'jpeg': '🖼️',
            'gif': '🖼️',
            'svg': '🖼️',
            'bmp': '🖼️',
            'webp': '🖼️',
            'ico': '🖼️',
            'tiff': '🖼️',
            'tif': '🖼️'
        };
        return iconMap[extension] || '📄';
    }
}

// 全局应用实例
let app;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    app = new XIDE();
});

// 导出到全局作用域
window.XIDE = XIDE;