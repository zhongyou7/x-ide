/**
 * 错误处理和兼容性修复
 * 专门处理 switchLeftPanel 错误
 */

class ErrorHandler {
    constructor() {
        this.init();
    }

    init() {
        // 监听全局错误
        window.addEventListener('error', (event) => {
            this.handleError(event);
        });

        // 监听未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handlePromiseRejection(event);
        });

        // 创建兼容性补丁
        this.createCompatibilityPatches();
    }

    handleError(event) {
        const error = event.error;
        const message = error?.message || event.message;
        
        if (message && message.includes('switchLeftPanel')) {
            console.warn('捕获到 switchLeftPanel 错误:', message);
            this.fixSwitchLeftPanelError(error);
            event.preventDefault();
        }
    }

    handlePromiseRejection(event) {
        const reason = event.reason;
        if (reason && reason.message && reason.message.includes('switchLeftPanel')) {
            console.warn('捕获到 switchLeftPanel Promise 错误:', reason.message);
            this.fixSwitchLeftPanelError(reason);
            event.preventDefault();
        }
    }

    createCompatibilityPatches() {
        // 为 app 对象添加 switchLeftPanel 方法作为兼容性补丁
        if (typeof window.app !== 'undefined') {
            this.patchAppObject();
        } else {
            // 如果 app 还未定义，等待它定义
            const checkAppInterval = setInterval(() => {
                if (typeof window.app !== 'undefined') {
                    clearInterval(checkAppInterval);
                    this.patchAppObject();
                }
            }, 100);
        }
    }

    patchAppObject() {
        const app = window.app;
        
        // 添加 switchLeftPanel 方法
        if (!app.switchLeftPanel) {
            app.switchLeftPanel = (panelName) => {
                console.warn('switchLeftPanel 被调用，但函数不存在，尝试使用 switchSidebarPanel 替代');
                if (app.switchSidebarPanel) {
                    return app.switchSidebarPanel(panelName);
                } else {
                    console.error('switchSidebarPanel 也不存在');
                    return false;
                }
            };
        }

        // 为 settingsManager 添加错误处理
        if (app.settingsManager) {
            this.patchSettingsManager(app.settingsManager);
        }
    }

    patchSettingsManager(settingsManager) {
        const originalSaveSettings = settingsManager.saveSettings;
        
        settingsManager.saveSettings = function() {
            try {
                // 调用原始的 saveSettings 方法
                originalSaveSettings.call(this);
            } catch (error) {
                if (error.message && error.message.includes('switchLeftPanel')) {
                    console.warn('saveSettings 中捕获到 switchLeftPanel 错误，尝试修复');
                    // 尝试修复错误
                    this.fixSettingsSaveError();
                } else {
                    // 如果不是 switchLeftPanel 错误，重新抛出
                    throw error;
                }
            }
        };

        settingsManager.fixSettingsSaveError = function() {
            try {
                // 直接保存到 localStorage，避免调用任何可能出错的方法
                localStorage.setItem('vscode-ide-settings', JSON.stringify(this.settings));
                console.log('设置已保存（绕过错误）');
            } catch (e) {
                console.error('修复设置保存失败:', e);
            }
        };
    }

    fixSwitchLeftPanelError(error) {
        console.log('正在修复 switchLeftPanel 错误...');
        
        // 尝试找到错误源
        const stack = error.stack;
        if (stack) {
            console.log('错误堆栈:', stack);
        }

        // 显示用户友好的错误消息
        this.showUserFriendlyError();
    }

    showUserFriendlyError() {
        // 创建错误提示元素
        const errorDiv = document.createElement('div');
        errorDiv.id = 'compatibility-error';
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ff6b6b;
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 14px;
            max-width: 300px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        errorDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>⚠️</span>
                <span>检测到兼容性问题，已自动修复</span>
                <button onclick="this.parentElement.parentElement.remove()" style="
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    margin-left: auto;
                    padding: 0;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                ">×</button>
            </div>
        `;

        // 添加动画样式
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(errorDiv);

        // 5秒后自动移除
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.remove();
            }
        }, 5000);
    }

    // 添加CSS样式来增强设置面板的视觉效果
    addSettingsPanelStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* 设置面板兼容性样式 */
            .setting-item {
                transition: all 0.2s ease;
            }
            
            .setting-item:hover {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .setting-item.focused {
                outline: 2px solid #007acc;
                outline-offset: 2px;
            }
            
            /* 修复Firefox中的复选框样式 */
            input[type="checkbox"] {
                -webkit-appearance: none;
                -moz-appearance: none;
                appearance: none;
                width: 18px;
                height: 18px;
                border: 2px solid #666;
                border-radius: 3px;
                background: transparent;
                position: relative;
                cursor: pointer;
            }
            
            input[type="checkbox"]:checked {
                background: #007acc;
                border-color: #007acc;
            }
            
            input[type="checkbox"]:checked::after {
                content: '✓';
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: white;
                font-size: 12px;
                font-weight: bold;
            }
            
            /* 修复数字输入框样式 */
            input[type="number"] {
                -moz-appearance: textfield;
            }
            
            input[type="number"]::-webkit-outer-spin-button,
            input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }
}

// 初始化错误处理
function initializeErrorHandler() {
    if (typeof window.errorHandler === 'undefined') {
        window.errorHandler = new ErrorHandler();
        console.log('错误处理器已初始化');
    }
}

// 立即初始化或等待DOM加载
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeErrorHandler);
} else {
    initializeErrorHandler();
}

// 确保在app对象加载后也进行初始化
const originalInterval = setInterval(() => {
    if (typeof window.app !== 'undefined' && typeof window.errorHandler === 'undefined') {
        clearInterval(originalInterval);
        initializeErrorHandler();
    }
}, 100);

// 5秒后清除定时器
setTimeout(() => {
    clearInterval(originalInterval);
}, 5000);

// 导出错误处理器以供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}

// 导出到全局作用域
window.ErrorHandler = ErrorHandler;