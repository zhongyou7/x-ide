/**
 * 跨浏览器设置面板兼容性增强
 * 将Firefox的设置页面特性应用到所有浏览器
 */

class CrossBrowserSettings {
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
        this.applyBrowserSpecificStyles();
        this.enhanceSettingsPanel();
        this.fixBrowserBugs();
    }

    applyBrowserSpecificStyles() {
        const settingsContainer = document.querySelector('.settings-container');
        if (!settingsContainer) return;

        // 为不同浏览器添加特定的CSS类
        settingsContainer.classList.add(`browser-${this.browser}`);

        // 应用浏览器特定的样式
        switch (this.browser) {
            case 'firefox':
                this.applyFirefoxStyles();
                break;
            case 'chrome':
                this.applyChromeStyles();
                break;
            case 'safari':
                this.applySafariStyles();
                break;
            case 'edge':
                this.applyEdgeStyles();
                break;
            default:
                this.applyGenericStyles();
        }
    }

    applyFirefoxStyles() {
        // Firefox 已经优化，只需要微调
        const style = document.createElement('style');
        style.textContent = `
            .browser-firefox .setting-item {
                background: rgba(30, 30, 30, 0.98) !important;
                border: 2px solid rgba(255, 255, 255, 0.15) !important;
            }
            .browser-firefox .setting-item label {
                font-weight: 700 !important;
                text-shadow: 0 1px 5px rgba(0, 0, 0, 0.6) !important;
                letter-spacing: 0.5px !important;
            }
        `;
        document.head.appendChild(style);
    }

    applyChromeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .browser-chrome .setting-item {
                background: rgba(30, 30, 30, 0.95) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3) !important;
            }
            .browser-chrome .setting-item:hover {
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4) !important;
                transform: translateY(-1px) !important;
            }
            .browser-chrome .setting-item label {
                -webkit-font-smoothing: antialiased !important;
                text-rendering: optimizeLegibility !important;
            }
        `;
        document.head.appendChild(style);
    }

    applySafariStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .browser-safari .setting-item {
                background: rgba(30, 30, 30, 0.95) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
                -webkit-backdrop-filter: blur(15px) !important;
                backdrop-filter: blur(15px) !important;
            }
            .browser-safari .setting-item label {
                -webkit-font-smoothing: antialiased !important;
                font-weight: 600 !important;
            }
        `;
        document.head.appendChild(style);
    }

    applyEdgeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .browser-edge .setting-item {
                background: rgba(30, 30, 30, 0.95) !important;
                border: 1px solid rgba(255, 255, 255, 0.15) !important;
            }
            .browser-edge .setting-item label {
                font-weight: 600 !important;
            }
        `;
        document.head.appendChild(style);
    }

    applyGenericStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .browser-unknown .setting-item {
                background: rgba(30, 30, 30, 0.95) !important;
                border: 1px solid rgba(255, 255, 255, 0.1) !important;
            }
        `;
        document.head.appendChild(style);
    }

    enhanceSettingsPanel() {
        const settingsContainer = document.querySelector('.settings-container');
        if (!settingsContainer) return;

        // 添加动画效果
        const settingItems = settingsContainer.querySelectorAll('.setting-item');
        settingItems.forEach((item, index) => {
            item.style.animationDelay = `${index * 0.1}s`;
            item.classList.add('animated-item');
        });

        // 为设置项添加更好的焦点管理
        settingItems.forEach(item => {
            const input = item.querySelector('input, select, textarea');
            if (input) {
                input.addEventListener('focus', () => {
                    item.classList.add('focused');
                });
                input.addEventListener('blur', () => {
                    item.classList.remove('focused');
                });

                // 修复Firefox中的输入事件处理
                if (input.type === 'checkbox' || input.type === 'radio') {
                    input.addEventListener('change', (e) => {
                        // 确保change事件正确触发
                        e.stopPropagation();
                        
                        // 设置管理器已经处理了保存逻辑，这里不需要重复保存
                        // 只负责修复浏览器兼容性问题
                    });
                }
            }
        });

        // 修复Firefox中的选择框样式
        const selects = settingsContainer.querySelectorAll('select');
        selects.forEach(select => {
            select.style.backgroundColor = 'var(--vscode-editor-background, #1e1e1e)';
            select.style.color = 'var(--vscode-editor-foreground, #cccccc)';
            select.style.border = '1px solid var(--vscode-panel-border, #3c3c3c)';
            
            // 设置管理器已经处理了选择框的change事件，这里不需要重复保存
            // 只负责修复浏览器样式兼容性问题
        });

        // 添加键盘导航支持
        this.addKeyboardNavigation(settingsContainer);
        
        // 修复Firefox中的数字输入框
        const numberInputs = settingsContainer.querySelectorAll('input[type="number"]');
        numberInputs.forEach(input => {
            input.addEventListener('wheel', (e) => {
                e.preventDefault(); // 防止在Firefox中滚动页面
            });
        });
    }

    setupFocusManagement() {
        const settingItems = document.querySelectorAll('.setting-item');
        settingItems.forEach(item => {
            item.setAttribute('tabindex', '0');
            
            item.addEventListener('focus', () => {
                item.classList.add('focused');
            });
            
            item.addEventListener('blur', () => {
                item.classList.remove('focused');
            });
        });
    }

    setupKeyboardNavigation() {
        const settingItems = document.querySelectorAll('.setting-item');
        
        settingItems.forEach(item => {
            item.addEventListener('keydown', (e) => {
                switch (e.key) {
                    case 'Enter':
                    case ' ':
                        // 激活设置项
                        const input = item.querySelector('input, select');
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = !input.checked;
                                input.dispatchEvent(new Event('change'));
                            } else {
                                input.focus();
                            }
                        }
                        e.preventDefault();
                        break;
                    case 'ArrowDown':
                        this.focusNextItem(item);
                        e.preventDefault();
                        break;
                    case 'ArrowUp':
                        this.focusPreviousItem(item);
                        e.preventDefault();
                        break;
                }
            });
        });
    }

    // 添加键盘导航支持（别名方法）
    addKeyboardNavigation(container) {
        this.setupKeyboardNavigation(container);
    }

    focusNextItem(currentItem) {
        const items = Array.from(document.querySelectorAll('.setting-item'));
        const currentIndex = items.indexOf(currentItem);
        const nextIndex = (currentIndex + 1) % items.length;
        items[nextIndex].focus();
    }

    focusPreviousItem(currentItem) {
        const items = Array.from(document.querySelectorAll('.setting-item'));
        const currentIndex = items.indexOf(currentItem);
        const previousIndex = currentIndex === 0 ? items.length - 1 : currentIndex - 1;
        items[previousIndex].focus();
    }

    fixBrowserBugs() {
        // 修复各浏览器的已知问题
        switch (this.browser) {
            case 'chrome':
                this.fixChromeBugs();
                break;
            case 'firefox':
                this.fixFirefoxBugs();
                break;
            case 'safari':
                this.fixSafariBugs();
                break;
            case 'edge':
                this.fixEdgeBugs();
                break;
        }
    }

    fixChromeBugs() {
        // Chrome 特定的bug修复
        const style = document.createElement('style');
        style.textContent = `
            /* 修复Chrome中复选框的显示问题 */
            .browser-chrome input[type="checkbox"]:checked::after {
                line-height: 1.2 !important;
            }
        `;
        document.head.appendChild(style);
    }

    fixFirefoxBugs() {
        // Firefox 特定的bug修复
        const style = document.createElement('style');
        style.textContent = `
            /* 修复Firefox中数字输入框的样式 */
            .browser-firefox input[type="number"] {
                -moz-appearance: textfield;
            }
            .browser-firefox input[type="number"]::-webkit-outer-spin-button,
            .browser-firefox input[type="number"]::-webkit-inner-spin-button {
                -webkit-appearance: none;
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }

    fixSafariBugs() {
        // Safari 特定的bug修复
        const style = document.createElement('style');
        style.textContent = `
            /* 修复Safari中backdrop-filter的兼容性问题 */
            .browser-safari .setting-item {
                -webkit-backdrop-filter: blur(15px);
                backdrop-filter: blur(15px);
            }
        `;
        document.head.appendChild(style);
    }

    fixEdgeBugs() {
        // Edge 特定的bug修复
        const style = document.createElement('style');
        style.textContent = `
            /* 修复Edge中过渡效果的性能问题 */
            .browser-edge .setting-item {
                will-change: transform, background-color;
            }
        `;
        document.head.appendChild(style);
    }
}

// 初始化跨浏览器设置
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new CrossBrowserSettings();
    });
} else {
    new CrossBrowserSettings();
}

// 导出到全局作用域
window.CrossBrowserSettings = CrossBrowserSettings;