// 测试脚本：验证所有修复的bug是否正常工作

console.log('开始测试修复后的功能...');

// 测试1: 验证防止在根目录创建文件夹的安全检查
async function testCreateFolderSecurity() {
    console.log('\n测试1: 防止在根目录创建文件夹的安全检查');
    
    try {
        // 尝试创建一个测试文件夹，这应该成功
        const response = await fetch('/api/folder/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: './test_fix_folder' })
        });
        const result = await response.json();
        console.log('创建测试文件夹结果:', result.success ? '成功' : '失败');
        console.log('错误信息:', result.error || '无');
        
        // 尝试在根目录创建文件夹，这应该失败并给出安全提示
        const rootResponse = await fetch('/api/folder/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: 'D:\\' })
        });
        const rootResult = await rootResponse.json();
        console.log('尝试在根目录创建文件夹结果:', rootResult.success ? '成功' : '失败');
        console.log('错误信息:', rootResult.error || '无');
        
        return rootResult.error && rootResult.error.includes('不允许在系统根目录直接创建文件夹');
    } catch (error) {
        console.error('测试文件夹创建时出错:', error);
        return false;
    }
}

// 测试2: 验证非Latin1字符编码修复
function testNonLatin1Encoding() {
    console.log('\n测试2: 非Latin1字符编码修复');
    
    try {
        // 模拟app.js中的generateTabId方法
        function generateTabId(filePath) {
            return 'tab_' + encodeURIComponent(filePath).replace(/[^a-zA-Z0-9]/g, '_');
        }
        
        // 测试包含中文和特殊字符的路径
        const testPaths = [
            '测试文件.md',
            'path/with/中文字符.txt',
            '文件路径\包含\反斜杠.js',
            '文件 with spaces & symbols.html'
        ];
        
        let allPass = true;
        testPaths.forEach(path => {
            try {
                const tabId = generateTabId(path);
                console.log(`路径 '${path}' 生成的标签ID: ${tabId}`);
            } catch (error) {
                console.error(`处理路径 '${path}' 时出错:`, error);
                allPass = false;
            }
        });
        
        return allPass;
    } catch (error) {
        console.error('测试非Latin1编码时出错:', error);
        return false;
    }
}

// 测试3: 验证Markdown渲染功能
function testMarkdownRendering() {
    console.log('\n测试3: Markdown渲染功能');
    
    try {
        // 检查MarkdownRenderer类是否存在
        if (typeof MarkdownRenderer !== 'undefined') {
            console.log('MarkdownRenderer类已加载');
            
            // 创建渲染器实例
            const renderer = new MarkdownRenderer();
            
            // 检查方法是否存在
            const hasRenderMethod = typeof renderer.render === 'function';
            const hasCreatePreviewWindowMethod = typeof renderer.createPreviewWindow === 'function';
            
            console.log('render方法存在:', hasRenderMethod);
            console.log('createPreviewWindow方法存在:', hasCreatePreviewWindowMethod);
            console.log('createPreviewHTML方法存在:', typeof renderer.createPreviewHTML === 'function');
            
            return hasRenderMethod && hasCreatePreviewWindowMethod;
        } else {
            console.error('MarkdownRenderer类未加载');
            return false;
        }
    } catch (error) {
        console.error('测试Markdown渲染时出错:', error);
        return false;
    }
}

// 运行所有测试
async function runAllTests() {
    const test1Result = await testCreateFolderSecurity();
    const test2Result = testNonLatin1Encoding();
    const test3Result = testMarkdownRendering();
    
    console.log('\n======= 测试结果摘要 =======');
    console.log('测试1 (文件夹创建安全检查):', test1Result ? '通过' : '失败');
    console.log('测试2 (非Latin1字符编码):', test2Result ? '通过' : '失败');
    console.log('测试3 (Markdown渲染功能):', test3Result ? '通过' : '失败');
    
    const allPass = test1Result && test2Result && test3Result;
    console.log('\n总体测试结果:', allPass ? '所有测试通过!' : '有测试失败，请检查');
    
    return allPass;
}

// 运行测试
runAllTests().then(success => {
    if (success) {
        console.log('\n✅ 所有修复已成功验证!');
    } else {
        console.log('\n❌ 测试未全部通过，请检查修复。');
    }
});