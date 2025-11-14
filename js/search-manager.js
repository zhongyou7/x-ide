// 搜索管理器
class SearchManager {
    constructor(app) {
        this.app = app;
        this.searchResults = [];
        this.searchHistory = [];
        this.currentSearch = null;
        this.replaceHistory = [];
        
        this.init();
    }

    init() {
        this.setupSearchUI();
        this.bindEvents();
    }

    setupSearchUI() {
        const searchPanel = document.getElementById('search-panel');
        
        if (!searchPanel) {
            console.error('搜索面板容器未找到');
            return;
        }
        
        searchPanel.innerHTML = `
            <div class="search-container">
                <div class="search-header">
                    <div class="search-input-group">
                        <input type="text" id="search-input" placeholder="搜索文件内容..." />
                        <div class="search-controls">
                            <button id="search-case" class="search-toggle" title="区分大小写">Aa</button>
                            <button id="search-regex" class="search-toggle" title="使用正则表达式">.*</button>
                            <button id="search-whole-word" class="search-toggle" title="全词匹配">\b\b</button>
                        </div>
                    </div>
                    <div class="search-actions">
                        <button id="search-prev" title="上一个匹配项">↑</button>
                        <button id="search-next" title="下一个匹配项">↓</button>
                        <button id="search-clear" title="清除搜索">×</button>
                    </div>
                </div>
                
                <div class="replace-group" id="replace-group">
                    <input type="text" id="replace-input" placeholder="替换为..." />
                    <div class="replace-actions">
                        <button id="replace-one" title="替换一个">替换</button>
                        <button id="replace-all" title="替换所有">全部替换</button>
                    </div>
                </div>
                
                <div class="search-stats" id="search-stats"></div>
                
                <div class="search-results" id="search-results">
                    <div class="search-results-header">
                        <span>搜索结果</span>
                        <button id="collapse-all-results" title="折叠所有结果">−</button>
                    </div>
                    <div class="search-results-content" id="search-results-content"></div>
                </div>
            </div>
        `;
    }

