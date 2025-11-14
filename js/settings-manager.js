// 设置管理器
class SettingsManager {
    constructor(app) {
        console.log('SettingsManager 构造函数被调用');
        this.app = app;
        this.settings = {
            theme: 'vs-dark',
            fontSize: 14,
            fontFamily: 'Consolas, Monaco, monospace',
            tabSize: 4,
            wordWrap: 'on',
            minimap: true,
            lineNumbers: 'on',
            autoSave: true,
            autoSaveDelay: 1000,
            formatOnSave: false,
            trimTrailingWhitespace: true,
            insertFinalNewline: true,
            detectIndentation: true,
            renderWhitespace: 'selection',
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'blink',
            cursorStyle: 'line',
            multiCursorModifier: 'ctrlCmd',
            accessibilitySupport: 'auto',
            bracketPairColorization: true,
            guides: {
                indentation: true,
                highlightActive: true
            },
            suggest: {
                enabled: true,
                showIcons: true,
                showSnippets: true,
                showWords: true
            },
            files: {
                autoSave: 'afterDelay',
                autoSaveDelay: 1000,
                encoding: 'utf8',
                eol: '\n',
                trimTrailingWhitespace: true,
                insertFinalNewline: true
            },
            search: {
                caseSensitive: false,
                useRegex: false,
                wholeWord: false,
                includeIgnored: false
            }
        };
        
        console.log('默认设置:', this.settings);
        this.eventsBound = false; // 初始化事件绑定标志
        this.initialized = false;
        this.autoSaveInterval = null;
        this.lastSaveTime = 0;
        this.notificationCooldown = 0;
        this.isProgrammaticUpdate = false;
        
        // 加载保存的设置
        this.loadSettings();
    }

    init() {
        console.log('初始化设置管理器...');
        
        // 防止重复初始化
        if (this.initialized) {
            console.log('设置管理器已经初始化，跳过重复初始化');
            return;
        }
        
        // 检查必要的DOM元素是否存在
        const settingsPanel = document.getElementById('settings-panel');
        if (!settingsPanel) {
            console.warn('设置面板未找到，将在100ms后重试初始化');
            setTimeout(() => this.init(), 100);
            return;
        }
        
        console.log('设置面板已找到，开始初始化UI...');
        this.setupSettingsUI();
        this.bindEvents();
        this.applySettings();
        
        this.initialized = true;
        console.log('设置管理器初始化完成');
        
        // 验证主题选择器是否正确设置
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            console.log('主题选择器当前值:', themeSelect.value);
            console.log('设置中的主题值:', this.settings.theme);
        }
        
