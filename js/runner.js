// 代码运行器
class CodeRunner {
    constructor(app) {
        this.app = app;
        this.runningProcesses = new Set();
        this.outputBuffer = [];
        this.isRunning = false; // 防止重复运行
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        // 运行按钮事件已在 app.js 中绑定，这里不再重复绑定
        // 避免事件重复触发
    }

    async runCurrentFile() {
        console.log('runCurrentFile called'); // 调试日志
        
        // 防止重复运行
        if (this.isRunning) {
            console.log('Already running, ignoring duplicate call');
            return;
        }
        
        const currentFile = this.app.editorManager.currentFile;
        const content = this.app.editorManager.getCurrentContent();
        const language = this.app.editorManager.getCurrentLanguage();

        if (!currentFile) {
            this.app.showOutput('没有打开的文件', 'warning');
            return;
        }

        if (!content.trim()) {
            this.app.showOutput('文件内容为空', 'warning');
            return;
        }

        console.log('File language:', language); // 调试日志

        this.app.showOutput(`正在运行: ${currentFile}`, 'info');
        this.app.switchBottomPanel('output');

        this.isRunning = true; // 设置运行状态

        try {
            switch (language) {
                case 'javascript':
                    await this.runJavaScript(content, currentFile);
                    break;
                case 'html':
                    this.runHTML(content, currentFile);
                    break;
                case 'css':
                    this.runCSS(content, currentFile);
                    break;
                case 'python':
                    this.runPython(content, currentFile);
                    break;
                case 'json':
                    this.runJSON(content, currentFile);
                    break;
                case 'markdown':
                    this.runMarkdown(content, currentFile);
                    break;
                default:
                    this.app.showOutput(`不支持运行 ${language} 文件`, 'warning');
                    this.app.showOutput('支持的语言: JavaScript, HTML, CSS, Python, JSON, Markdown', 'info');
            }
        } catch (error) {
            this.app.showError(`运行失败: ${error.message}`);
        } finally {
            this.isRunning = false; // 重置运行状态
        }
    }

    async runJavaScript(code, fileName) {
        try {
            this.app.showOutput('--- JavaScript 输出 ---');
            
            // 创建安全的运行环境
            const originalConsole = window.console;
            const output = [];
            let hasError = false;
            
            // 重写 console 方法
            window.console = {
                log: (...args) => {
                    const message = args.map(arg => 
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' ');
                    output.push(message);
                    this.app.showOutput(message);
                },
                error: (...args) => {
                    const message = `Error: ${args.join(' ')}`;
                    output.push(message);
                    this.app.showOutput(message, 'error');
                    hasError = true;
                },
                warn: (...args) => {
                    const message = `Warning: ${args.join(' ')}`;
                    output.push(message);
                    this.app.showOutput(message, 'warning');
                },
                info: (...args) => {
                    const message = args.join(' ');
                    output.push(message);
                    this.app.showOutput(message, 'info');
                }
            };
            
            // 添加一些有用的全局变量
            const context = {
                require: null, // 禁用 require 以保安全
                process: {
                    env: {},
                    version: '1.0.0',
                    platform: 'browser'
                },
                __filename: fileName,
                __dirname: '/',
                setTimeout: window.setTimeout,
                setInterval: window.setInterval,
                clearTimeout: window.clearTimeout,
                clearInterval: window.clearInterval,
                console: window.console
            };
            
            // 创建函数并执行
            const wrappedCode = `
                (function() {
                    ${code}
                })();
            `;
            
            const result = eval(wrappedCode);
            
            // 恢复原始 console
            if (typeof originalConsole !== 'undefined') {
                window.console = originalConsole;
            }
            
            if (!hasError) {
                this.app.showOutput('--- 执行完成 ✓ ---');
            } else {
                this.app.showOutput('--- 执行完成但有错误 ⚠ ---');
            }
            
            // 保存输出到终端历史
            if (this.app.terminal) {
                this.app.terminal.printOutput(output.join('\n'));
            }
            
        } catch (error) {
            // 确保originalConsole存在再恢复
            if (typeof originalConsole !== 'undefined') {
                window.console = originalConsole;
            }
            this.app.showOutput(`JavaScript 错误: ${error.message}`, 'error');
            this.app.showOutput(`错误位置: ${error.stack}`, 'error');
            throw error;
        }
    }

