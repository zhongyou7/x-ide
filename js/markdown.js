/**
 * X-IDE Markdown 渲染器
 * 增强的Markdown文档显示功能
 */

class MarkdownRenderer {
    constructor() {
        // 简单的Markdown语法规则
        this.rules = {
            // 标题
            heading: /^(#{1,6})\s+(.+)$/gm,
            // 粗体
            bold: /\*\*([^*]+)\*\*/g,
            // 斜体
            italic: /\*([^*]+)\*/g,
            // 代码块
            codeBlock: /```([\s\S]*?)```/g,
            // 行内代码
            inlineCode: /`([^`]+)`/g,
            // 链接
            link: /\[([^\]]+)\]\(([^)]+)\)/g,
            // 图片
            image: /!\[([^\]]*)\]\(([^)]+)\)/g,
            // 列表
            listItem: /^[\s]*[-*+]\s+(.+)$/gm,
            // 有序列表
            orderedList: /^[\s]*\d+\.\s+(.+)$/gm,
            // 引用
            blockquote: /^>\s*(.+)$/gm,
            // 水平线
            horizontalRule: /^-{3,}$/gm,
            // 换行
            lineBreak: /\n/g
        };
    }

    /**
     * 渲染Markdown文本为HTML
     */
    render(markdown) {
        if (!markdown) return '';
        
        let html = markdown;
        
        // 代码块（优先处理，避免与其他规则冲突）
        html = html.replace(this.rules.codeBlock, (match, code) => {
            const cleanCode = this.escapeHtml(code.trim());
            return `<pre class="markdown-code-block"><code>${cleanCode}</code></pre>`;
        });
        
        // 标题
        html = html.replace(this.rules.heading, (match, hashes, text) => {
            const level = hashes.length;
            return `<h${level} class="markdown-heading-${level}">${text}</h${level}>`;
        });
        
        // 水平线
        html = html.replace(this.rules.horizontalRule, '<hr class="markdown-hr">');
        
        // 引用
        html = html.replace(this.rules.blockquote, (match, text) => {
            return `<blockquote class="markdown-blockquote">${text}</blockquote>`;
        });
        
        // 粗体
        html = html.replace(this.rules.bold, '<strong class="markdown-bold">$1</strong>');
        
        // 斜体
        html = html.replace(this.rules.italic, '<em class="markdown-italic">$1</em>');
        
        // 行内代码
        html = html.replace(this.rules.inlineCode, '<code class="markdown-inline-code">$1</code>');
        
        // 图片
        html = html.replace(this.rules.image, (match, alt, src) => {
            return `<img class="markdown-image" src="${src}" alt="${alt}" title="${alt}">`;
        });
        
        // 链接
        html = html.replace(this.rules.link, '<a class="markdown-link" href="$2" target="_blank">$1</a>');
        
        // 有序列表
        html = html.replace(this.rules.orderedList, (match, text) => {
            return `<li class="markdown-list-item">${text}</li>`;
        });
        
        // 无序列表
        html = html.replace(this.rules.listItem, (match, text) => {
            return `<li class="markdown-list-item">${text}</li>`;
        });
        
        // 处理列表结构
        html = this.processLists(html);
        
        // 段落
        html = this.processParagraphs(html);
        
        // 换行
        html = html.replace(this.rules.lineBreak, '<br class="markdown-line-break">');
        
        return html;
    }
    
    /**
     * 处理列表结构
     */
    processLists(html) {
        const lines = html.split('\n');
        let result = [];
        let inUnorderedList = false;
        let inOrderedList = false;
        
        for (let line of lines) {
            const isListItem = line.includes('<li class="markdown-list-item">');
            const isOrdered = /^\d+\./.test(line.replace(/<[^>]*>/g, ''));
            
            if (isListItem) {
                if (isOrdered && !inOrderedList) {
                    if (inUnorderedList) {
                        result.push('</ul>');
                        inUnorderedList = false;
                    }
                    result.push('<ol class="markdown-ordered-list">');
                    inOrderedList = true;
                } else if (!isOrdered && !inUnorderedList) {
                    if (inOrderedList) {
                        result.push('</ol>');
                        inOrderedList = false;
                    }
                    result.push('<ul class="markdown-unordered-list">');
                    inUnorderedList = true;
                }
                result.push(line);
            } else {
                if (inUnorderedList) {
                    result.push('</ul>');
                    inUnorderedList = false;
                }
                if (inOrderedList) {
                    result.push('</ol>');
                    inOrderedList = false;
                }
                result.push(line);
            }
        }
        
        if (inUnorderedList) result.push('</ul>');
        if (inOrderedList) result.push('</ol>');
        
        return result.join('\n');
    }
    
    /**
     * 处理段落
     */
    processParagraphs(html) {
        const lines = html.split('\n');
        let result = [];
        let inParagraph = false;
        
        for (let line of lines) {
            const isBlockElement = line.includes('<h') || line.includes('<pre') || 
                                 line.includes('<blockquote') || line.includes('<hr') ||
                                 line.includes('<ul') || line.includes('<ol') || line.includes('<li');
            const isEmpty = !line.trim();
            
            if (isBlockElement || isEmpty) {
                if (inParagraph) {
                    result.push('</p>');
                    inParagraph = false;
                }
                result.push(line);
            } else {
                if (!inParagraph) {
                    result.push('<p class="markdown-paragraph">');
                    inParagraph = true;
                }
                result.push(line);
            }
        }
        
        if (inParagraph) {
            result.push('</p>');
        }
        
        return result.join('\n');
    }
    
    /**
     * HTML转义
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * 创建Markdown预览窗口
     */
    createPreviewWindow(content, title = 'Markdown Preview') {
        const previewWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background-color: #fff;
        }
        
        .markdown-heading-1 {
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 10px;
            margin-top: 30px;
            margin-bottom: 20px;
        }
        
        .markdown-heading-2 {
            color: #34495e;
            border-bottom: 1px solid #bdc3c7;
            padding-bottom: 8px;
            margin-top: 25px;
            margin-bottom: 15px;
        }
        
        .markdown-heading-3 {
            color: #7f8c8d;
            margin-top: 20px;
            margin-bottom: 10px;
        }
        
        .markdown-paragraph {
            margin-bottom: 15px;
        }
        
        .markdown-code-block {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 15px;
            margin: 15px 0;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            line-height: 1.4;
        }
        
        .markdown-inline-code {
            background-color: #f1f2f6;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            font-size: 14px;
            color: #e74c3c;
        }
        
        .markdown-link {
            color: #3498db;
            text-decoration: none;
            border-bottom: 1px dotted #3498db;
        }
        
        .markdown-link:hover {
            color: #2980b9;
            border-bottom-style: solid;
        }
        
        .markdown-image {
            max-width: 100%;
            height: auto;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            margin: 15px 0;
        }
        
        .markdown-blockquote {
            border-left: 4px solid #3498db;
            margin: 15px 0;
            padding-left: 20px;
            color: #7f8c8d;
            font-style: italic;
            background-color: #f8f9fa;
            padding: 15px 20px;
            border-radius: 0 4px 4px 0;
        }
        
        .markdown-unordered-list, .markdown-ordered-list {
            margin: 15px 0;
            padding-left: 30px;
        }
        
        .markdown-list-item {
            margin-bottom: 8px;
        }
        
        .markdown-bold {
            font-weight: bold;
            color: #2c3e50;
        }
        
        .markdown-italic {
            font-style: italic;
            color: #7f8c8d;
        }
        
        .markdown-hr {
            border: none;
            height: 1px;
            background-color: #bdc3c7;
            margin: 30px 0;
        }
        
        @media (max-width: 600px) {
            body {
                padding: 15px;
            }
            
            .markdown-heading-1 {
                font-size: 24px;
            }
            
            .markdown-heading-2 {
                font-size: 20px;
            }
            
            .markdown-code-block {
                font-size: 12px;
                padding: 10px;
            }
        }
    </style>
</head>
<body>
    <div class="markdown-content">
        ${this.render(content)}
    </div>
    <script>
        // 添加代码高亮（简单实现）
        document.querySelectorAll('.markdown-code-block code').forEach(block => {
            // 简单的语法高亮
            let html = block.innerHTML;
            // 关键字高亮
            html = html.replace(/\\b(function|const|let|var|if|else|for|while|return|class|import|export)\\b/g, '<span style="color: #e74c3c; font-weight: bold;">$1</span>');
            // 字符串高亮
            html = html.replace(/(['"])([^'"]*?)\\1/g, '<span style="color: #27ae60;">$1$2$1</span>');
            // 注释高亮
            html = html.replace(/(\\/\\/.*$)/gm, '<span style="color: #95a5a6; font-style: italic;">$1</span>');
            block.innerHTML = html;
        });
        
        // 图片点击放大
        document.querySelectorAll('.markdown-image').forEach(img => {
            img.style.cursor = 'pointer';
            img.addEventListener('click', function() {
                window.open(this.src, '_blank');
            });
        });
    </script>
</body>
</html>`;
        
        previewWindow.document.write(html);
        previewWindow.document.close();
        
        return previewWindow;
    }
}

// 全局Markdown渲染器实例
window.markdownRenderer = new MarkdownRenderer();

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MarkdownRenderer;
}