        // 延迟应用编辑器设置，确保编辑器管理器已初始化
        setTimeout(() => {
            console.log('延迟应用编辑器设置...');
            this.applyEditorSettings();
        }, 2000);
    }

    setupSettingsUI() {
        console.log('开始设置UI...');
        
        // 检查必要的DOM元素是否存在
        const settingsPanel = document.getElementById('settings-panel');
        if (!settingsPanel) {
            console.warn('设置面板未找到');
            return;
        }
        
        console.log('设置面板已找到');
        // 使用HTML中已有的静态设置面板，只需绑定事件
        this.bindStaticSettingsUI();
    }

    bindStaticSettingsUI() {
        // 设置初始值
        this.setInitialValues();
        
        // 绑定事件监听器
        this.bindEventListeners();
        console.log('设置管理器初始化完成');
    }

    setInitialValues() {
        // 标记为程序性更新，避免触发事件
        this.isProgrammaticUpdate = true;
        
        console.log('正在设置初始值...', this.settings);
        
        // 设置字体大小
        const fontSizeInput = document.getElementById('font-size');
        if (fontSizeInput) {
            fontSizeInput.value = this.settings.fontSize.toString();
        }
        
        // 设置字体族
        const fontFamilySelect = document.getElementById('font-family');
        if (fontFamilySelect) {
            fontFamilySelect.value = this.settings.fontFamily;
        }
        
        // 设置Tab大小
        const tabSizeInput = document.getElementById('tab-size');
        if (tabSizeInput) {
            tabSizeInput.value = this.settings.tabSize;
        }
        
        // 设置自动换行
        const wordWrapCheckbox = document.getElementById('word-wrap');
        if (wordWrapCheckbox) {
            wordWrapCheckbox.checked = this.settings.wordWrap === 'on';
        }
        
        // 设置小地图
        const minimapCheckbox = document.getElementById('minimap');
        if (minimapCheckbox) {
            minimapCheckbox.checked = this.settings.minimap;
        }
        
        // 设置行号
        const lineNumbersCheckbox = document.getElementById('line-numbers');
        if (lineNumbersCheckbox) {
            lineNumbersCheckbox.checked = this.settings.lineNumbers === 'on';
        }
        
        // 设置自动保存
        const autoSaveCheckbox = document.getElementById('auto-save');
        if (autoSaveCheckbox) {
            autoSaveCheckbox.checked = this.settings.autoSave;
        }
        
        // 设置保存时格式化
        const formatOnSaveCheckbox = document.getElementById('format-on-save');
        if (formatOnSaveCheckbox) {
            formatOnSaveCheckbox.checked = this.settings.formatOnSave;
        }
        
        // 设置删除行尾空格
        const trimWhitespaceCheckbox = document.getElementById('trim-trailing-whitespace');
        if (trimWhitespaceCheckbox) {
            trimWhitespaceCheckbox.checked = this.settings.trimTrailingWhitespace;
        }
        
        // 设置自动检测缩进
        const detectIndentationCheckbox = document.getElementById('detect-indentation');
        if (detectIndentationCheckbox) {
            detectIndentationCheckbox.checked = this.settings.detectIndentation;
        }
        
        // 设置主题
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            themeSelect.value = this.settings.theme;
            console.log('主题选择器已设置为:', this.settings.theme);
        } else {
            console.warn('主题选择器元素未找到');
        }
        
        // 重置程序性更新标志
        setTimeout(() => {
            this.isProgrammaticUpdate = false;
        }, 100);
    }

    bindEventListeners() {
        // 防止重复绑定事件
        if (this.eventsBound) {
            console.log('设置管理器事件监听器已绑定，跳过重复绑定');
            return;
        }

        console.log('正在绑定设置管理器事件监听器...');
        
        // 初始化防抖机制
        this.saveSettingsDebounced = this.debounce(() => {
            this.saveSettings();
        }, 300);

        // 绑定字体大小变化事件（下拉框）
        const fontSizeInput = document.getElementById('font-size');
        if (fontSizeInput) {
            fontSizeInput.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.fontSize = parseInt(e.target.value);
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定字体族变化事件
        const fontFamilySelect = document.getElementById('font-family');
        if (fontFamilySelect) {
            fontFamilySelect.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.fontFamily = e.target.value;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定Tab大小变化事件
        const tabSizeInput = document.getElementById('tab-size');
        if (tabSizeInput) {
            tabSizeInput.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.tabSize = parseInt(e.target.value);
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定自动换行变化事件
        const wordWrapCheckbox = document.getElementById('word-wrap');
        if (wordWrapCheckbox) {
            wordWrapCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.wordWrap = e.target.checked ? 'on' : 'off';
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定小地图变化事件
        const minimapCheckbox = document.getElementById('minimap');
        if (minimapCheckbox) {
            minimapCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.minimap = e.target.checked;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定行号变化事件
        const lineNumbersCheckbox = document.getElementById('line-numbers');
        if (lineNumbersCheckbox) {
            lineNumbersCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.lineNumbers = e.target.checked ? 'on' : 'off';
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定自动保存变化事件
        const autoSaveCheckbox = document.getElementById('auto-save');
        if (autoSaveCheckbox) {
            autoSaveCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.autoSave = e.target.checked;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定保存时格式化变化事件
        const formatOnSaveCheckbox = document.getElementById('format-on-save');
        if (formatOnSaveCheckbox) {
            formatOnSaveCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.formatOnSave = e.target.checked;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定删除行尾空格变化事件
        const trimWhitespaceCheckbox = document.getElementById('trim-trailing-whitespace');
        if (trimWhitespaceCheckbox) {
            trimWhitespaceCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.trimTrailingWhitespace = e.target.checked;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定自动检测缩进变化事件
        const detectIndentationCheckbox = document.getElementById('detect-indentation');
        if (detectIndentationCheckbox) {
            detectIndentationCheckbox.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                this.settings.detectIndentation = e.target.checked;
                this.applySettings();
                this.saveSettingsDebounced();
            });
        }

        // 绑定主题变化事件
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            console.log('找到主题选择器元素，绑定change事件');
            themeSelect.addEventListener('change', (e) => {
                if (this.isProgrammaticUpdate) {
                    console.log('程序性更新，跳过保存');
                    return;
                }
                console.log('主题选择器值变更:', e.target.value);
                this.settings.theme = e.target.value;
                // 使用应用的主题系统来避免重复设置
                if (this.app && this.app.setTheme) {
                    console.log('使用应用的setTheme方法设置主题');
                    this.app.setTheme(e.target.value);
                } else {
                    console.log('应用的setTheme方法不可用，使用applySettings');
                    this.applySettings();
                }
                this.saveSettingsDebounced();
            });
        } else {
            console.warn('未找到主题选择器元素');
        }
        
        this.eventsBound = true;
        console.log('设置管理器事件监听器绑定完成');
    }

    bindEvents() {
        // 绑定设置面板切换事件
        const settingsTabs = document.querySelectorAll('.settings-tab');
        settingsTabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                const target = tab.getAttribute('data-target');
                this.showSettingsSection(target);
            });
        });
    }

    showSettingsSection(sectionId) {
        // 隐藏所有设置部分
        const sections = document.querySelectorAll('.settings-section');
        sections.forEach(section => {
            section.style.display = 'none';
        });

        // 显示目标设置部分
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
        }

        // 更新活动标签
        const tabs = document.querySelectorAll('.settings-tab');
        tabs.forEach(tab => {
            tab.classList.remove('active');
        });
        const activeTab = document.querySelector(`[data-target="${sectionId}"]`);
        if (activeTab) {
            activeTab.classList.add('active');
        }
    }

    applySettings() {
        console.log('应用设置到编辑器:', this.settings);
        
        // 应用主题设置 - 使用应用的主题系统
        if (this.app && this.app.setTheme) {
            console.log('使用应用的setTheme方法设置主题:', this.settings.theme);
            this.app.setTheme(this.settings.theme);
        } else {
            // 备用主题应用
            console.log('使用备用主题应用方法');
            document.documentElement.setAttribute('data-theme', 
                this.settings.theme === 'vs-dark' ? 'dark' : 
                this.settings.theme === 'vs' ? 'light' : 'high-contrast'
            );
        }

        // 应用编辑器设置 - 使用编辑器管理器的方法
        this.applyEditorSettings();

        // 应用自动保存设置
        if (this.settings.autoSave) {
            this.setupAutoSave();
        } else {
            this.disableAutoSave();
        }
    }
    
    // 当编辑器管理器初始化完成后调用此方法
    onEditorManagerReady() {
        console.log('编辑器管理器已就绪，应用编辑器设置...');
        this.applyEditorSettings();
    }
    
    applyEditorSettings() {
        console.log('应用编辑器设置...');
        
        // 获取编辑器管理器 - 尝试多种方式
        let editorManager = null;
        let editor = null;
        
        // 方式1: 通过应用实例
        if (this.app) {
            editorManager = this.app.editorManager;
            if (editorManager) {
                editor = editorManager.editor;
            }
        }
        
        // 方式2: 通过全局window对象
        if (!editor && window.app && window.app.editorManager) {
            editorManager = window.app.editorManager;
            editor = editorManager.editor;
        }
        
        console.log('编辑器管理器状态:', {
            hasEditorManager: !!editorManager,
            hasEditor: !!editor,
            appExists: !!this.app,
            windowAppExists: !!(window.app),
            editorManager: editorManager,
            editor: editor
        });
        
        if (editorManager && editor) {
            console.log('使用编辑器管理器更新编辑器设置');
            
            // 使用编辑器管理器的专用方法更新字体大小
            if (this.settings.fontSize) {
                console.log('更新字体大小为:', this.settings.fontSize);
                editorManager.updateFontSize(this.settings.fontSize);
            }
            
            // 使用编辑器管理器的专用方法更新主题
            if (this.settings.theme) {
                console.log('更新主题为:', this.settings.theme);
                editorManager.updateTheme(this.settings.theme);
            }
            
            // 更新其他编辑器选项
            const editorOptions = {
                fontFamily: this.settings.fontFamily,
                tabSize: this.settings.tabSize,
                insertSpaces: this.settings.insertSpaces,
                wordWrap: this.settings.wordWrap,
                minimap: { enabled: this.settings.minimap },
                lineNumbers: this.settings.lineNumbers,
                renderLineHighlight: this.settings.renderLineHighlight,
                scrollBeyondLastLine: this.settings.scrollBeyondLastLine,
                automaticLayout: true
            };
            
            console.log('更新编辑器选项:', editorOptions);
            editor.updateOptions(editorOptions);
            
            console.log('编辑器设置已应用:', {
                fontSize: this.settings.fontSize,
                fontFamily: this.settings.fontFamily,
                tabSize: this.settings.tabSize,
                wordWrap: this.settings.wordWrap,
                minimap: this.settings.minimap,
                lineNumbers: this.settings.lineNumbers
            });
        } else {
            console.warn('编辑器管理器或编辑器实例不可用');
            console.log('应用实例:', this.app);
            console.log('编辑器管理器:', editorManager);
            console.log('编辑器:', editor);
            
            // 如果编辑器尚未初始化，延迟重试
            if ((this.app || window.app) && !editorManager) {
                console.log('编辑器管理器尚未初始化，延迟重试...');
                setTimeout(() => this.applyEditorSettings(), 1000);
            }
        }
    }

    setupAutoSave() {
        // 设置自动保存逻辑
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        
        this.autoSaveInterval = setInterval(() => {
            if (this.app.editor && this.app.currentFile) {
                this.app.saveFile();
            }
        }, this.settings.autoSaveDelay);
    }

    disableAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
    }

    loadSettings() {
        try {
            console.log('开始加载设置...');
            const savedSettings = localStorage.getItem('vscode-ide-settings');
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings);
                console.log('从localStorage加载的设置:', parsedSettings);
                this.settings = { ...this.settings, ...parsedSettings };
                console.log('合并后的设置:', this.settings);
            } else {
                console.log('没有找到保存的设置，使用默认设置:', this.settings);
            }
        } catch (error) {
            console.error('加载设置失败:', error);
        }
    }

    // 工具方法：防抖函数
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    saveSettings() {
        try {
            console.log('开始保存设置...', this.settings);
            
            // 检查是否在短时间内已经保存过
            const now = Date.now();
            if (this.lastSaveTime && (now - this.lastSaveTime) < 1000) {
                console.log('距离上次保存时间太短，跳过保存');
                return;
            }
            this.lastSaveTime = now;
            
            localStorage.setItem('vscode-ide-settings', JSON.stringify(this.settings));
            console.log('设置已保存到 localStorage:', this.settings);
            
            // 验证保存是否成功
            const saved = localStorage.getItem('vscode-ide-settings');
            console.log('验证保存的设置:', JSON.parse(saved));
            
            // 检查通知冷却时间
            if (!this.notificationCooldown || (now - this.notificationCooldown) > 2000) {
                this.showNotification('设置已保存');
                this.notificationCooldown = now;
            }
        } catch (error) {
            console.error('保存设置时出错:', error);
            this.showNotification('保存设置失败，请重试', 'error');
        }
    }

    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: -60px;
            left: 50%;
            transform: translateX(-50%);
            padding: 12px 20px;
            background: ${type === 'error' ? '#f44336' : type === 'success' ? '#4CAF50' : '#2196F3'};
            color: white;
            border-radius: 0 0 6px 6px;
            z-index: 10000;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            transition: top 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
            text-align: center;
            min-width: 160px;
        `;
        
        document.body.appendChild(notification);
        
        // 滑入动画
        requestAnimationFrame(() => {
            notification.style.top = '0px';
        });
        
        // 2秒后滑出
        setTimeout(() => {
            notification.style.top = '-60px';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 250);
        }, 2000);
    }
}

// 导出设置管理器类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}

// 将SettingsManager类导出到全局作用域
window.SettingsManager = SettingsManager;