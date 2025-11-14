// 图片预览管理器
class ImagePreviewManager {
    constructor(app) {
        this.app = app;
        this.currentImage = null;
        this.currentZoom = 1;
        this.currentRotation = 0;
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.imagePosition = { x: 0, y: 0 };
        this.originalPosition = { x: 0, y: 0 };
        this.isMaxZoom = false;
        
        this.initializeElements();
        this.bindEvents();
    }

    // 初始化DOM元素（弹窗模式）
    initializeElements() {
        // 获取弹窗DOM元素
        this.previewModal = document.getElementById('image-preview-modal');
        this.modalTitle = document.getElementById('image-preview-modal-title');
        this.modalCloseBtn = document.getElementById('image-preview-modal-close');
        this.modalBody = document.querySelector('.image-preview-modal-body');
        this.modalImg = document.getElementById('image-preview-modal-img');
        this.modalLoading = document.getElementById('image-preview-modal-loading');
        this.modalError = document.getElementById('image-preview-modal-error');
        this.modalErrorMessage = document.getElementById('image-preview-modal-error-message');
        this.modalDimensions = document.getElementById('image-preview-modal-dimensions');
        this.modalSize = document.getElementById('image-preview-modal-size');
        this.modalScale = document.getElementById('image-preview-modal-scale');
        
        // 控制按钮
        this.modalZoomOutBtn = document.getElementById('image-preview-modal-zoom-out');
        this.modalZoomInBtn = document.getElementById('image-preview-modal-zoom-in');
        this.modalResetBtn = document.getElementById('image-preview-modal-reset');
        this.modalRotateBtn = document.getElementById('image-preview-modal-rotate');
        this.modalPrevBtn = document.getElementById('image-preview-modal-prev');
        this.modalNextBtn = document.getElementById('image-preview-modal-next');
        
        // 导航按钮
        this.modalNavPrevBtn = document.getElementById('image-preview-modal-nav-prev');
        this.modalNavNextBtn = document.getElementById('image-preview-modal-nav-next');
        
        this.modalContent = document.querySelector('.image-preview-modal-content');
    }

    // 绑定事件
    bindEvents() {
        // 弹窗控制
        this.modalCloseBtn?.addEventListener('click', () => this.hideImagePreview());
        this.previewModal?.addEventListener('click', (e) => {
            if (e.target === this.previewModal) {
                this.hideImagePreview();
            }
        });
        
        // 缩放控制
        this.modalZoomInBtn?.addEventListener('click', () => this.zoomIn());
        this.modalZoomOutBtn?.addEventListener('click', () => this.zoomOut());
        this.modalResetBtn?.addEventListener('click', () => this.resetView());
        
        // 旋转控制
        this.modalRotateBtn?.addEventListener('click', () => this.rotateRight());
        
        // 导航控制
        this.modalPrevBtn?.addEventListener('click', () => this.navigatePrev());
        this.modalNextBtn?.addEventListener('click', () => this.navigateNext());
        this.modalNavPrevBtn?.addEventListener('click', () => this.navigatePrev());
        this.modalNavNextBtn?.addEventListener('click', () => this.navigateNext());

        // 图片拖拽
        if (this.modalImg) {
            this.modalImg.addEventListener('mousedown', (e) => this.startDrag(e));
            this.modalImg.addEventListener('load', () => this.onImageLoad());
            this.modalImg.addEventListener('error', () => this.onImageError());
        }
        document.addEventListener('mousemove', (e) => this.drag(e));
        document.addEventListener('mouseup', () => this.endDrag());

        // 鼠标滚轮缩放
        if (this.modalContent) {
            this.modalContent.addEventListener('wheel', (e) => this.handleWheel(e));
        }

        // 键盘快捷键
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // 窗口大小变化
        window.addEventListener('resize', () => this.adjustToWindowSize());
    }

    // 显示图片预览
    async showImagePreview(filePath, imageUrl = null) {
        try {
            // 检查必要的DOM元素是否存在
            if (!this.previewModal || !this.modalImg) {
                console.error('Image preview elements not found in DOM');
                throw new Error('图片预览元素未找到，请确保HTML结构正确');
            }
            
            this.showLoading();
            this.currentImage = filePath;
            
            // 获取图片URL
            const imageSrc = imageUrl || await this.getImageUrl(filePath);
            
            // 设置图片源
            this.modalImg.src = imageSrc;
            
            // 显示弹窗
            this.previewModal.classList.add('active');
            
            // 设置标题
            if (this.modalTitle) {
                this.modalTitle.textContent = filePath.split('/').pop() || '图片预览';
            }
            
        } catch (error) {
            this.showError(`无法加载图片: ${error.message}`);
        }
    }

