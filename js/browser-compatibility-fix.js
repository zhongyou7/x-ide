/**
 * 浏览器兼容性修复
 * 解决Firefox和Chrome上的文件系统访问问题
 */

class BrowserCompatibilityFix {
    constructor() {
        this.browser = this.detectBrowser();
        this.init();
    }

    detectBrowser() {
        const userAgent = navigator.userAgent.toLowerCase();
        if (userAgent.includes('firefox')) return 'firefox';
        if (userAgent.includes('chrome')) return 'chrome';
        if (userAgent.includes('safari')) return 'safari';
        if (userAgent.includes('edge')) return 'edge';
        return 'unknown';
    }

    init() {
        this.fixFileSystemAPI();
        this.addBrowserWarnings();
        this.setupFallbackHandlers();
    }

    fixFileSystemAPI() {
        // 检查文件系统API支持
        const hasFileSystemAPI = 'showDirectoryPicker' in window;
        const isHTTPS = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';

        if (!hasFileSystemAPI) {
            this.showBrowserWarning('文件系统API不支持', 
                '您的浏览器不支持文件系统API。请使用最新版本的Chrome、Edge或Opera浏览器。');
            return;
        }

        if (!isHTTPS && !isLocalhost) {
            this.showBrowserWarning('HTTPS要求', 
                '文件系统API需要在HTTPS环境或localhost下运行。');
            return;
        }

        // 修复特定浏览器的问题
        switch (this.browser) {
            case 'firefox':
                this.fixFirefoxIssues();
                break;
            case 'chrome':
                this.fixChromeIssues();
                break;
        }
    }

    fixFirefoxIssues() {
        // Firefox 需要用户手势触发文件选择
        console.log('Firefox 兼容性修复已应用');
        
        // 确保在用户交互上下文中调用文件系统API
        const originalShowDirectoryPicker = window.showDirectoryPicker;
        window.showDirectoryPicker = async function(options = {}) {
            try {
                // Firefox 可能需要额外的权限请求
                if (navigator.permissions) {
                    try {
                        const result = await navigator.permissions.query({
                            name: 'file-system',
                            mode: 'readwrite'
                        });
                        console.log('文件系统权限状态:', result.state);
                    } catch (e) {
                        console.log('权限查询不支持:', e);
                    }
                }
                
                return await originalShowDirectoryPicker.call(this, options);
            } catch (error) {
                if (error.name === 'SecurityError') {
                    throw new Error('Firefox 安全限制：请确保在用户点击事件中调用文件选择器。');
                }
                throw error;
            }
        };
    }

    fixChromeIssues() {
        // Chrome 可能需要特定的选项设置
        console.log('Chrome 兼容性修复已应用');
        
        const originalShowDirectoryPicker = window.showDirectoryPicker;
        window.showDirectoryPicker = async function(options = {}) {
            try {
                // Chrome 可能需要明确的 startIn 选项
                const enhancedOptions = {
                    ...options,
                    mode: 'readwrite',
                    startIn: options.startIn || 'desktop'
                };
                
                return await originalShowDirectoryPicker.call(this, enhancedOptions);
            } catch (error) {
                if (error.name === 'SecurityError') {
                    throw new Error('Chrome 安全限制：请确保网站可信且用户交互正常。');
                }
                throw error;
            }
        };
    }

