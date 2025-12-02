const { JSDOM } = require('jsdom');
const fs = require('fs');
const path = require('path');

// 创建DOM环境
const dom = new JSDOM(`<!DOCTYPE html><html><head></head><body></body></html>`, {
    url: 'http://localhost:8000',
    pretendToBeVisual: true,
    resources: 'usable'
});

// 将全局变量暴露给Node.js
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.fetch = require('node-fetch');

// 读取并执行markdown.js，确保MarkdownRenderer类可用
const markdownScript = fs.readFileSync(path.join(__dirname, 'js', 'markdown.js'), 'utf8');
try {
    eval(markdownScript);
    console.log('MarkdownRenderer类已加载');
} catch (error) {
    console.error('加载markdown.js时出错:', error);
}

// 读取并执行测试脚本
const testScript = fs.readFileSync(path.join(__dirname, 'test-fixes.js'), 'utf8');

try {
    // 执行测试脚本
    eval(testScript);
} catch (error) {
    console.error('执行测试脚本时出错:', error);
    process.exit(1);
}