    // 隐藏图片预览
    hideImagePreview() {
        if (!this.previewModal) return;
        
        this.currentImage = null;
        this.resetView();
        
        // 隐藏弹窗
        this.previewModal.classList.remove('active');
        
        // 恢复编辑器显示
        const editorContainer = document.getElementById('editor-container');
        if (editorContainer) {
            editorContainer.style.display = 'block';
        }
    }

    // 获取图片URL
    async getImageUrl(filePath) {
        // 如果已经是URL，直接返回
        if (typeof filePath === 'string' && (filePath.startsWith('data:') || filePath.startsWith('http'))) {
            return filePath;
        }
        
        // 对于本地文件，直接返回文件路径
        return filePath;
    }

    // 显示加载状态
    showLoading() {
        if (this.modalLoading) {
            this.modalLoading.style.display = 'flex';
            if (this.modalError) this.modalError.style.display = 'none';
            if (this.modalContent) this.modalContent.style.display = 'none';
        }
    }

    // 显示错误状态
    showError(message) {
        if (this.modalLoading) this.modalLoading.style.display = 'none';
        if (this.modalError) {
            this.modalError.style.display = 'flex';
            if (this.modalErrorMessage) {
                this.modalErrorMessage.textContent = message;
            }
        }
        if (this.modalContent) this.modalContent.style.display = 'none';
    }

    // 显示图片内容
    showContent() {
        if (this.modalLoading) this.modalLoading.style.display = 'none';
        if (this.modalError) this.modalError.style.display = 'none';
        if (this.modalContent) this.modalContent.style.display = 'flex';
    }