    addBrowserWarnings() {
        // 添加浏览器兼容性警告到页面
        const warningContainer = document.createElement('div');
        warningContainer.id = 'browser-compatibility-warnings';
        warningContainer.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            z-index: 10000;
            max-width: 400px;
        `;
        document.body.appendChild(warningContainer);
    }

    showBrowserWarning(title, message) {
        const warningContainer = document.getElementById('browser-compatibility-warnings');
        if (!warningContainer) return;

        const warning = document.createElement('div');
        warning.className = 'browser-warning';
        warning.style.cssText = `
            background: #ff6b6b;
            color: white;
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 6px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            font-size: 14px;
            line-height: 1.4;
        `;
        
        warning.innerHTML = `
            <strong>${title}</strong><br>
            ${message}
            <button onclick="this.parentElement.remove()" style="
                float: right;
                background: transparent;
                border: 1px solid white;
                color: white;
                padding: 2px 6px;
                border-radius: 3px;
                cursor: pointer;
                font-size: 12px;
            ">×</button>
        `;
        
        warningContainer.appendChild(warning);
        
        // 5秒后自动移除
        setTimeout(() => {
            if (warning.parentElement) {
                warning.remove();
            }
        }, 5000);
    }

    setupFallbackHandlers() {
        // 为不支持文件系统API的浏览器设置降级方案
        if (!('showDirectoryPicker' in window)) {
            this.setupFileInputFallback();
        }
    }

    setupFileInputFallback() {
        // 创建隐藏的文件输入元素作为降级方案
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.webkitdirectory = true;
        fileInput.multiple = true;
        fileInput.style.display = 'none';
        document.body.appendChild(fileInput);

        // 重写文件系统管理器的方法
        if (window.FileSystemManager) {
            const OriginalFileSystemManager = window.FileSystemManager;
            
            window.FileSystemManager = class CompatibleFileSystemManager extends OriginalFileSystemManager {
                async selectDirectory() {
                    try {
                        // 使用文件输入降级方案
                        return await this.fallbackSelectDirectory();
                    } catch (error) {
                        return { 
                            success: false, 
                            error: '文件系统访问失败: ' + error.message 
                        };
                    }
                }

                async fallbackSelectDirectory() {
                    return new Promise((resolve) => {
                        fileInput.onchange = (e) => {
                            const files = Array.from(e.target.files);
                            if (files.length === 0) {
                                resolve({ success: false, error: '未选择目录' });
                                return;
                            }

                            // 模拟目录结构
                            const directoryName = files[0].webkitRelativePath.split('/')[0];
                            this.simulateDirectoryStructure(files);
                            
                            resolve({ 
                                success: true, 
                                path: '/', 
                                message: '使用降级方案加载目录' 
                            });
                        };
                        
                        fileInput.click();
                    });
                }

                simulateDirectoryStructure(files) {
                    // 模拟目录结构处理
                    console.log('使用文件输入降级方案处理文件:', files.length);
                    // 这里可以实现文件结构模拟逻辑
                }
            };
        }
    }

    // 检查并报告浏览器兼容性
    checkCompatibility() {
        const issues = [];
        
        // 检查文件系统API
        if (!('showDirectoryPicker' in window)) {
            issues.push('文件系统API不支持');
        }
        
        // 检查HTTPS/localhost
        const isHTTPS = window.location.protocol === 'https:';
        const isLocalhost = window.location.hostname === 'localhost' || 
                           window.location.hostname === '127.0.0.1';
        
        if (!isHTTPS && !isLocalhost) {
            issues.push('需要在HTTPS或localhost环境运行');
        }
        
        // 检查用户手势要求
        if (this.browser === 'firefox' || this.browser === 'safari') {
            issues.push(`${this.browser} 需要用户手势触发文件选择`);
        }
        
        return {
            browser: this.browser,
            supported: issues.length === 0,
            issues: issues
        };
    }
}

// 初始化浏览器兼容性修复
window.addEventListener('DOMContentLoaded', () => {
    window.browserCompatibilityFix = new BrowserCompatibilityFix();
    
    // 报告兼容性状态
    const compatibility = window.browserCompatibilityFix.checkCompatibility();
    console.log('浏览器兼容性状态:', compatibility);
    
    if (!compatibility.supported) {
        console.warn('检测到兼容性问题:', compatibility.issues);
    }
});

// 导出兼容性修复类
window.BrowserCompatibilityFix = BrowserCompatibilityFix;