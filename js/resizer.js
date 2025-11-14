// 分隔条拖动功能
class Resizer {
    constructor(app) {
        this.app = app;
        this.sidebar = null;
        this.sidebarResizer = null;
        this.editorContainer = null;
        this.bottomPanel = null;
        this.bottomResizer = null;
        
        this.isResizing = false;
        this.currentResizer = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.originalEditorHeight = 0;
        this.resizeTimeout = null;
        
        // 确保DOM完全加载后初始化
        this.initializeWithRetry();
    }
    
    // 带重试机制的初始化
    initializeWithRetry(retryCount = 0) {
        const maxRetries = 10;
        
        try {
            this.init();
            console.log('分隔条初始化成功');
        } catch (error) {
            console.warn(`分隔条初始化失败 (尝试 ${retryCount + 1}/${maxRetries}):`, error);
            
            if (retryCount < maxRetries) {
                setTimeout(() => {
                    this.initializeWithRetry(retryCount + 1);
                }, 500);
            } else {
                console.error('分隔条初始化最终失败');
            }
        }
    }
    
    testResizerElements() {
        const sidebarResizer = document.getElementById('sidebar-resizer');
        const bottomResizer = document.getElementById('bottom-resizer');
        
        console.log('=== Resizer Elements Test ===');
        console.log('Sidebar resizer:', sidebarResizer);
        console.log('Bottom resizer:', bottomResizer);
        
        if (sidebarResizer) {
            const rect = sidebarResizer.getBoundingClientRect();
            console.log('Sidebar resizer rect:', rect);
            console.log('Sidebar resizer computed style:', window.getComputedStyle(sidebarResizer));
        }
        
        if (bottomResizer) {
            const rect = bottomResizer.getBoundingClientRect();
            console.log('Bottom resizer rect:', rect);
            console.log('Bottom resizer computed style:', window.getComputedStyle(bottomResizer));
        }
        
        console.log('=== End Test ===');
    }
    
    init() {
        // 获取DOM元素
        this.sidebar = document.getElementById('sidebar');
        this.sidebarResizer = document.getElementById('sidebar-resizer');
        this.editorContainer = document.getElementById('editor-container');
        this.bottomPanel = document.getElementById('bottom-panel');
        this.bottomResizer = document.getElementById('bottom-resizer');
        
        console.log('Resizer initialization:');
        console.log('- Sidebar:', this.sidebar);
        console.log('- Sidebar resizer:', this.sidebarResizer);
        console.log('- Bottom panel:', this.bottomPanel);
        console.log('- Bottom resizer:', this.bottomResizer);
        
        // 检查元素是否存在
        if (!this.sidebar || !this.sidebarResizer || !this.bottomPanel || !this.bottomResizer) {
            console.warn('分隔条功能初始化失败：缺少必要的DOM元素，将在100ms后重试');
            // 如果元素不存在，延迟重试
            setTimeout(() => this.init(), 100);
            return;
        }
        
        // 检查元素是否可见
        const sidebarStyle = window.getComputedStyle(this.sidebarResizer);
        const bottomStyle = window.getComputedStyle(this.bottomResizer);
        
        console.log('Sidebar resizer computed style:', {
            display: sidebarStyle.display,
            visibility: sidebarStyle.visibility,
            pointerEvents: sidebarStyle.pointerEvents,
            cursor: sidebarStyle.cursor,
            zIndex: sidebarStyle.zIndex
        });
        
        console.log('Bottom resizer computed style:', {
            display: bottomStyle.display,
            visibility: bottomStyle.visibility,
            pointerEvents: bottomStyle.pointerEvents,
            cursor: bottomStyle.cursor,
            zIndex: bottomStyle.zIndex
        });
        
        // 加载保存的宽度和高度
        this.loadWidth();
        this.loadHeight();
        
        // 绑定事件监听器
        this.bindEvents();
        
        // 初始化时调整一次编辑器高度
        setTimeout(() => {
            this.adjustEditorContainerHeight();
        }, 500);
        
        console.log('分隔条功能初始化完成');
    }
    
