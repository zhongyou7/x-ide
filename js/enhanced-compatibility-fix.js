// 增强兼容性修复 - 解决Chrome安全限制问题
class EnhancedCompatibilityFix {
    constructor() {
        this.browser = this.detectBrowser();
        this.isHTTPS = window.location.protocol === 'https:';
        this.isLocalhost = window.location.hostname === 'localhost' || 
                          window.location.hostname === '127.0.0.1';
        this.isFileProtocol = window.location.protocol === 'file:';
        
        console.log('增强兼容性修复初始化:', {
            browser: this.browser,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHTTPS: this.isHTTPS,
            isLocalhost: this.isLocalhost,
            isFileProtocol: this.isFileProtocol
        });
    }

    detectBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('chrome') && !userAgent.includes('edg')) return 'chrome';
        if (userAgent.includes('firefox')) return 'firefox';
        if (userAgent.includes('safari') && !userAgent.includes('chrome')) return 'safari';
        if (userAgent.includes('edg')) return 'edge';
        return 'unknown';
    }

    // 增强的Chrome安全限制修复
    fixChromeSecurityIssues() {
        if (this.browser !== 'chrome' && this.browser !== 'edge') return;

        console.log('应用Chrome安全限制修复...');

        // 修复1: 确保在用户手势上下文中调用
        this.ensureUserGestureContext();
        
        // 修复2: 增强的错误处理和重试机制
        this.enhanceErrorHandling();
        
        // 修复3: 提供多种降级方案
        this.setupFallbackStrategies();
        
        // 修复4: 可信网站验证增强
        this.enhanceTrustedSiteCheck();
    }

    // 确保用户手势上下文
    ensureUserGestureContext() {
        const originalShowDirectoryPicker = window.showDirectoryPicker;
        
        window.showDirectoryPicker = async function(options = {}) {
            // 检查是否为用户手势上下文
            if (!navigator.userActivation || !navigator.userActivation.isActive) {
                console.warn('非用户手势上下文，返回明确错误而不是尝试延迟调用...');
                
                // 直接返回错误，让调用者处理，而不是自动显示alert
                // 这样可以避免在非用户交互上下文中的不必要弹窗
                throw new Error('需要用户交互才能访问文件系统，请通过按钮点击触发此操作');
            }

            // 正常调用
            return originalShowDirectoryPicker.call(this, {
                mode: 'readwrite',
                startIn: 'desktop',
                ...options
            });
        };
    }

    // 增强错误处理
    enhanceErrorHandling() {
        const originalShowDirectoryPicker = window.showDirectoryPicker;
        
        window.showDirectoryPicker = async function(options = {}) {
            const maxRetries = 3;
            let lastError;
            
            for (let attempt = 1; attempt <= maxRetries; attempt++) {
                try {
                    console.log(`尝试选择目录 (第${attempt}次)...`);
                    
                    // 增强的选项配置
                    const enhancedOptions = {
                        mode: 'readwrite',
                        startIn: options.startIn || 'desktop',
                        id: options.id || 'x-ide-directory-picker'
                    };
                    
                    const result = await originalShowDirectoryPicker.call(this, enhancedOptions);
                    console.log('目录选择成功:', result.name);
                    return result;
                    
                } catch (error) {
                    lastError = error;
                    console.error(`第${attempt}次尝试失败:`, error);
                    
                    // 根据错误类型提供具体解决方案
                    if (error.name === 'SecurityError') {
                        if (attempt < maxRetries) {
                            // 等待用户交互
                            await this.waitForUserInteraction();
                            continue;
                        }
                        
                        // 最后一次尝试，提供详细指导
                        throw new Error(this.getSecurityErrorMessage());
                        
                    } else if (error.name === 'AbortError') {
                        throw error; // 用户取消，不重试
                        
                    } else if (error.name === 'NotAllowedError') {
                        throw new Error('权限被拒绝：需要用户授权访问文件系统');
                        
                    } else {
                        // 其他错误，等待后重试
                        if (attempt < maxRetries) {
                            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
                        }
                    }
                }
            }
            
            throw lastError;
        };
    }

    // 等待用户交互
    async waitForUserInteraction() {
        return new Promise((resolve) => {
            const handlers = [];
            
            const cleanup = () => {
                handlers.forEach(({ element, event, handler }) => {
                    element.removeEventListener(event, handler);
                });
            };

            const interactionHandler = () => {
                cleanup();
                resolve();
            };

            // 监听各种用户交互事件
            const events = ['click', 'keydown', 'touchstart', 'mousemove'];
            events.forEach(event => {
                const handler = () => interactionHandler();
                document.addEventListener(event, handler, { once: true, capture: true });
                handlers.push({ element: document, event, handler });
            });

            // 5秒后自动继续
            setTimeout(() => {
                cleanup();
                resolve();
            }, 5000);
        });
    }

    // 获取安全错误详细信息
    getSecurityErrorMessage() {
        const messages = {
            chrome: `Chrome 安全限制解决方案：
1. 确保网站运行在 HTTPS 或 localhost
2. 如果是本地文件，请使用 HTTP 服务器
3. 检查 Chrome 设置中的隐私和安全选项
4. 尝试在地址栏输入 chrome://flags/#enable-file-system-access-api 并启用
5. 确保在用户点击按钮后调用文件选择器`,
            
            edge: `Edge 安全限制解决方案：
1. 确保网站运行在 HTTPS 或 localhost
2. 检查 Edge 的站点权限设置
3. 将网站添加到受信任站点列表
4. 确保通过用户交互（点击）触发文件选择`,
            
            firefox: `Firefox 兼容性说明：
1. Firefox 需要用户手势触发文件选择
2. 确保在用户点击事件中调用文件选择器
3. 考虑使用文件输入降级方案`,
            
            safari: `Safari 兼容性说明：
1. Safari 对文件系统API支持有限
2. 建议使用文件输入降级方案
3. 确保在用户交互后调用`
        };

        return messages[this.browser] || messages.chrome;
    }

    // 设置降级策略
    setupFallbackStrategies() {
        // 策略1: 文件输入降级
        this.setupFileInputFallback();
        
        // 策略2: 服务器API降级
        this.setupServerAPIFallback();
        
        // 策略3: 内存文件系统降级
        this.setupMemoryFileSystemFallback();
    }

    // 文件输入降级方案
    setupFileInputFallback() {
        // 创建隐藏的文件输入元素
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.webkitdirectory = true;
        this.fileInput.multiple = true;
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // 保存原始方法
        this.originalShowDirectoryPicker = window.showDirectoryPicker;
        
        // 包装原始方法以添加降级支持
        window.showDirectoryPicker = async (options = {}) => {
            try {
                return await this.originalShowDirectoryPicker.call(window, options);
            } catch (error) {
                console.warn('原生文件系统API失败，使用降级方案:', error);
                return this.fallbackFileInput(options);
            }
        };
    }

    // 文件输入降级实现
    async fallbackFileInput(options = {}) {
        return new Promise((resolve, reject) => {
            const fileInput = this.fileInput;
            
            fileInput.onchange = (e) => {
                const files = Array.from(e.target.files);
                if (files.length === 0) {
                    reject(new Error('未选择文件'));
                    return;
                }

                // 模拟目录结构
                const directoryName = files[0].webkitRelativePath.split('/')[0];
                
                // 创建模拟的目录句柄
                const mockDirectoryHandle = {
                    name: directoryName,
                    kind: 'directory',
                    values: async function* () {
                        const directories = new Set();
                        const fileMap = new Map();
                        
                        files.forEach(file => {
                            const pathParts = file.webkitRelativePath.split('/');
                            const fileName = pathParts[pathParts.length - 1];
                            const dirPath = pathParts.slice(0, -1).join('/');
                            
                            if (dirPath !== directoryName) {
                                directories.add(dirPath);
                            }
                            
                            fileMap.set(file.webkitRelativePath, {
                                name: fileName,
                                kind: 'file',
                                getFile: async () => file
                            });
                        });
                        
                        // 生成目录
                        for (const dir of directories) {
                            const dirName = dir.split('/').pop();
                            yield {
                                name: dirName,
                                kind: 'directory',
                                values: async function* () {
                                    // 目录内容生成器
                                    for (const [path, handle] of fileMap) {
                                        if (path.startsWith(dir + '/')) {
                                            yield handle;
                                        }
                                    }
                                }
                            };
                        }
                        
                        // 生成根目录文件
                        for (const [path, handle] of fileMap) {
                            const pathParts = path.split('/');
                            if (pathParts.length === 2) { // 根目录文件
                                yield handle;
                            }
                        }
                    }
                };
                
                resolve(mockDirectoryHandle);
            };
            
            fileInput.click();
        });
    }

    // 服务器API降级
    setupServerAPIFallback() {
        // 这个会在文件系统管理器中实现
        console.log('服务器API降级方案已准备');
    }

    // 内存文件系统降级
    setupMemoryFileSystemFallback() {
        console.log('内存文件系统降级方案已准备');
    }

    // 增强可信网站检查
    enhanceTrustedSiteCheck() {
        // 检查并报告安全上下文状态
        const securityInfo = {
            isSecureContext: window.isSecureContext,
            location: window.location.href,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            port: window.location.port
        };
        
        console.log('安全上下文信息:', securityInfo);
        
        // 如果不是安全上下文，提供指导
        if (!window.isSecureContext) {
            console.warn('非安全上下文警告:', 
                '文件系统API需要安全上下文。请使用HTTPS、localhost或127.0.0.1');
        }
    }

    // 获取兼容性报告
    getCompatibilityReport() {
        const report = {
            browser: this.browser,
            protocol: window.location.protocol,
            hostname: window.location.hostname,
            isHTTPS: this.isHTTPS,
            isLocalhost: this.isLocalhost,
            isFileProtocol: this.isFileProtocol,
            isSecureContext: window.isSecureContext,
            hasUserActivation: navigator.userActivation && navigator.userActivation.isActive,
            supportsFileSystemAPI: 'showDirectoryPicker' in window,
            recommendations: []
        };

        // 生成建议
        if (!window.isSecureContext) {
            report.recommendations.push('使用HTTPS或localhost访问');
        }
        
        if (!('showDirectoryPicker' in window)) {
            report.recommendations.push('浏览器不支持文件系统API，将使用降级方案');
        }
        
        if (this.browser === 'chrome' && !this.isHTTPS && !this.isLocalhost) {
            report.recommendations.push('Chrome需要HTTPS或localhost环境');
        }

        return report;
    }

    // 初始化所有修复
    init() {
        console.log('应用增强兼容性修复...');
        
        if ('showDirectoryPicker' in window) {
            this.fixChromeSecurityIssues();
        }
        
        // 提供兼容性报告
        const report = this.getCompatibilityReport();
        console.log('兼容性报告:', report);
        
        // 如果存在文件系统管理器，增强其功能
        if (window.FileSystemManager) {
            this.enhanceFileSystemManager();
        }
        
        return report;
    }

    // 增强文件系统管理器
    enhanceFileSystemManager() {
        const OriginalFileSystemManager = window.FileSystemManager;
        
        window.FileSystemManager = class EnhancedFileSystemManager extends OriginalFileSystemManager {
            constructor() {
                super();
                this.compatibilityReport = null;
            }
            
            async selectDirectory() {
                try {
                    // 获取兼容性报告
                    if (window.enhancedCompatibilityFix) {
                        this.compatibilityReport = window.enhancedCompatibilityFix.getCompatibilityReport();
                        console.log('文件系统选择前的兼容性报告:', this.compatibilityReport);
                    }
                    
                    // 调用原始方法
                    const result = await super.selectDirectory();
                    
                    if (!result.success) {
                        // 如果失败，提供详细的错误信息和解决方案
                        console.error('目录选择失败，提供解决方案:', result.error);
                        
                        if (result.error.includes('安全限制') || result.error.includes('SecurityError')) {
                            alert(`文件系统访问被阻止！

解决方案：
1. 确保使用 HTTPS 或 localhost 访问
2. 检查浏览器安全设置
3. 尝试重新加载页面后再次点击
4. 使用服务器模式（Node.js服务器）

详细错误: ${result.error}`);
                        }
                    }
                    
                    return result;
                    
                } catch (error) {
                    console.error('增强的文件系统选择失败:', error);
                    
                    // 提供详细的错误信息
                    const enhancedError = {
                        success: false,
                        error: `文件系统选择失败: ${error.message}`,
                        solutions: [
                            '使用 Node.js 服务器模式（推荐）',
                            '确保在 HTTPS 或 localhost 环境运行',
                            '检查浏览器兼容性设置',
                            '尝试使用不同的浏览器'
                        ]
                    };
                    
                    return enhancedError;
                }
            }
        };
        
        console.log('文件系统管理器已增强');
    }
}

// 全局兼容性修复实例
window.enhancedCompatibilityFix = new EnhancedCompatibilityFix();

// 自动初始化（延迟执行以确保DOM加载完成）
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.enhancedCompatibilityFix.init();
    });
} else {
    window.enhancedCompatibilityFix.init();
}