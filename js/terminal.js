// 终端模拟器
class Terminal {
    constructor(app) {
        this.app = app;
        this.commandHistory = [];
        this.historyIndex = -1;
        this.currentCommand = '';
        this.terminalOutput = document.getElementById('terminal-output');
        
        this.init();
    }

    init() {
        this.createTerminalInput();
        this.bindEvents();
        this.printWelcomeMessage();
    }

    createTerminalInput() {
        const terminalContent = document.getElementById('terminal-content');
        
        // 创建命令输入区域
        const commandLine = document.createElement('div');
        commandLine.className = 'command-line';
        commandLine.innerHTML = `
            <span class="prompt">$ </span>
            <input type="text" class="command-input" placeholder="输入命令..." />
        `;
        
        terminalContent.appendChild(commandLine);
        
        this.commandInput = commandLine.querySelector('.command-input');
    }

    bindEvents() {
        this.commandInput.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Enter':
                    e.preventDefault();
                    this.executeCommand(this.commandInput.value);
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateHistory(-1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateHistory(1);
                    break;
                case 'Tab':
                    e.preventDefault();
                    this.autoComplete();
                    break;
                case 'c':
                    if (e.ctrlKey) {
                        e.preventDefault();
                        this.interruptCommand();
                    }
                    break;
            }
        });

        this.commandInput.addEventListener('input', (e) => {
            this.currentCommand = e.target.value;
        });

        // 点击终端区域聚焦输入框
        this.terminalOutput.addEventListener('click', () => {
            this.commandInput.focus();
        });
    }

    printWelcomeMessage() {
        this.printLine('X IDE 终端 v1.0.0');
        this.printLine('输入 "help" 查看可用命令');
        this.printLine('');
    }

    printLine(text, type = 'normal') {
        const line = document.createElement('div');
        line.className = `terminal-line ${type}`;
        line.textContent = text;
        this.terminalOutput.appendChild(line);
        this.scrollToBottom();
    }

    printOutput(text) {
        const lines = text.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                this.printLine(line, 'output');
            }
        });
    }

    printError(text) {
        this.printLine(`Error: ${text}`, 'error');
    }

    printSuccess(text) {
        this.printLine(`✓ ${text}`, 'success');
    }

    scrollToBottom() {
        const terminalPanel = document.getElementById('terminal-panel');
        terminalPanel.scrollTop = terminalPanel.scrollHeight;
    }

    async executeCommand(command) {
        if (!command.trim()) return;

        // 显示执行的命令
        this.printLine(`$ ${command}`, 'command');
        
        // 添加到历史记录
        this.addToHistory(command);
        
        // 清空输入框
        this.commandInput.value = '';
        this.currentCommand = '';

        // 解析并执行命令
        const args = this.parseCommand(command);
        const cmd = args[0];

        try {
            switch (cmd) {
                case 'help':
                    this.showHelp();
                    break;
                case 'clear':
                    this.clear();
                    break;
                case 'ls':
                    await this.listFiles(args[1]);
                    break;
                case 'cd':
                    await this.changeDirectory(args[1]);
                    break;
                case 'pwd':
                    this.printWorkingDirectory();
                    break;
                case 'cat':
                    await this.showFile(args[1]);
                    break;
                case 'echo':
                    this.echo(args.slice(1).join(' '));
                    break;
                case 'run':
                    await this.runCode(args[1]);
                    break;
                case 'theme':
                    this.changeTheme(args[1]);
                    break;
                case 'version':
                    this.showVersion();
                    break;
                case 'date':
                    this.showDate();
                    break;
                case 'whoami':
                    this.whoami();
                    break;
                default:
                    // 尝试运行代码
                    if (cmd.endsWith('.js') || cmd.endsWith('.py') || cmd.endsWith('.html')) {
                        await this.runFile(cmd);
                    } else {
                        this.printError(`未知命令: ${cmd}`);
                        this.printLine('输入 "help" 查看可用命令');
                    }
            }
        } catch (error) {
            // 确保originalConsole存在再恢复
            if (typeof originalConsole !== 'undefined') {
                window.console = originalConsole;
            }
            this.printError(error.message);
        }
    }

    parseCommand(command) {
        // 简单的命令解析，支持引号
        const args = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < command.length; i++) {
            const char = command[i];
            
            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            } else if (!inQuotes && char === ' ') {
                if (current) {
                    args.push(current);
                    current = '';
                }
            } else {
                current += char;
            }
        }
        
        if (current) {
            args.push(current);
        }
        
        return args;
    }

    showHelp() {
        this.printLine('可用命令:');
        this.printLine('  help       - 显示帮助信息');
        this.printLine('  clear      - 清屏');
        this.printLine('  ls [dir]   - 列出文件');
        this.printLine('  cd <dir>   - 切换目录');
        this.printLine('  pwd        - 显示当前目录');
        this.printLine('  cat <file> - 显示文件内容');
        this.printLine('  echo <text> - 输出文本');
        this.printLine('  run <file> - 运行代码文件');
        this.printLine('  theme <dark|light> - 切换主题');
        this.printLine('  version    - 显示版本信息');
        this.printLine('  date       - 显示当前日期时间');
        this.printLine('  whoami     - 显示当前用户');
        this.printLine('');
        this.printLine('也可以直接运行 .js, .py, .html 文件');
    }

    clear() {
        this.terminalOutput.innerHTML = '';
        this.printWelcomeMessage();
    }

    async listFiles(path) {
        if (!this.app.fileManager.currentDirectory) {
            this.printError('没有打开任何文件夹');
            return;
        }

        try {
            // 使用fileManager的readDirectory方法而不是直接访问values()
            const targetPath = path || this.app.fileManager.currentDirectory;
            const result = await this.app.fileManager.readDirectory(targetPath);
            
            if (!result.success) {
                this.printError(`列出文件失败: ${result.error}`);
                return;
            }

            const files = result.items || [];
            
            files.sort((a, b) => {
                if (a.type !== b.type) {
                    return a.type === 'directory' ? -1 : 1;
                }
                return a.name.localeCompare(b.name);
            });

            files.forEach(file => {
                const icon = file.type === 'directory' ? '📁' : '📄';
                this.printLine(`${icon} ${file.name}`);
            });

        } catch (error) {
            this.printError(`列出文件失败: ${error.message}`);
        }
    }

    async changeDirectory(path) {
        if (!path) {
            this.printError('请指定目录路径');
            return;
        }

        this.printLine(`切换到目录: ${path}`);
    }

    printWorkingDirectory() {
        if (this.app.fileManager.currentDirectory) {
            this.printLine(this.app.fileManager.currentDirectory.name);
        } else {
            this.printLine('/');
        }
    }

    async showFile(fileName) {
        if (!fileName) {
            this.printError('请指定文件名');
            return;
        }

        try {
            // 查找文件
            for (const [path, info] of this.app.fileManager.fileTree) {
                if (info.name === fileName && info.kind === 'file') {
                    const file = await info.handle.getFile();
                    const content = await file.text();
                    this.printOutput(content);
                    return;
                }
            }
            
            this.printError(`文件不存在: ${fileName}`);
        } catch (error) {
            this.printError(`读取文件失败: ${error.message}`);
        }
    }

    echo(text) {
        this.printLine(text || '');
    }

    async runCode(fileName) {
        if (!fileName) {
            this.printError('请指定要运行的文件名');
            return;
        }

        await this.runFile(fileName);
    }

    async runFile(fileName) {
        try {
            // 查找文件
            for (const [path, info] of this.app.fileManager.fileTree) {
                if (info.name === fileName && info.kind === 'file') {
                    const file = await info.handle.getFile();
                    const content = await file.text();
                    
                    this.printLine(`正在运行: ${fileName}`);
                    this.printLine('---');
                    
                    // 根据文件类型运行
                    if (fileName.endsWith('.js')) {
                        await this.runJavaScript(content);
                    } else if (fileName.endsWith('.html')) {
                        this.runHTML(content);
                    } else if (fileName.endsWith('.py')) {
                        this.printLine('Python 运行需要本地 Python 环境');
                        this.printLine('请在本地终端中运行: python ' + fileName);
                    } else {
                        this.printError('不支持的文件类型');
                    }
                    
                    this.printLine('---');
                    return;
                }
            }
            
            this.printError(`文件不存在: ${fileName}`);
        } catch (error) {
            this.printError(`运行文件失败: ${error.message}`);
        }
    }

    async runJavaScript(code) {
        try {
            // 创建安全的运行环境
            const originalConsole = window.console;
            const output = [];
            
            // 重写 console 方法
            window.console = {
                log: (...args) => {
                    output.push(args.map(arg => 
                        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
                    ).join(' '));
                },
                error: (...args) => {
                    output.push(`Error: ${args.join(' ')}`);
                },
                warn: (...args) => {
                    output.push(`Warning: ${args.join(' ')}`);
                }
            };
            
            // 执行代码
            const result = eval(code);
            
            // 恢复原始 console
            if (typeof originalConsole !== 'undefined') {
                window.console = originalConsole;
            }
            
            // 显示输出
            if (output.length > 0) {
                this.printOutput(output.join('\n'));
            } else if (result !== undefined) {
                this.printOutput(String(result));
            } else {
                this.printSuccess('代码执行完成');
            }
            
        } catch (error) {
            this.printError(error.message);
        }
    }

    runHTML(content) {
        // 在新窗口中打开 HTML
        const newWindow = window.open('', '_blank', 'width=800,height=600');
        newWindow.document.write(content);
        newWindow.document.close();
        
        this.printSuccess('HTML 文件已在新窗口中打开');
    }

    changeTheme(theme) {
        if (!theme) {
            this.printLine('当前主题: ' + this.app.currentTheme);
            this.printLine('可用主题: dark, light, high-contrast');
            return;
        }

        const themeMap = {
            'dark': 'vs-dark',
            'light': 'vs',
            'high-contrast': 'hc-black'
        };

        const monacoTheme = themeMap[theme];
        if (monacoTheme) {
            this.app.setTheme(monacoTheme);
            this.printSuccess(`主题已切换到: ${theme}`);
        } else {
            this.printError('无效的主题');
            this.printLine('可用主题: dark, light, high-contrast');
        }
    }

    showVersion() {
        this.printLine('X IDE v1.6.5');
        // this.printLine('基于 Monaco Editor 和 Web 技术');
    }

    showDate() {
        const now = new Date();
        this.printLine(now.toLocaleString());
    }

    whoami() {
        this.printLine('当前用户: WebIDE-User');
        this.printLine('浏览器: ' + navigator.userAgent);
    }

    addToHistory(command) {
        this.commandHistory.push(command);
        this.historyIndex = this.commandHistory.length;
        
        // 限制历史记录数量
        if (this.commandHistory.length > 100) {
            this.commandHistory.shift();
        }
    }

    navigateHistory(direction) {
        const newIndex = this.historyIndex + direction;
        
        if (newIndex >= 0 && newIndex < this.commandHistory.length) {
            this.historyIndex = newIndex;
            this.commandInput.value = this.commandHistory[this.historyIndex];
            this.currentCommand = this.commandInput.value;
        } else if (newIndex === this.commandHistory.length) {
            this.historyIndex = this.commandHistory.length;
            this.commandInput.value = '';
            this.currentCommand = '';
        }
    }

    autoComplete() {
        // 简单的自动补全实现
        const input = this.commandInput.value;
        if (!input) return;

        const commands = ['help', 'clear', 'ls', 'cd', 'pwd', 'cat', 'echo', 'run', 'theme', 'version', 'date', 'whoami'];
        const matches = commands.filter(cmd => cmd.startsWith(input));

        if (matches.length === 1) {
            this.commandInput.value = matches[0] + ' ';
            this.currentCommand = this.commandInput.value;
        } else if (matches.length > 1) {
            this.printLine(matches.join('  '));
        }
    }

    interruptCommand() {
        this.printLine('^C');
        this.commandInput.value = '';
        this.currentCommand = '';
    }

    // 在输出面板显示消息
    log(message) {
        this.printOutput(message);
    }

    error(message) {
        this.printError(message);
    }
}

// 将Terminal类导出到全局作用域
window.Terminal = Terminal;