    bindEvents() {
        const searchInput = document.getElementById('search-input');
        const replaceInput = document.getElementById('replace-input');
        const searchCase = document.getElementById('search-case');
        const searchRegex = document.getElementById('search-regex');
        const searchWholeWord = document.getElementById('search-whole-word');

        // 检查必要元素是否存在
        if (!searchInput) {
            console.error('搜索输入框未找到');
            return;
        }

        // 搜索输入事件
        searchInput.addEventListener('input', (e) => {
            this.performSearch(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    this.navigateResult('prev');
                } else {
                    this.navigateResult('next');
                }
            } else if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        // 替换输入事件
        replaceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.replaceAll();
            }
        });

        // 搜索选项切换
        [searchCase, searchRegex, searchWholeWord].forEach(button => {
            button.addEventListener('click', () => {
                button.classList.toggle('active');
                if (searchInput.value) {
                    this.performSearch(searchInput.value);
                }
            });
        });

        // 导航按钮
        document.getElementById('search-prev').addEventListener('click', () => this.navigateResult('prev'));
        document.getElementById('search-next').addEventListener('click', () => this.navigateResult('next'));
        document.getElementById('search-clear').addEventListener('click', () => this.clearSearch());

        // 替换按钮
        document.getElementById('replace-one').addEventListener('click', () => this.replaceOne());
        document.getElementById('replace-all').addEventListener('click', () => this.replaceAll());

        // 显示/隐藏替换区域
        searchInput.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'h') {
                e.preventDefault();
                this.toggleReplace();
            }
        });

        // 快捷键绑定
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.focusSearch();
            }
        });
    }

    async performSearch(query) {
        if (!query.trim()) {
            this.clearSearch();
            return;
        }

        // 添加到搜索历史
        if (!this.searchHistory.includes(query)) {
            this.searchHistory.unshift(query);
            if (this.searchHistory.length > 10) {
                this.searchHistory.pop();
            }
        }

        this.currentSearch = {
            query: query,
            caseSensitive: document.getElementById('search-case').classList.contains('active'),
            useRegex: document.getElementById('search-regex').classList.contains('active'),
            wholeWord: document.getElementById('search-whole-word').classList.contains('active')
        };

        try {
            const results = await this.searchInFiles(query, this.currentSearch);
            this.displaySearchResults(results);
            this.updateSearchStats(results);
        } catch (error) {
            this.app.showError(`搜索失败: ${error.message}`);
        }
    }

    async searchInFiles(query, options) {
        const results = [];
        const fileManager = this.app.fileManager;
        
        if (!fileManager) {
            return results;
        }

        // 创建搜索模式
        let searchPattern;
        try {
            if (options.useRegex) {
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchPattern = new RegExp(query, flags);
            } else {
                const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                let pattern = escapedQuery;
                if (options.wholeWord) {
                    pattern = `\\b${escapedQuery}\\b`;
                }
                const flags = options.caseSensitive ? 'g' : 'gi';
                searchPattern = new RegExp(pattern, flags);
            }
        } catch (error) {
            this.app.showError(`无效的正则表达式: ${error.message}`);
            return results;
        }

        // 首先搜索所有打开的文件
        if (fileManager.openedFiles) {
            for (const [filePath, content] of fileManager.openedFiles) {
                if (typeof content !== 'string') continue;
                
                const fileResults = this.searchInContent(content, searchPattern, filePath);
                if (fileResults.length > 0) {
                    results.push({
                        file: filePath,
                        matches: fileResults,
                        matchCount: fileResults.length
                    });
                }
            }
        }

        // 然后尝试在整个项目中搜索
        try {
            // 检查是否有当前工作目录
            if (fileManager.currentDirectory && fileManager.currentDirectory !== '/') {
                const projectResults = await this.searchInProject(searchPattern);
                
                // 合并结果，避免重复
                const existingFiles = new Set(results.map(r => r.file));
                for (const result of projectResults) {
                    if (!existingFiles.has(result.file)) {
                        results.push(result);
                        existingFiles.add(result.file);
                    }
                }
            }
        } catch (error) {
            console.warn('项目搜索失败，仅显示已打开文件的结果:', error.message);
        }

        return results;
    }
    
    // 递归搜索整个项目文件
    async searchInProject(searchPattern) {
        const results = [];
        const fileManager = this.app.fileManager;
        
        if (!fileManager || !fileManager.readDirectory) {
            return results;
        }
        
        // 递归遍历目录
        async function traverseDirectory(directoryPath) {
            try {
                // 使用readDirectory方法获取目录内容
                const entries = await fileManager.readDirectory(directoryPath);
                
                // 检查entries是否为数组
                if (!Array.isArray(entries)) {
                    console.warn('目录内容不是有效的数组:', entries);
                    return;
                }
                
                for (const entry of entries) {
                    // 处理entry结构，支持不同的格式
                    const path = entry.path || entry.name || entry;
                    const type = entry.type || entry.kind;
                    
                    // 跳过node_modules和隐藏文件/目录
                    if (path.includes('node_modules') || path.startsWith('.')) {
                        continue;
                    }
                    
                    // 构建完整路径
                    const fullPath = directoryPath === '/' ? path : `${directoryPath}/${path}`;
                    
                    if (type === 'directory' || type === 'dir') {
                        // 递归遍历子目录
                        await traverseDirectory(fullPath);
                    } else if (type === 'file') {
                        // 读取文件内容并搜索
                        try {
                            const content = await fileManager.readFile(fullPath);
                            if (typeof content === 'string') {
                                const fileResults = this.searchInContent(content, searchPattern, fullPath);
                                if (fileResults.length > 0) {
                                    results.push({
                                        file: fullPath,
                                        matches: fileResults,
                                        matchCount: fileResults.length
                                    });
                                }
                            }
                        } catch (error) {
                            console.warn(`无法读取文件 ${fullPath}:`, error.message);
                        }
                    }
                }
            } catch (error) {
                console.warn(`无法读取目录 ${directoryPath}:`, error.message);
            }
        }
        
        // 绑定this上下文到traverseDirectory函数
        const boundTraverseDirectory = traverseDirectory.bind(this);
        
        // 从当前工作目录开始遍历
        const startPath = fileManager.currentDirectory || '/';
        await boundTraverseDirectory(startPath);
        
        return results;
    }

    searchInContent(content, pattern, filePath) {
        const matches = [];
        const lines = content.split('\n');
        
        lines.forEach((line, lineIndex) => {
            let match;
            while ((match = pattern.exec(line)) !== null) {
                matches.push({
                    line: lineIndex + 1,
                    column: match.index + 1,
                    text: line.trim(),
                    match: match[0],
                    before: line.substring(Math.max(0, match.index - 20), match.index),
                    after: line.substring(match.index + match[0].length, Math.min(line.length, match.index + match[0].length + 20))
                });
            }
        });

        return matches;
    }

    displaySearchResults(results) {
        const resultsContainer = document.getElementById('search-results-content');
        
        if (!resultsContainer) {
            console.error('搜索结果显示容器未找到');
            return;
        }
        
        if (results.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">未找到匹配项</div>';
            return;
        }

        let html = '';
        results.forEach((fileResult, fileIndex) => {
            html += `
                <div class="search-result-file" data-file="${fileResult.file}">
                    <div class="file-header" onclick="this.parentElement.classList.toggle('collapsed')">
                        <span class="file-name">${this.getFileName(fileResult.file)}</span>
                        <span class="match-count">${fileResult.matchCount} 个匹配</span>
                        <span class="collapse-icon">−</span>
                    </div>
                    <div class="file-matches">
            `;

            fileResult.matches.forEach((match, matchIndex) => {
                html += `
                    <div class="search-match" 
                         data-file="${fileResult.file}" 
                         data-line="${match.line}"
                         data-column="${match.column}"
                         onclick="window.app.searchManager.jumpToMatch('${fileResult.file}', ${match.line}, ${match.column})">
                        <span class="line-number">${match.line}</span>
                        <span class="match-text">
                            ${this.escapeHtml(match.before)}
                            <mark>${this.escapeHtml(match.match)}</mark>
                            ${this.escapeHtml(match.after)}
                        </span>
                    </div>
                `;
            });

            html += '</div></div>';
        });

        resultsContainer.innerHTML = html;
        this.searchResults = results;
    }

    updateSearchStats(results) {
        const statsContainer = document.getElementById('search-stats');
        
        if (!statsContainer) {
            console.error('搜索统计容器未找到');
            return;
        }
        
        const totalFiles = results.length;
        const totalMatches = results.reduce((sum, file) => sum + file.matchCount, 0);

        if (totalMatches === 0) {
            statsContainer.innerHTML = '未找到匹配项';
        } else {
            statsContainer.innerHTML = `找到 ${totalMatches} 个匹配项，分布在 ${totalFiles} 个文件中`;
        }
    }

    jumpToMatch(filePath, line, column) {
        // 打开文件
        this.app.fileManager.openFile(filePath);
        
        // 跳转到指定位置
        setTimeout(() => {
            if (this.app.editorManager.editor) {
                this.app.editorManager.editor.setPosition({
                    lineNumber: line,
                    column: column
                });
                this.app.editorManager.editor.focus();
                this.app.editorManager.editor.revealLineInCenter(line);
            }
        }, 100);
    }

    navigateResult(direction) {
        if (!this.searchResults.length) return;

        // 简单的导航逻辑 - 可以改进为更智能的导航
        const currentFile = this.app.fileManager.currentFile;
        let currentFileIndex = this.searchResults.findIndex(r => r.file === currentFile);
        
        if (currentFileIndex === -1) {
            currentFileIndex = 0;
        }

        const currentFileResults = this.searchResults[currentFileIndex];
        if (currentFileResults && currentFileResults.matches.length > 0) {
            const firstMatch = currentFileResults.matches[0];
            this.jumpToMatch(currentFileResults.file, firstMatch.line, firstMatch.column);
        }
    }

    replaceOne() {
        const searchQuery = document.getElementById('search-input').value;
        const replaceText = document.getElementById('replace-input').value;
        
        if (!searchQuery || !this.app.editorManager.editor) return;

        const editor = this.app.editorManager.editor;
        const model = editor.getModel();
        const selection = editor.getSelection();
        
        // 在当前选择区域查找
        const findMatches = model.findMatches(searchQuery, selection, false, false, false, false);
        
        if (findMatches.length > 0) {
            const match = findMatches[0];
            editor.executeEdits('replace', [{
                range: match.range,
                text: replaceText
            }]);
            
            // 移动到下一个匹配项
            this.navigateResult('next');
        }
    }

    replaceAll() {
        const searchQuery = document.getElementById('search-input').value;
        const replaceText = document.getElementById('replace-input').value;
        
        if (!searchQuery || !this.app.editorManager.editor) return;

        const editor = this.app.editorManager.editor;
        const model = editor.getModel();
        
        // 查找所有匹配项
        const findMatches = model.findMatches(searchQuery, true, false, false, false, false);
        
        if (findMatches.length > 0) {
            const edits = findMatches.map(match => ({
                range: match.range,
                text: replaceText
            }));
            
            editor.executeEdits('replaceAll', edits);
            
            this.app.showOutput(`已替换 ${findMatches.length} 个匹配项`, 'success');
            
            // 重新搜索以更新结果
            this.performSearch(searchQuery);
        }
    }

    toggleReplace() {
        const replaceGroup = document.getElementById('replace-group');
        replaceGroup.style.display = replaceGroup.style.display === 'none' ? 'flex' : 'none';
        
        if (replaceGroup.style.display !== 'none') {
            document.getElementById('replace-input').focus();
        }
    }

    clearSearch() {
        document.getElementById('search-input').value = '';
        document.getElementById('search-results-content').innerHTML = '';
        document.getElementById('search-stats').innerHTML = '';
        this.searchResults = [];
        this.currentSearch = null;
    }

    focusSearch() {
        const searchInput = document.getElementById('search-input');
        searchInput.focus();
        searchInput.select();
        
        // 切换到搜索面板
        this.app.switchSidebarPanel('search');
    }

    getFileName(filePath) {
        return filePath.split('/').pop() || filePath;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // 显示搜索历史
    showSearchHistory() {
        if (this.searchHistory.length === 0) return;

        const searchInput = document.getElementById('search-input');
        const historyContainer = document.createElement('div');
        historyContainer.className = 'search-history';
        
        this.searchHistory.forEach(query => {
            const item = document.createElement('div');
            item.className = 'history-item';
            item.textContent = query;
            item.addEventListener('click', () => {
                searchInput.value = query;
                this.performSearch(query);
                historyContainer.remove();
            });
            historyContainer.appendChild(item);
        });

        searchInput.parentElement.appendChild(historyContainer);
        
        // 点击外部关闭历史记录
        setTimeout(() => {
            document.addEventListener('click', function closeHistory(e) {
                if (!historyContainer.contains(e.target)) {
                    historyContainer.remove();
                    document.removeEventListener('click', closeHistory);
                }
            });
        }, 100);
    }
}

// 将SearchManager类导出到全局作用域
window.SearchManager = SearchManager;