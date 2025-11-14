// Monaco Editor 管理器
class EditorManager {
    constructor(app) {
        this.app = app;
        this.editor = null;
        this.currentFile = null;
        this.autoSave = false;
        this.autoSaveInterval = null;
        this.lastSavedContent = '';
        this.openedFiles = new Map(); // 存储已打开的文件内容
        this.imagePreviewManager = null; // 图片预览管理器
        
        // 延迟初始化，确保Monaco Editor和DOM元素已加载
        this.delayedInit();
    }
    
    // 延迟初始化方法
    async delayedInit() {
        // 等待Monaco Editor加载完成
        if (!window.monaco) {
            await new Promise((resolve) => {
                const checkMonaco = () => {
                    if (window.monaco) {
                        resolve();
                    } else {
                        setTimeout(checkMonaco, 100);
                    }
                };
                checkMonaco();
            });
        }
        
        // 等待编辑器容器元素存在
        await this.waitForEditorContainer();
        
        // 执行初始化
        this.init();
        this.initialized = true;
    }
    
    // 等待编辑器容器元素存在
    async waitForEditorContainer() {
        return new Promise((resolve) => {
            let retryCount = 0;
            const maxRetries = 20;
            
            const checkContainer = () => {
                const editorContainer = document.getElementById('monaco-editor');
                
                if (editorContainer) {
                    console.log('编辑器容器元素找到:', editorContainer);
                    console.log('容器尺寸:', editorContainer.getBoundingClientRect());
                    resolve();
                } else {
                    retryCount++;
                    console.warn(`编辑器容器未找到，重试 ${retryCount}/${maxRetries}`);
                    
                    if (retryCount >= maxRetries) {
                        console.error('编辑器容器最终未找到，强制继续初始化');
                        resolve(); // 强制继续，避免无限等待
                    } else {
                        setTimeout(checkContainer, 200);
                    }
                }
            };
            checkContainer();
        });
    }