    // 图片加载成功
    onImageLoad() {
        this.showContent();
        this.updateImageInfo();
        this.resetView();
        
        // 清理之前的对象URL
        if (this.modalImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.modalImg.src);
        }
    }

    // 图片加载失败
    onImageError() {
        this.showError('图片加载失败，请检查文件是否损坏或路径是否正确');
    }

    // 更新图片信息
    updateImageInfo() {
        if (!this.modalImg.naturalWidth) return;
        
        const fileName = this.currentImage.split('/').pop() || '未知文件';
        const dimensions = `${this.modalImg.naturalWidth} × ${this.modalImg.naturalHeight}`;
        const size = this.formatFileSize(this.modalImg.src);
        
        if (this.modalDimensions) {
            this.modalDimensions.textContent = `尺寸: ${dimensions}`;
        }
        if (this.modalSize) {
            this.modalSize.textContent = `大小: ${size}`;
        }
    }

    // 格式化文件大小
    formatFileSize(url) {
        // 如果是blob URL，无法获取准确大小，返回估算值
        if (url.startsWith('blob:')) {
            return '未知大小';
        }
        
        // 对于其他情况，返回占位符
        return '未知大小';
    }

    // 缩放功能
    zoomIn() {
        this.currentZoom = Math.min(this.currentZoom * 1.2, 5);
        this.updateTransform();
    }

    zoomOut() {
        this.currentZoom = Math.max(this.currentZoom / 1.2, 0.1);
        this.updateTransform();
    }

    resetView() {
        this.currentZoom = 1;
        this.currentRotation = 0;
        this.imagePosition = { x: 0, y: 0 };
        this.isMaxZoom = false;
        this.updateTransform();
    }

    // 向左旋转
    rotateLeft() {
        this.currentRotation = (this.currentRotation - 90) % 360;
        this.updateTransform();
    }

    // 向右旋转
    rotateRight() {
        this.currentRotation = (this.currentRotation + 90) % 360;
        this.updateTransform();
    }

    fitToWidth() {
        const containerWidth = this.modalContent.clientWidth;
        const imageWidth = this.modalImg.naturalWidth;
        
        if (imageWidth > 0) {
            this.currentZoom = containerWidth / imageWidth;
            this.imagePosition = { x: 0, y: 0 };
            this.updateTransform();
        }
    }

    fitToHeight() {
        const containerHeight = this.modalContent.clientHeight;
        const imageHeight = this.modalImg.naturalHeight;
        
        if (imageHeight > 0) {
            this.currentZoom = containerHeight / imageHeight;
            this.imagePosition = { x: 0, y: 0 };
            this.updateTransform();
        }
    }

    // 拖拽功能
    startDrag(e) {
        if (this.currentZoom <= 1 || !this.modalImg) return;
        
        this.isDragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.originalPosition = { ...this.imagePosition };
        this.modalImg.style.cursor = 'grabbing';
        e.preventDefault();
    }

    drag(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.dragStart.x;
        const deltaY = e.clientY - this.dragStart.y;
        
        this.imagePosition = {
            x: this.originalPosition.x + deltaX,
            y: this.originalPosition.y + deltaY
        };
        
        this.updateTransform();
    }

    endDrag() {
        this.isDragging = false;
        if (this.modalImg) {
            this.modalImg.style.cursor = this.currentZoom > 1 ? 'grab' : 'default';
        }
    }

    // 鼠标滚轮缩放
    handleWheel(e) {
        e.preventDefault();
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.currentZoom * delta));
        
        if (newZoom !== this.currentZoom) {
            this.currentZoom = newZoom;
            this.updateTransform();
        }
    }

    // 键盘快捷键
    handleKeyboard(e) {
        if (!this.previewModal.classList.contains('active')) return;
        
        switch (e.key) {
            case 'Escape':
                this.hideImagePreview();
                break;
            case '+':
            case '=':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomIn();
                }
                break;
            case '_':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.zoomOut();
                }
                break;
            case '0':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    this.resetView();
                }
                break;
            case 'ArrowLeft':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.navigatePrev();
                }
                break;
            case 'ArrowRight':
                if (e.ctrlKey) {
                    e.preventDefault();
                    this.navigateNext();
                }
                break;
            case 'r':
            case 'R':
                e.preventDefault();
                this.rotateRight();
                break;
        }
    }

    // 更新变换
    updateTransform() {
        if (!this.modalImg) return;
        
        const transform = `translate(${this.imagePosition.x}px, ${this.imagePosition.y}px) scale(${this.currentZoom}) rotate(${this.currentRotation}deg)`;
        this.modalImg.style.transform = transform;
        
        // 更新拖拽光标
        if (this.currentZoom > 1) {
            this.modalImg.style.cursor = this.isDragging ? 'grabbing' : 'grab';
        } else {
            this.modalImg.style.cursor = 'default';
        }
        
        // 更新按钮状态
        this.updateButtonStates();
    }

    // 更新按钮状态
    updateButtonStates() {
        if (this.modalZoomInBtn) this.modalZoomInBtn.disabled = this.currentZoom >= 5;
        if (this.modalZoomOutBtn) this.modalZoomOutBtn.disabled = this.currentZoom <= 0.1;
        if (this.modalResetBtn) this.modalResetBtn.disabled = this.currentZoom === 1 && this.currentRotation === 0;
        this.updateScaleDisplay();
    }

    // 更新缩放显示
    updateScaleDisplay() {
        if (this.modalScale) {
            this.modalScale.textContent = `${Math.round(this.currentZoom * 100)}%`;
        }
    }

    // 导航到上一张图片
    navigatePrev() {
        if (!this.currentImage) return;
        
        const currentDir = this.currentImage.substring(0, this.currentImage.lastIndexOf('/'));
        const imageFiles = this.getImageFilesInDirectory(currentDir);
        const currentIndex = imageFiles.indexOf(this.currentImage);
        
        if (currentIndex > 0) {
            this.showImagePreview(imageFiles[currentIndex - 1]);
        }
    }

    // 导航到下一张图片
    navigateNext() {
        if (!this.currentImage) return;
        
        const currentDir = this.currentImage.substring(0, this.currentImage.lastIndexOf('/'));
        const imageFiles = this.getImageFilesInDirectory(currentDir);
        const currentIndex = imageFiles.indexOf(this.currentImage);
        
        if (currentIndex < imageFiles.length - 1) {
            this.showImagePreview(imageFiles[currentIndex + 1]);
        }
    }

    // 获取目录中的图片文件
    getImageFilesInDirectory(directory) {
        if (!this.app.fileManager || !this.app.fileManager.fileTree) return [];
        
        const imageFiles = [];
        const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'bmp', 'webp', 'ico', 'tiff', 'tif'];
        
        for (const [path, info] of this.app.fileManager.fileTree) {
            if (path.startsWith(directory + '/') && info.kind === 'file') {
                const extension = path.split('.').pop().toLowerCase();
                if (imageExtensions.includes(extension)) {
                    imageFiles.push(path);
                }
            }
        }
        
        return imageFiles.sort();
    }

    // 销毁管理器
    destroy() {
        // 清理事件监听器
        document.removeEventListener('mousemove', this.drag);
        document.removeEventListener('mouseup', this.endDrag);
        document.removeEventListener('keydown', this.handleKeyboard);
        
        // 清理对象URL
        if (this.modalImg && this.modalImg.src && this.modalImg.src.startsWith('blob:')) {
            URL.revokeObjectURL(this.modalImg.src);
        }
    }
}

// 导出到全局作用域
window.ImagePreviewManager = ImagePreviewManager;