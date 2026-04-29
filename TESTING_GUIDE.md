# 安装和测试指引 - v2.2.0

## 🎯 快速安装

### 方法1: 从 GitHub 下载 (推荐)

1. 访问项目主页：
   https://github.com/openjerry1995/ai_chat_history_exporter

2. 下载最新代码：
   - 点击绿色的 "Code" 按钮
   - 选择 "Download ZIP"
   - 解压到本地文件夹

### 方法2: Git 克隆
```bash
git clone https://github.com/openjerry1995/ai_chat_history_exporter.git
cd ai_chat_history_exporter
```

## 🚀 安装到 Chrome

### 开发者模式安装步骤：

1. 打开 Chrome 浏览器
2. 访问扩展管理页面：
   ```
   chrome://extensions/
   ```

3. 启用开发者模式：
   - 打开右上角的 "开发者模式" 开关

4. 加载扩展：
   - 点击左上角的 "加载已解压的扩展程序"
   - 选择你解压的项目文件夹
   - 确认文件夹包含：manifest.json, background.js, popup.html 等文件

5. 安装完成！
   - 你应该看到扩展图标出现在工具栏
   - 可能显示警告"扩展程序可能已损坏"，点击"保留"

## 🧪 测试新功能

### 1. 基础功能测试

**测试当前对话导出：**
1. 打开一个 AI 网站 (ChatGPT/Claude/Grok/Gemini)
2. 点击扩展图标
3. 选择 "Export Current Chat"
4. 检查是否正常下载 Markdown 文件

### 2. 新功能测试 - 延迟配置

**测试延迟配置界面：**
1. 点击扩展图标
2. 你应该看到新的 "Export Delay (prevent blocking)" 部分
3. 切换不同的延迟模式：
   - Conservative (3-6s)
   - Normal (2-4s) - 默认选中
   - Aggressive (1-3s)
   - Custom - 自定义模式

**测试自定义延迟：**
1. 选择 "Custom" 模式
2. 在输入框中输入数字 (1-30)
3. 测试边界值：0, 1, 15, 30, 31

### 3. 导出所有历史测试

**小规模测试 (推荐)：**
1. 打开 AI 网站并确保侧边栏有对话列表
2. 选择 "Conservative" 模式
3. 点击 "Export All History"
4. 观察控制台日志 (F12)
5. 查找随机延迟日志：
   ```
   [BG] Random delay: 3245ms (2000-4000ms range)
   ```

**性能验证：**
- 检查每次对话之间的延迟是否在配置范围内
- 确认最后一批数据正常下载
- 验证 Markdown 格式正确

### 4. 性能对比测试

**对比固定延迟 vs 随机延迟：**
```
旧版本 (v2.1.1): 每个 1.5秒 → 10个对话 = 15秒
新版本 v2.2.0:
  - Conservative: 平均 4.5秒 → 10个对话 = 45秒
  - Normal: 平均 3秒 → 10个对话 = 30秒
  - Aggressive: 平均 2秒 → 10个对话 = 20秒
```

### 5. 边界测试

**测试取消功能：**
1. 开始 "Export All History"
2. 等待几个对话后点击 "Stop Export"
3. 确认是否立即停止

**测试错误处理：**
1. 在导出过程中断开网络
2. 观察错误提示是否友好
3. 重新连接网络

**测试跨平台：**
- ChatGPT: https://chatgpt.com
- Claude: https://claude.ai
- Grok: https://grok.com
- Gemini: https://gemini.google.com

## 📊 测试检查清单

- [ ] 扩展成功安装到 Chrome
- [ ] 图标正常显示在工具栏
- [ ] 延迟配置界面显示正常
- [ ] 4种延迟模式可以切换
- [ ] 自定义模式输入正常工作
- [ ] 当前对话导出功能正常
- [ ] 所有历史导出功能正常
- [ ] 随机延迟在配置范围内
- [ ] Console 日志显示延迟信息
- [ ] 取消功能正常工作
- [ ] Markdown 文件格式正确
- [ ] 不会触发网站封禁警告
- [ ] 4个平台都支持

## 🐛 常见问题

### 安装问题

**"扩展程序可能已损坏"警告：**
- 这是正常现象，点击"保留"即可
- 因为我们使用开发者模式安装，不是从 Chrome Web Store 下载

**扩展图标不显示：**
- 确认安装了正确的文件夹
- 刷新 chrome://extensions/ 页面
- 重新加载扩展

### 功能测试问题

**导出没有反应：**
- 检查 Console 日志 (F12)
- 确认当前页面是支持的 AI 网站
- 刷新页面重试

**延迟模式无法切换：**
- 检查 popup.js 文件是否正确加载
- 打开扩展时检查 Console 是否有错误

**随机延迟不准确：**
- 查看日志中的延迟范围
- 确认延迟模式选择正确
- 检查网络连接是否稳定

## 📝 反馈测试结果

如果发现任何问题，请提供：
1. 使用的浏览器版本
2. 具体的操作步骤
3. Console 中的错误日志
4. 预期行为 vs 实际行为
5. 截图或录屏 (如果可能)

在 GitHub 上创建 Issue：
https://github.com/openjerry1995/ai_chat_history_exporter/issues/new

## 🎯 成功标准

测试成功的标志：
- ✅ 所有4个平台都能正常导出
- ✅ 延迟配置界面工作正常
- ✅ 随机延迟在配置范围内变化
- ✅ 不会触发网站的反爬虫机制
- ✅ 用户体验没有显著下降
- ✅ Markdown 文件格式正确完整

祝测试顺利！如有任何问题，随时反馈。