    bindEvents() {
        console.log('Binding resizer events...');
        
        // 侧边栏分隔条事件
        if (this.sidebarResizer) {
            console.log('Binding sidebar resizer events');
            this.sidebarResizer.addEventListener('mousedown', (e) => {
                console.log('Sidebar resizer mousedown event fired');
                this.currentResizer = 'sidebar';
                this.startResizing(e);
            });
            
            this.sidebarResizer.addEventListener('dblclick', () => {
                this.resetWidth();
            });
            
            // 添加鼠标悬停事件来测试侧边栏分隔条是否可交互
            this.sidebarResizer.addEventListener('mouseenter', () => {
                console.log('Sidebar resizer mouseenter event fired');
            });
            
            this.sidebarResizer.addEventListener('mouseleave', () => {
                console.log('Sidebar resizer mouseleave event fired');
            });
        } else {
            console.error('Sidebar resizer element not found for event binding');
        }
        
        // 底部分隔条事件
        if (this.bottomResizer) {
            console.log('Binding bottom resizer events');
            this.bottomResizer.addEventListener('mousedown', (e) => {
                console.log('Bottom resizer mousedown event fired');
                this.currentResizer = 'bottom';
                this.startResizing(e);
            });
            
            // 添加鼠标悬停事件来测试底部分隔条是否可交互
            this.bottomResizer.addEventListener('mouseenter', () => {
                console.log('Bottom resizer mouseenter event fired');
            });
            
            this.bottomResizer.addEventListener('mouseleave', () => {
                console.log('Bottom resizer mouseleave event fired');
            });
            
            // 点击事件
            this.bottomResizer.addEventListener('click', () => {
                console.log('Bottom resizer clicked');
            });
            
            this.bottomResizer.addEventListener('dblclick', () => {
                this.resetHeight();
            });
        } else {
            console.error('Bottom resizer element not found for event binding');
        }
        
        // 全局鼠标事件
        document.addEventListener('mousemove', (e) => this.handleResizing(e));
        document.addEventListener('mouseup', () => this.stopResizing());
        
        // 触摸事件支持
        this.sidebarResizer.addEventListener('touchstart', (e) => {
            this.currentResizer = 'sidebar';
            this.startResizing(e.touches[0]);
        });
        
        this.bottomResizer.addEventListener('touchstart', (e) => {
            this.currentResizer = 'bottom';
            this.startResizing(e.touches[0]);
        });
        
        document.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) {
                this.handleResizing(e.touches[0]);
            }
        });
        
        document.addEventListener('touchend', () => this.stopResizing());
    }
    
    startResizing(e) {
        this.isResizing = true;
        
        if (this.currentResizer === 'sidebar') {
            console.log('Starting sidebar resize');
            this.startX = e.clientX;
            this.startWidth = parseInt(document.defaultView.getComputedStyle(this.sidebar).width, 10);
            
            // 添加resizing类
            this.sidebarResizer.classList.add('resizing');
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        } else if (this.currentResizer === 'bottom') {
            console.log('Starting bottom resize');
            this.startY = e.clientY;
            this.startHeight = parseInt(document.defaultView.getComputedStyle(this.bottomPanel).height, 10);
            
            // 添加resizing类
            this.bottomResizer.classList.add('resizing');
            
            // 防止文本选择
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'row-resize';
            
            // 记录原始编辑器容器高度
            this.originalEditorHeight = this.editorContainer ? this.editorContainer.offsetHeight : 0;
            
            // 调试：显示开始拖拽时的详细信息
            console.log(`Bottom resize start: clientY=${e.clientY}, startHeight=${this.startHeight}`);
            console.log(`Bottom panel position: top=${this.bottomPanel.offsetTop}, left=${this.bottomPanel.offsetLeft}`);
            console.log(`Bottom resizer position: top=${this.bottomResizer.offsetTop}, left=${this.bottomResizer.offsetLeft}`);
        }
    }
    
    handleResizing(e) {
        if (!this.isResizing) return;
        
        if (this.currentResizer === 'sidebar') {
            const dx = e.clientX - this.startX;
            const newWidth = this.startWidth + dx;
            
            // 限制最小和最大宽度
            const minWidth = 200;
            const maxWidth = 600;
            
            if (newWidth >= minWidth && newWidth <= maxWidth) {
                this.sidebar.style.width = newWidth + 'px';
                
                // 保存到本地存储
                this.saveWidth(newWidth);
            }
        } else if (this.currentResizer === 'bottom') {
            const currentY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
            
            // 计算与起始位置的差异
            const deltaY = this.startY - currentY; // 向上拖拽为正值
            
            // 计算新高度（向上拖拽增加高度）
            let newHeight = this.startHeight + deltaY;
            
            // 限制高度范围
            const minHeight = 100;
            const maxHeight = 600;
            const finalHeight = Math.max(minHeight, Math.min(maxHeight, newHeight));
            
            // 应用新高度
            this.bottomPanel.style.height = finalHeight + 'px';
            
            // 确保底部面板是可见的
            this.bottomPanel.style.display = 'flex';
            this.bottomPanel.style.flexDirection = 'column';
            
            // 实时调整编辑器容器高度 - 使用节流避免频繁重绘
            if (!this.resizeTimeout) {
                this.resizeTimeout = setTimeout(() => {
                    // 即使编辑器容器被隐藏，也确保正确调整高度
                    this.adjustEditorContainerHeight();
                    this.resizeTimeout = null;
                }, 16); // 约60fps
            }
        }
    }
    
    // 调整编辑器容器高度
    adjustEditorContainerHeight() {
        // 获取底部面板高度（默认200px）
        const bottomPanelHeight = parseInt(this.bottomPanel.style.height, 10) || 200;
        const bottomResizerHeight = 12; // 分隔条高度（与CSS匹配）
        const totalBottomHeight = bottomPanelHeight + bottomResizerHeight;
        
        // 确保底部面板样式正确
        this.bottomPanel.style.minHeight = '100px';
        this.bottomPanel.style.maxHeight = '600px';
        
        // 获取容器元素
        const container = this.bottomPanel.parentElement;
        if (!container) {
            console.warn('容器元素不存在，无法调整编辑器高度');
            return;
        }
        
        const containerHeight = container.offsetHeight;
        const editorHeight = Math.max(containerHeight - totalBottomHeight, 100); // 最小高度100px
        
        // 更新编辑器容器高度
        if (this.editorContainer) {
            // 无论编辑器容器是否可见，都确保设置正确的高度
            this.editorContainer.style.height = editorHeight + 'px';
            this.editorContainer.style.flex = 'none';
            
            // 只有当编辑器容器可见时，才布局Monaco编辑器
            if (this.editorContainer.style.display !== 'none') {
                const monacoEditor = document.getElementById('monaco-editor');
                if (monacoEditor && this.app && this.app.editorManager && this.app.editorManager.editor) {
                    // 布局Monaco编辑器
                    this.app.editorManager.editor.layout();
                }
            }
        }
        
        // 强制重排以确保布局稳定
        void this.bottomPanel.offsetHeight;
    }
    
    stopResizing() {
        if (!this.isResizing) return;
        
        console.log(`Stopping ${this.currentResizer} resize`);
        this.isResizing = false;
        
        // 移除resizing类
        if (this.currentResizer === 'sidebar') {
            this.sidebarResizer.classList.remove('resizing');
        } else if (this.currentResizer === 'bottom') {
            this.bottomResizer.classList.remove('resizing');
        }
        
        // 恢复光标
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        
        // 延迟调整编辑器容器高度，确保布局稳定
        if (this.currentResizer === 'bottom') {
            setTimeout(() => {
                this.adjustEditorContainerHeight();
            }, 100);
        }
        
        this.currentResizer = null;
    }
    
    resetWidth() {
        const defaultWidth = 300;
        this.sidebar.style.width = defaultWidth + 'px';
        this.saveWidth(defaultWidth);
    }
    
    resetHeight() {
        const defaultHeight = 200;
        this.bottomPanel.style.height = defaultHeight + 'px';
        this.saveHeight(defaultHeight);
        
        // 调整编辑器容器高度
        this.adjustEditorContainerHeight();
    }
    
    saveWidth(width) {
        try {
            localStorage.setItem('sidebar-width', width.toString());
        } catch (e) {
            console.warn('无法保存侧边栏宽度到本地存储:', e);
        }
    }
    
    saveHeight(height) {
        try {
            localStorage.setItem('bottom-panel-height', height.toString());
        } catch (e) {
            console.warn('无法保存底部面板高度到本地存储:', e);
        }
    }
    
    loadWidth() {
        try {
            const savedWidth = localStorage.getItem('sidebar-width');
            if (savedWidth) {
                const width = parseInt(savedWidth, 10);
                if (width >= 200 && width <= 600) {
                    this.sidebar.style.width = width + 'px';
                }
            }
        } catch (e) {
            console.warn('无法从本地存储加载侧边栏宽度:', e);
        }
    }
    
    loadHeight() {
        try {
            const savedHeight = localStorage.getItem('bottom-panel-height');
            console.log('Loading saved bottom panel height:', savedHeight);
            if (savedHeight) {
                const height = parseInt(savedHeight, 10);
                if (height >= 100 && height <= 600) {
                    this.bottomPanel.style.height = height + 'px';
                    console.log('Set bottom panel height to:', height + 'px');
                    
                    // 调整编辑器容器高度
                    this.adjustEditorContainerHeight();
                }
            } else {
                console.log('No saved height found, using default');
                // 使用默认高度时也需要调整编辑器容器
                this.adjustEditorContainerHeight();
            }
            
            // 调试：检查底面板的当前状态
            console.log('Bottom panel current height:', this.bottomPanel.style.height);
            console.log('Bottom panel computed height:', window.getComputedStyle(this.bottomPanel).height);
            console.log('Bottom panel display:', window.getComputedStyle(this.bottomPanel).display);
            console.log('Bottom panel visibility:', window.getComputedStyle(this.bottomPanel).visibility);
        } catch (e) {
            console.warn('无法从本地存储加载底部面板高度:', e);
        }
    }
}

// 导出供其他模块使用
window.Resizer = Resizer;