    runHTML(content, fileName) {
        try {
            this.app.showOutput('正在打开 HTML 文件...');
            
            // 创建新的窗口或标签页
            const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
            
            if (!newWindow) {
                this.app.showError('无法打开新窗口，请检查浏览器设置');
                return;
            }
            
            // 写入 HTML 内容
            newWindow.document.write(content);
            newWindow.document.close();
            
            // 添加一些基本的 HTML 结构如果缺少
            if (!content.includes('<html')) {
                newWindow.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>${fileName}</title>
                        <meta charset="UTF-8">
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    </head>
                    <body>
                        ${content}
                    </body>
                    </html>
                `);
            }
            
            this.app.showOutput(`HTML 文件 "${fileName}" 已在新窗口中打开`);
            
            // 在终端中显示
            if (this.app.terminal) {
                this.app.terminal.printSuccess(`HTML 文件已打开: ${fileName}`);
            }
            
        } catch (error) {
            this.app.showError(`打开 HTML 文件失败: ${error.message}`);
            throw error;
        }
    }

    runCSS(content, fileName) {
        try {
            this.app.showOutput('正在预览 CSS 样式...');
            
            // 创建 HTML 预览页面
            const previewHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>CSS 预览 - ${fileName}</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        ${content}
                    </style>
                </head>
                <body>
                    <div class="css-preview-container">
                        <h1>CSS 预览</h1>
                        <p>文件: ${fileName}</p>
                        <hr>
                        <div class="preview-content">
                            <h2>标题示例</h2>
                            <p>这是一个段落文本，用于测试 CSS 样式。</p>
                            <button>按钮示例</button>
                            <ul>
                                <li>列表项 1</li>
                                <li>列表项 2</li>
                                <li>列表项 3</li>
                            </ul>
                        </div>
                    </div>
                </body>
                </html>
            `;
            
            // 在新窗口中打开预览
            const newWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
            if (!newWindow) {
                this.app.showError('无法打开新窗口，请检查浏览器设置');
                return;
            }
            
            newWindow.document.write(previewHTML);
            newWindow.document.close();
            
            this.app.showOutput(`CSS 文件 "${fileName}" 预览已打开`);
            
        } catch (error) {
            this.app.showError(`CSS 预览失败: ${error.message}`);
            throw error;
        }
    }

    runPython(content, fileName) {
        console.log('runPython called once'); // 调试日志
        this.app.showOutput('Python 运行需要本地 Python 环境');
        this.app.showOutput('请在本地终端中运行以下命令:');
        this.app.showOutput(`python "${fileName}"`);
        this.app.showOutput('');
        this.app.showOutput('或者使用在线 Python 解释器:');
        this.app.showOutput('https://www.python.org/shell/');
        
        // 在终端中显示运行建议
        if (this.app.terminal) {
            this.app.terminal.printLine('Python 代码运行建议:');
            this.app.terminal.printLine('1. 在本地终端中运行: python ' + fileName);
            this.app.terminal.printLine('2. 使用在线 Python 解释器');
            this.app.terminal.printLine('3. 安装 Brython 等 Python-in-JS 库');
        }
    }

    runJSON(content, fileName) {
        try {
            this.app.showOutput('正在验证 JSON 格式...');
            
            const parsed = JSON.parse(content);
            this.app.showOutput('✓ JSON 格式正确', 'success');
            
            // 格式化输出
            const formatted = JSON.stringify(parsed, null, 2);
            this.app.showOutput('--- JSON 内容 ---');
            this.app.showOutput(formatted);
            
            // 显示统计信息
            const stats = {
                keys: Object.keys(parsed).length,
                type: Array.isArray(parsed) ? 'Array' : typeof parsed
            };
            
            if (Array.isArray(parsed)) {
                stats.length = parsed.length;
            }
            
            this.app.showOutput('--- 统计信息 ---');
            this.app.showOutput(`类型: ${stats.type}`);
            this.app.showOutput(`键数量: ${stats.keys}`);
            if (stats.length) {
                this.app.showOutput(`数组长度: ${stats.length}`);
            }
            
        } catch (error) {
            this.app.showOutput(`JSON 格式错误: ${error.message}`, 'error');
            throw error;
        }
    }

    runMarkdown(content, fileName) {
        try {
            this.app.showOutput('正在渲染 Markdown...');
            
            // 使用新的 MarkdownRenderer 类进行渲染
            if (typeof MarkdownRenderer !== 'undefined') {
                const renderer = new MarkdownRenderer();
                const html = renderer.render(content);
                
                // 创建预览页面
                const previewHTML = renderer.createPreviewHTML(html, fileName);
                
                // 在新窗口中打开预览
                const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
                if (!newWindow) {
                    this.app.showError('无法打开新窗口，请检查浏览器设置');
                    return;
                }
                
                newWindow.document.write(previewHTML);
                newWindow.document.close();
                
                this.app.showOutput(`Markdown 文件 "${fileName}" 预览已打开`);
            } else {
                // 如果 MarkdownRenderer 不可用，使用基础实现
                this.runMarkdownBasic(content, fileName);
            }
            
        } catch (error) {
            this.app.showError(`Markdown 渲染失败: ${error.message}`);
            throw error;
        }
    }
    
    // 基础 Markdown 渲染（备用方案）
    runMarkdownBasic(content, fileName) {
        try {
            this.app.showOutput('使用基础 Markdown 渲染器...');
            
            // 简单的 Markdown 转 HTML（基础实现）
            let html = content
                .replace(/^### (.*$)/gim, '<h3>$1</h3>')
                .replace(/^## (.*$)/gim, '<h2>$1</h2>')
                .replace(/^# (.*$)/gim, '<h1>$1</h1>')
                .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
                .replace(/\*(.*)\*/gim, '<em>$1</em>')
                .replace(/\`(.*)\`/gim, '<code>$1</code>')
                .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
                .replace(/^\* (.*$)/gim, '<li>$1</li>')
                .replace(/\n/gim, '<br>');
            
            // 添加列表包装
            html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
            
            // 创建预览页面
            const previewHTML = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>Markdown 预览 - ${fileName}</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body { 
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            line-height: 1.6;
                            max-width: 800px;
                            margin: 0 auto;
                            padding: 20px;
                            background: #f5f5f5;
                        }
                        .container {
                            background: white;
                            padding: 30px;
                            border-radius: 8px;
                            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                        }
                        h1, h2, h3 { color: #333; }
                        code { 
                            background: #f4f4f4; 
                            padding: 2px 4px; 
                            border-radius: 3px;
                            font-family: 'Consolas', 'Monaco', monospace;
                        }
                        pre { 
                            background: #f4f4f4; 
                            padding: 15px; 
                            border-radius: 5px;
                            overflow-x: auto;
                        }
                        ul { padding-left: 20px; }
                        li { margin: 5px 0; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Markdown 预览</h1>
                        <p><small>文件: ${fileName}</small></p>
                        <hr>
                        ${html}
                    </div>
                </body>
                </html>
            `;
            
            // 在新窗口中打开预览
            const newWindow = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes');
            if (!newWindow) {
                this.app.showError('无法打开新窗口，请检查浏览器设置');
                return;
            }
            
            newWindow.document.write(previewHTML);
            newWindow.document.close();
            
            this.app.showOutput(`Markdown 文件 "${fileName}" 预览已打开`);
            
        } catch (error) {
            this.app.showError(`Markdown 基础渲染失败: ${error.message}`);
            throw error;
        }
    }

    // 运行自定义代码
    runCustomCode(code, language = 'javascript') {
        try {
            this.app.showOutput(`运行自定义 ${language} 代码...`);
            
            switch (language) {
                case 'javascript':
                    return this.runJavaScript(code, 'custom.js');
                case 'html':
                    return this.runHTML(code, 'custom.html');
                case 'css':
                    return this.runCSS(code, 'custom.css');
                default:
                    throw new Error(`不支持的语言: ${language}`);
            }
        } catch (error) {
            this.app.showError(`自定义代码运行失败: ${error.message}`);
            throw error;
        }
    }

    // 停止运行
    stopRunning() {
        // 由于浏览器环境限制，这里只能清空输出
        this.app.showOutput('停止运行（浏览器环境限制）');
        
        // 清空输出缓冲区
        this.outputBuffer = [];
    }

    // 获取运行状态
    isRunning() {
        return this.runningProcesses.size > 0;
    }
}

// 将CodeRunner类导出到全局作用域
window.CodeRunner = CodeRunner;