    // 注册自定义语言配置
    registerCustomLanguages() {
        // 增强Markdown语言配置
        monaco.languages.register({ id: 'markdown' });
        monaco.languages.setMonarchTokensProvider('markdown', {
            tokenizer: {
                root: [
                    [/^#\s.*$/, 'header'],
                    [/^##\s.*$/, 'header'],
                    [/^###\s.*$/, 'header'],
                    [/^####\s.*$/, 'header'],
                    [/^#####\s.*$/, 'header'],
                    [/^######\s.*$/, 'header'],
                    [/\*\*.*?\*\*/, 'strong'],
                    [/\*.*?\*/, 'emphasis'],
                    [/`.*?`/, 'code.inline'],
                    [/```[\s\S]*?```/, 'code.block'],
                    [/\[.*?\]\(.*?\)/, 'link'],
                    [/^\s*[-*+]\s/, 'list.item'],
                    [/^\s*\d+\.\s/, 'list.numbered'],
                    [/^>\s.*$/, 'quote']
                ]
            }
        });

        // 增强HTML语言配置
        monaco.languages.register({ id: 'html' });
        monaco.languages.setMonarchTokensProvider('html', {
            tokenizer: {
                root: [
                    [/<!DOCTYPE/, 'metatag', '@doctype'],
                    [/<style/, 'tag', '@style'],
                    [/<script/, 'tag', '@script'],
                    [/<\w+/, 'tag', '@tag'],
                    [/<\/\w+>/, 'tag'],
                    [/<!--/, 'comment', '@comment']
                ],
                doctype: [
                    [/>/, 'metatag', '@pop'],
                    [/[^>]+/, 'metatag.content']
                ],
                tag: [
                    [/\s+/, 'white'],
                    [/\w+\s*=\s*"([^"]*)"/, 'attribute.value'],
                    [/\w+\s*=\s*'([^']*)'/, 'attribute.value'],
                    [/\w+/, 'attribute.name'],
                    [/\/?>/, 'tag', '@pop']
                ],
                style: [
                    [/>/, 'tag', '@pop'],
                    [/[^>]+/, 'tag.content']
                ],
                script: [
                    [/>/, 'tag', '@pop'],
                    [/[^>]+/, 'tag.content']
                ],
                comment: [
                    [/-->/, 'comment', '@pop'],
                    [/[^-]+/, 'comment.content'],
                    [/./, 'comment.content']
                ]
            }
        });

        // 配置HTML自动补全
        monaco.languages.registerCompletionItemProvider('html', {
            provideCompletionItems: (model, position) => {
                const suggestions = [];
                
                // HTML标签补全
                const htmlTags = [
                    'div', 'span', 'p', 'a', 'img', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                    'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody',
                    'form', 'input', 'button', 'select', 'option', 'textarea',
                    'header', 'footer', 'nav', 'section', 'article', 'aside',
                    'strong', 'em', 'b', 'i', 'u', 'strike', 'code', 'pre',
                    'br', 'hr', 'meta', 'link', 'script', 'style'
                ];

                htmlTags.forEach(tag => {
                    suggestions.push({
                        label: tag,
                        kind: monaco.languages.CompletionItemKind.Keyword,
                        insertText: `<${tag}>$1</${tag}>`,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: `HTML ${tag} 标签`
                    });
                });

                // HTML属性补全
                const htmlAttributes = [
                    'class', 'id', 'style', 'src', 'href', 'alt', 'title',
                    'width', 'height', 'type', 'name', 'value', 'placeholder',
                    'disabled', 'readonly', 'required', 'checked', 'selected'
                ];

                htmlAttributes.forEach(attr => {
                    suggestions.push({
                        label: attr,
                        kind: monaco.languages.CompletionItemKind.Property,
                        insertText: `${attr}="$1"`,
                        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                        documentation: `HTML ${attr} 属性`
                    });
                });

                return { suggestions };
            }
        });
    }

    // 配置代码补全提供者
    setupCodeCompletion() {
        // 注册通用的代码补全提供者
        const languages = ['javascript', 'typescript', 'html', 'css', 'json', 'markdown'];
        
        languages.forEach(language => {
            monaco.languages.registerCompletionItemProvider(language, {
                provideCompletionItems: (model, position) => {
                    const suggestions = [];
                    const textUntilPosition = model.getValueInRange({
                        startLineNumber: 1,
                        startColumn: 1,
                        endLineNumber: position.lineNumber,
                        endColumn: position.column
                    });

                    // 获取当前行的内容
                    const lineContent = model.getLineContent(position.lineNumber);
                    const currentWord = this.getCurrentWord(lineContent, position.column);

                    // 基础字符补全（支持所有字母、数字和符号）
                    const basicChars = 'qwertyuiopasdfghjklzxcvbnmQWERTYUIOPASDFGHJKLZXCVBNM1234567890./,;\'"[]{}()+-*/=<>!?@#$%^&*|`~\\';
                    
                    basicChars.split('').forEach(char => {
                        if (currentWord === '' || char.includes(currentWord.toLowerCase())) {
                            suggestions.push({
                                label: char,
                                kind: monaco.languages.CompletionItemKind.Text,
                                insertText: char,
                                documentation: `字符: ${char}`,
                                sortText: '0' + char // 确保基础字符排在前面
                            });
                        }
                    });

                    // 常用代码片段
                    const snippets = this.getCodeSnippets(language);
                    snippets.forEach(snippet => {
                        if (currentWord === '' || snippet.label.toLowerCase().includes(currentWord.toLowerCase())) {
                            suggestions.push({
                                label: snippet.label,
                                kind: monaco.languages.CompletionItemKind.Snippet,
                                insertText: snippet.insertText,
                                insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                                documentation: snippet.documentation,
                                sortText: '1' + snippet.label
                            });
                        }
                    });

                    return { suggestions };
                }
            });
        });
    }

    // 获取当前输入的词
    getCurrentWord(lineContent, column) {
        const beforeCursor = lineContent.substring(0, column - 1);
        const match = beforeCursor.match(/[\w.]*$/);
        return match ? match[0] : '';
    }

    // 获取代码片段
    getCodeSnippets(language) {
        const snippets = {
            javascript: [
                { label: 'console.log', insertText: 'console.log($1);', documentation: '控制台输出' },
                { label: 'function', insertText: 'function ${1:name}(${2:params}) {\n\t$3\n}', documentation: '函数定义' },
                { label: 'if', insertText: 'if (${1:condition}) {\n\t$2\n}', documentation: 'if语句' },
                { label: 'for', insertText: 'for (let ${1:i} = 0; $1 < ${2:length}; $1++) {\n\t$3\n}', documentation: 'for循环' },
                { label: 'forEach', insertText: '${1:array}.forEach((${2:item}) => {\n\t$3\n});', documentation: 'forEach循环' },
                { label: 'arrow', insertText: 'const ${1:name} = (${2:params}) => {\n\t$3\n};', documentation: '箭头函数' },
                { label: 'async', insertText: 'async function ${1:name}(${2:params}) {\n\t$3\n}', documentation: '异步函数' },
                { label: 'await', insertText: 'await ${1:promise}', documentation: 'await表达式' },
                { label: 'try', insertText: 'try {\n\t$1\n} catch (error) {\n\t$2\n}', documentation: 'try-catch块' },
                { label: 'class', insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$3\n\t}\n}', documentation: '类定义' }
            ],
            typescript: [
                { label: 'interface', insertText: 'interface ${1:Name} {\n\t$2\n}', documentation: '接口定义' },
                { label: 'type', insertText: 'type ${1:Name} = $2;', documentation: '类型定义' },
                { label: 'class', insertText: 'class ${1:Name} {\n\t$2\n}', documentation: '类定义' },
                { label: 'enum', insertText: 'enum ${1:Name} {\n\t$2\n}', documentation: '枚举定义' },
                { label: 'generic', insertText: '<${1:T}>', documentation: '泛型' }
            ],
            html: [
                { label: 'div', insertText: '<div${1: class="$2"}>$3</div>', documentation: 'div容器' },
                { label: 'span', insertText: '<span${1: class="$2"}>$3</span>', documentation: 'span元素' },
                { label: 'link', insertText: '<link rel="${1:stylesheet}" href="$2">', documentation: '链接标签' },
                { label: 'script', insertText: '<script${1: src="$2"}>$3</script>', documentation: '脚本标签' },
                { label: 'img', insertText: '<img src="$1" alt="$2"${3: width="$4" height="$5"}>', documentation: '图片标签' },
                { label: 'a', insertText: '<a href="$1"${2: target="$3"}>$4</a>', documentation: '超链接' },
                { label: 'table', insertText: '<table${1: class="$2"}>\n\t<tr>\n\t\t<th>$3</th>\n\t</tr>\n\t<tr>\n\t\t<td>$4</td>\n\t</tr>\n</table>', documentation: '表格' },
                { label: 'form', insertText: '<form${1: action="$2" method="$3"}>\n\t$4\n</form>', documentation: '表单' },
                { label: 'input', insertText: '<input type="${1:text}" name="$2"${3: placeholder="$4"}>', documentation: '输入框' },
                { label: 'button', insertText: '<button type="${1:button}"${2: class="$3"}>$4</button>', documentation: '按钮' }
            ],
            css: [
                { label: 'display:flex', insertText: 'display: flex;\njustify-content: ${1:center};\nalign-items: ${2:center};', documentation: 'Flex布局' },
                { label: 'media', insertText: '@media (${1:max-width}: ${2:768px}) {\n\t$3\n}', documentation: '媒体查询' },
                { label: 'animation', insertText: 'animation: ${1:name} ${2:duration} ${3:ease} ${4:delay} ${5:iteration};', documentation: '动画' },
                { label: 'transform', insertText: 'transform: ${1:translate($2)} ${3:rotate($4)} ${5:scale($6)};', documentation: '变换' },
                { label: 'transition', insertText: 'transition: ${1:property} ${2:duration} ${3:ease} ${4:delay};', documentation: '过渡' },
                { label: 'box-shadow', insertText: 'box-shadow: ${1:x} ${2:y} ${3:blur} ${4:spread} ${5:color};', documentation: '阴影' },
                { label: 'border-radius', insertText: 'border-radius: ${1:top-left} ${2:top-right} ${3:bottom-right} ${4:bottom-left};', documentation: '圆角' },
                { label: 'background', insertText: 'background: ${1:color} ${2:url} ${3:repeat} ${4:position};', documentation: '背景' }
            ],
            json: [
                { label: 'object', insertText: '{\n\t"${1:key}": "${2:value}"\n}', documentation: 'JSON对象' },
                { label: 'array', insertText: '[\n\t${1:"item"}\n]', documentation: 'JSON数组' },
                { label: 'property', insertText: '"${1:name}": ${2:"value"}', documentation: 'JSON属性' }
            ],
            markdown: [
                { label: 'header', insertText: '# ${1:标题}', documentation: '一级标题' },
                { label: 'header2', insertText: '## ${1:标题}', documentation: '二级标题' },
                { label: 'header3', insertText: '### ${1:标题}', documentation: '三级标题' },
                { label: 'bold', insertText: '**${1:粗体文本}**', documentation: '粗体文本' },
                { label: 'italic', insertText: '*${1:斜体文本}*', documentation: '斜体文本' },
                { label: 'strikethrough', insertText: '~~${1:删除线文本}~~', documentation: '删除线' },
                { label: 'code', insertText: '`${1:代码}`', documentation: '行内代码' },
                { label: 'codeblock', insertText: '```${1:语言}\n${2:代码}\n```', documentation: '代码块' },
                { label: 'link', insertText: '[${1:链接文本}](${2:URL})', documentation: '超链接' },
                { label: 'image', insertText: '![${1:图片描述}](${2:图片URL})', documentation: '图片' },
                { label: 'list', insertText: '- ${1:列表项}', documentation: '无序列表' },
                { label: 'numberlist', insertText: '1. ${1:列表项}', documentation: '有序列表' },
                { label: 'quote', insertText: '> ${1:引用文本}', documentation: '引用' },
                { label: 'table', insertText: '| ${1:标题1} | ${2:标题2} |\n|----------|----------|\n| ${3:内容1} | ${4:内容2} |', documentation: '表格' },
                { label: 'tasklist', insertText: '- [ ] ${1:任务项}', documentation: '任务列表' },
                { label: 'horizontal', insertText: '---', documentation: '水平分割线' }
            ]
        };

        return snippets[language] || snippets.javascript;
    }

    // 设置格式化功能
    setupFormatting() {
        // 添加格式化命令 (Ctrl+Shift+F)
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF, () => {
            this.formatCode();
        });

        // 添加右键菜单格式化选项
        this.editor.addAction({
            id: 'format-code',
            label: '格式化代码',
            keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
            contextMenuGroupId: '1_modification',
            contextMenuOrder: 1.5,
            run: () => {
                this.formatCode();
            }
        });
    }

    // 格式化代码
    async formatCode() {
        try {
            const code = this.editor.getValue();
            const language = this.editor.getModel()?.getLanguageId() || 'javascript';
            
            let formattedCode = code;
            
            // 根据语言类型进行格式化
            switch (language) {
                case 'javascript':
                case 'typescript':
                case 'json':
                    formattedCode = await this.formatJavaScript(code);
                    break;
                case 'html':
                case 'xml':
                    formattedCode = await this.formatHTML(code);
                    break;
                case 'css':
                case 'less':
                case 'scss':
                    formattedCode = await this.formatCSS(code);
                    break;
                case 'markdown':
                    formattedCode = await this.formatMarkdown(code);
                    break;
                default:
                    // 使用基本格式化
                    formattedCode = this.basicFormat(code);
            }

            if (formattedCode !== code) {
                const selection = this.editor.getSelection();
                this.editor.executeEdits('format', [{
                    range: this.editor.getModel().getFullModelRange(),
                    text: formattedCode
                }]);
                
                // 恢复选择
                if (selection) {
                    this.editor.setSelection(selection);
                }
                
                this.showMessage('代码已格式化', 'success');
            }
        } catch (error) {
            console.error('格式化失败:', error);
            this.showMessage('格式化失败: ' + error.message, 'error');
        }
    }

    // JavaScript/TypeScript 格式化
    async formatJavaScript(code) {
        // 使用内置的格式化规则
        return this.basicFormat(code);
    }

    // HTML 格式化
    async formatHTML(code) {
        return code
            .replace(/></g, '>\n<')
            .replace(/\n\s*\n/g, '\n')
            .replace(/(<(div|p|h[1-6]|ul|ol|li|section|article|header|footer|nav|main|aside)>)\s*/g, '\n$1\n')
            .replace(/\s*(<\/(div|p|h[1-6]|ul|ol|li|section|article|header|footer|nav|main|aside)>)/g, '\n$1\n')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    // CSS 格式化
    async formatCSS(code) {
        return code
            .replace(/\s*\{\s*/g, ' {\n    ')
            .replace(/;\s*/g, ';\n    ')
            .replace(/\s*\}\s*/g, '\n}\n')
            .replace(/\n\s*\n/g, '\n')
            .trim();
    }

    // Markdown 格式化
    async formatMarkdown(code) {
        return code
            .replace(/^\s*#\s*(.+)$/gm, '# $1')
            .replace(/^\s*##\s*(.+)$/gm, '## $1')
            .replace(/^\s*###\s*(.+)$/gm, '### $1')
            .replace(/^\s*-\s*(.+)$/gm, '- $1')
            .replace(/^\s*\*\s*(.+)$/gm, '* $1')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
    }

    // 基本格式化
    basicFormat(code) {
        // 移除多余的空行
        return code
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .replace(/[ \t]+$/gm, '')
            .replace(/^\s*\n/gm, '')
            .trim();
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 创建消息元素
        const messageEl = document.createElement('div');
        messageEl.className = `message message-${type}`;
        messageEl.textContent = message;
        messageEl.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            z-index: 1000;
            transition: opacity 0.3s ease;
            background: ${type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3'};
        `;

        document.body.appendChild(messageEl);

        // 3秒后移除
        setTimeout(() => {
            messageEl.style.opacity = '0';
            setTimeout(() => {
                if (messageEl.parentNode) {
                    messageEl.parentNode.removeChild(messageEl);
                }
            }, 300);
        }, 3000);
    }

    init() {
        try {
            this.createEditor();
            this.registerCustomLanguages();
            this.setupCodeCompletion();
            this.bindEvents();
            console.log('编辑器管理器初始化完成');
        } catch (error) {
            console.error('编辑器管理器初始化失败:', error);
            // 尝试重新初始化
            setTimeout(() => {
                console.log('尝试重新初始化编辑器管理器...');
                this.init();
            }, 1000);
        }
    }

    createEditor() {
        const editorContainer = document.getElementById('monaco-editor');
        
        if (!editorContainer) {
            console.error('编辑器容器元素未找到，无法创建编辑器');
            throw new Error('编辑器容器元素未找到');
        }
        
        console.log('开始创建编辑器，容器元素:', editorContainer);
        
        // 注册自定义语言配置
        this.registerCustomLanguages();
        
        // 配置代码补全提供者
        this.setupCodeCompletion();
        
        this.editor = monaco.editor.create(editorContainer, {
            value: '// 欢迎使用 X IDE\n// 开始编写你的代码吧！\n\nconsole.log("Hello, World!");',
            language: 'javascript',
            theme: this.app.currentTheme,
            fontSize: 14,
            minimap: {
                enabled: true,
                side: 'right'
            },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            autoIndent: 'full',
            // 其他增强功能
            bracketPairColorization: {
                enabled: true
            },
            guides: {
                bracketPairs: true,
                indentation: true,
                highlightActiveIndentation: true
            },
            tabSize: 2,
            insertSpaces: true,
            renderWhitespace: 'selection',
            renderLineHighlight: 'line',
            selectOnLineNumbers: true,
            mouseWheelZoom: true,
            bracketPairColorization: {
                enabled: true
            },
            guides: {
                indentation: true,
                bracketPairs: true
            },
            // 启用代码折叠
            folding: true,
            foldingStrategy: 'auto',
            showFoldingControls: 'always',
            unfoldOnClickAfterEndOfLine: true,
            // 启用多光标编辑
            multiCursorModifier: 'ctrlCmd',
            multiCursorMergeOverlapping: true,
            // 启用代码提示
            quickSuggestions: {
                other: true,
                comments: true,
                strings: true
            },
            suggest: {
                showIcons: true,
                showSnippets: true,
                showWords: true,
                showColors: true,
                showFiles: true,
                showReferences: true,
                showFolders: true,
                insertMode: 'insert',
                showKeywords: true,
                showFunctions: true,
                showClasses: true,
                showModules: true,
                showVariables: true,
                showFields: true,
                showOperators: true,
                showTypeParameters: true,
                showValues: true,
                showUnits: true,
                showText: true
            },
            // 启用参数提示
            parameterHints: {
                enabled: true,
                cycle: true
            },
            // 启用颜色预览
            colorDecorators: {
                enabled: true
            }
        });

        // 设置格式化命令
        this.setupFormatting();

        // 监听编辑器内容变化
        this.editor.onDidChangeModelContent(() => {
            this.markCurrentFileAsDirty();
            
            if (this.autoSave) {
                this.scheduleAutoSave();
            }
        });

        // 监听语言变化
        this.editor.onDidChangeModelLanguage((e) => {
            console.log('语言切换到:', e.newLanguage);
        });

        console.log('Monaco Editor 创建完成');
        
        // 通知设置管理器编辑器已就绪
        if (this.app && this.app.settingsManager) {
            console.log('通知设置管理器编辑器已就绪');
            this.app.settingsManager.onEditorManagerReady();
        }
    }

    bindEvents() {
        // 监听文件保存快捷键
        this.editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
            this.saveCurrentFile();
        });

        // 监听编辑器失去焦点事件
        this.editor.onDidBlurEditorText(() => {
            if (this.autoSave && this.isCurrentFileDirty()) {
                this.saveCurrentFile();
            }
        });
    }

    openFile(filePath, content = '') {
        this.currentFile = filePath;
        
        // 检查是否为图片文件
        if (this.isImageFile(filePath)) {
            this.openImageFile(filePath);
            return;
        }
        
        // 隐藏图片预览
        if (this.imagePreviewManager) {
            this.imagePreviewManager.hideImagePreview();
        }
        
        // 显示编辑器
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer) {
            editorContainer.style.display = 'block';
        }
        
        // 根据文件扩展名检测语言
        const language = this.detectLanguage(filePath);
        
        // 更新编辑器内容
        this.editor.setValue(content);
        
        // 更新编辑器语言
        monaco.editor.setModelLanguage(this.editor.getModel(), language);
        
        // 更新编辑器标题
        this.updateEditorTitle(filePath);
        
        console.log(`打开文件: ${filePath}, 语言: ${language}`);
    }

    // 打开图片文件
    async openImageFile(filePath) {
        try {
            // 隐藏编辑器
            const editorContainer = document.getElementById('editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'none';
            }
            
            // 初始化图片预览管理器（如果需要）
            if (!this.imagePreviewManager) {
                this.imagePreviewManager = new ImagePreviewManager(this.app);
            }
            
            // 显示图片预览
            await this.imagePreviewManager.showImagePreview(filePath);
            
            // 更新编辑器标题
            this.updateEditorTitle(filePath);
            
            console.log(`打开图片文件: ${filePath}`);
        } catch (error) {
            console.error('打开图片文件失败:', error);
            this.app.showError(`无法打开图片文件: ${error.message}`);
            
            // 回退到普通文件打开方式
            const editorContainer = document.getElementById('editor-container');
            if (editorContainer) {
                editorContainer.style.display = 'block';
            }
        }
    }

    closeFile() {
        this.currentFile = null;
        this.editor.setValue('');
        this.updateEditorTitle('未命名');
    }

    saveCurrentFile() {
        if (!this.currentFile) {
            this.app.showOutput('没有打开的文件需要保存', 'warning');
            return;
        }

        const content = this.editor.getValue();
        
        // 触发文件保存事件
        this.app.fileManager.saveFile(this.currentFile, content)
            .then(() => {
                this.markCurrentFileAsClean();
                this.app.showOutput(`文件已保存: ${this.currentFile}`);
            })
            .catch(error => {
                this.app.showError(`保存文件失败: ${error.message}`);
            });
    }

    detectLanguage(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        const languageMap = {
            'js': 'javascript',
            'jsx': 'javascript',
            'ts': 'typescript',
            'tsx': 'typescript',
            'html': 'html',
            'htm': 'html',
            'css': 'css',
            'scss': 'scss',
            'sass': 'sass',
            'less': 'less',
            'json': 'json',
            'xml': 'xml',
            'md': 'markdown',
            'markdown': 'markdown',
            'py': 'python',
            'java': 'java',
            'cpp': 'cpp',
            'c': 'c',
            'h': 'c',
            'hpp': 'cpp',
            'cs': 'csharp',
            'php': 'php',
            'rb': 'ruby',
            'go': 'go',
            'rs': 'rust',
            'swift': 'swift',
            'kt': 'kotlin',
            'sh': 'shell',
            'bash': 'shell',
            'yml': 'yaml',
            'yaml': 'yaml',
            'dockerfile': 'dockerfile',
            'sql': 'sql',
            'txt': 'plaintext',
            'log': 'plaintext',
            'vue': 'vue',
            'svelte': 'svelte',
            'astro': 'astro'
        };
        
        return languageMap[extension] || 'plaintext';
    }

    // 检测是否为图片文件
    isImageFile(filePath) {
        const extension = filePath.split('.').pop().toLowerCase();
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'ico', 'tiff', 'tif'];
        return imageExtensions.includes(extension);
    }

    updateEditorTitle(filePath) {
        const fileName = filePath.split('/').pop() || '未命名';
        // 这里可以更新编辑器区域的标题显示
        console.log(`编辑器标题: ${fileName}`);
    }

    markCurrentFileAsDirty() {
        if (this.currentFile && this.app.activeTab) {
            const tabData = this.app.openTabs.get(this.app.activeTab);
            if (tabData) {
                tabData.isDirty = true;
                tabData.content = this.editor.getValue();
                
                // 更新标签显示
                const tabElement = document.querySelector(`[data-tab-id="${this.app.activeTab}"]`);
                if (tabElement && !tabElement.querySelector('.dirty-indicator')) {
                    const fileNameElement = tabElement.querySelector('.file-name');
                    if (fileNameElement) {
                        fileNameElement.innerHTML += '<span class="dirty-indicator">●</span>';
                    }
                }
            }
        }
    }

    markCurrentFileAsClean() {
        if (this.currentFile && this.app.activeTab) {
            const tabData = this.app.openTabs.get(this.app.activeTab);
            if (tabData) {
                tabData.isDirty = false;
                
                // 更新标签显示
                const tabElement = document.querySelector(`[data-tab-id="${this.app.activeTab}"]`);
                if (tabElement) {
                    const dirtyIndicator = tabElement.querySelector('.dirty-indicator');
                    if (dirtyIndicator) {
                        dirtyIndicator.remove();
                    }
                }
            }
        }
    }

    isCurrentFileDirty() {
        if (this.currentFile && this.app.activeTab) {
            const tabData = this.app.openTabs.get(this.app.activeTab);
            return tabData ? tabData.isDirty : false;
        }
        return false;
    }

    scheduleAutoSave() {
        // 清除之前的定时器
        if (this.autoSaveInterval) {
            clearTimeout(this.autoSaveInterval);
        }
        
        // 设置新的定时器（延迟1秒自动保存）
        this.autoSaveInterval = setTimeout(() => {
            this.saveCurrentFile();
        }, 1000);
    }

    setAutoSave(enabled) {
        this.autoSave = enabled;
        
        if (!enabled && this.autoSaveInterval) {
            clearTimeout(this.autoSaveInterval);
            this.autoSaveInterval = null;
        }
        
        console.log(`自动保存 ${enabled ? '已启用' : '已禁用'}`);
    }

    updateFontSize(size) {
        if (this.editor) {
            this.editor.updateOptions({ fontSize: size });
            console.log(`字体大小更新为: ${size}px`);
        }
    }

    updateTheme(theme) {
        if (this.editor) {
            monaco.editor.setTheme(theme);
            console.log(`编辑器主题更新为: ${theme}`);
        }
    }

    layout() {
        if (this.editor) {
            this.editor.layout();
        }
    }

    // 获取当前编辑器内容
    getCurrentContent() {
        return this.editor ? this.editor.getValue() : '';
    }

    // 获取当前语言
    getCurrentLanguage() {
        if (this.editor && this.editor.getModel()) {
            return this.editor.getModel().getLanguageId();
        }
        return 'plaintext';
    }

    // 插入文本
    insertText(text) {
        if (this.editor) {
            const selection = this.editor.getSelection();
            const id = { major: 1, minor: 1 };
            const op = {
                identifier: id,
                range: selection,
                text: text,
                forceMoveMarkers: true
            };
            this.editor.executeEdits("insertText", [op]);
        }
    }

    // 格式化代码
    formatCode() {
        if (this.editor) {
            this.editor.getAction('editor.action.formatDocument').run()
                .then(() => {
                    this.app.showOutput('代码格式化完成');
                })
                .catch(error => {
                    this.app.showError('代码格式化失败: ' + error.message);
                });
        }
    }

    // 查找和替换
    showFindWidget() {
        if (this.editor) {
            this.editor.getAction('actions.find').run();
        }
    }

    // 跳转到行
    gotoLine(lineNumber) {
        if (this.editor) {
            this.editor.setPosition({ lineNumber: lineNumber, column: 1 });
            this.editor.revealLineInCenter(lineNumber);
        }
    }

    // 获取当前光标位置
    getCursorPosition() {
        if (this.editor) {
            const position = this.editor.getPosition();
            return {
                line: position.lineNumber,
                column: position.column
            };
        }
        return { line: 1, column: 1 };
    }

    // 获取选中的文本
    getSelectedText() {
        if (this.editor) {
            const selection = this.editor.getSelection();
            return this.editor.getModel().getValueInRange(selection);
        }
        return '';
    }

    // 全选
    selectAll() {
        if (this.editor) {
            this.editor.setSelection(
                this.editor.getModel().getFullModelRange()
            );
        }
    }

    // 撤销
    undo() {
        if (this.editor) {
            this.editor.trigger('keyboard', 'undo', null);
        }
    }

    // 重做
    redo() {
        if (this.editor) {
            this.editor.trigger('keyboard', 'redo', null);
        }
    }
}

// 将EditorManager类导出到全局作用域
window.EditorManager = EditorManager;