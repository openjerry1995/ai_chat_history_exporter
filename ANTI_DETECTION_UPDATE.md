# Anti-Detection Update v2.2.0

## 问题
之前的导出功能在每个对话之间只有一个固定的 1500ms 延迟，这导致：
- 下载速度过快，像机器人行为
- 被网站检测为异常操作，导致 IP 封禁
- 影响用户正常使用

## 解决方案
实现了智能随机延迟系统，模拟人类浏览行为：

### 1. 可配置的延迟模式
用户可以根据需要选择不同的延迟策略：

- **Conservative (保守模式)**: 3-6秒延迟
  - 最安全，适合大量历史导出
  - 几乎不会被封禁
  - 导出速度较慢

- **Normal (正常模式)**: 2-4秒延迟 (默认)
  - 平衡安全性和速度
  - 推荐用于一般使用
  - 适合中等规模导出

- **Aggressive (激进模式)**: 1-3秒延迟
  - 速度最快
  - 可能触发反爬虫机制
  - 仅用于小规模导出

- **Custom (自定义模式)**: 用户自定义延迟
  - 范围: 1-30秒
  - 适应特殊需求

### 2. 智能随机延迟
- 每个对话之间的延迟在一定范围内随机
- 避免固定时间间隔的机器人特征
- 模拟真实人类浏览行为的不确定性

### 3. 多层延迟策略
实现了两层延迟：

**第一层延迟 (主延迟)**: 导航到新对话后
- 随机等待配置的时间范围
- 给页面加载和渲染充足时间
- 避免快速切换URL的异常行为

**第二层延迟 (辅助延迟)**: 提取完成后
- 主延迟的一半时间
- 在不同对话之间模拟思考时间
- 更接近真实浏览行为

### 4. 用户界面改进
- 新增延迟配置下拉菜单
- 实时显示选中的延迟模式
- 自定义模式支持数字输入
- 保持原有简洁设计风格

## 技术实现

### background.js 修改
```javascript
// 新增辅助函数
function randomSleep(minMs, maxMs) {
  const randomMs = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  console.log(`[BG] Random delay: ${randomMs}ms (${minMs}-${maxMs}ms range)`);
  return sleep(randomMs);
}

function getDelayTime(delayConfig) {
  if (!delayConfig) {
    return { minMs: 2000, maxMs: 4000 }; // Default: 2-4 seconds
  }
  const { minDelay, maxDelay } = delayConfig;
  return {
    minMs: minDelay * 1000,
    maxMs: maxDelay * 1000
  };
}
```

### popup.js 修改
```javascript
// 获取延迟配置
function getDelayConfig() {
  var mode = document.getElementById('delay-mode').value;
  var minDelay = 2;
  var maxDelay = 4;

  switch(mode) {
    case 'conservative':
      minDelay = 3; maxDelay = 6; break;
    case 'normal':
      minDelay = 2; maxDelay = 4; break;
    case 'aggressive':
      minDelay = 1; maxDelay = 3; break;
    case 'custom':
      var customDelay = parseInt(document.getElementById('custom-delay').value) || 2;
      minDelay = Math.max(1, customDelay - 1);
      maxDelay = Math.min(30, customDelay + 1);
      break;
  }
  return { minDelay, maxDelay, mode };
}
```

## 性能对比

### 之前 (固定 1.5秒)
- 导出 50 个对话: ~75秒
- 被封禁风险: 高
- 行为特征: 明显机器人

### 之后 (Normal 模式 2-4秒)
- 导出 50 个对话: ~150-300秒
- 被封禁风险: 极低
- 行为特征: 接近人类

### Conservative 模式 (3-6秒)
- 导出 50 个对话: ~225-450秒
- 被封禁风险: 几乎为零
- 最安全的导出方式

## 测试建议

### 测试步骤
1. 加载更新后的扩展
2. 选择 Conservative 模式
3. 导出少量对话 (5-10个)
4. 观察是否有封禁警告
5. 逐步增加导出数量
6. 根据实际情况调整延迟模式

### 最佳实践
- 大量历史导出: 使用 Conservative 模式
- 日常备份: 使用 Normal 模式
- 小规模测试: 可以尝试 Aggressive 模式
- 遇到封禁: 立即停止，等待后使用 Conservative

## 未来优化方向

1. **智能检测**: 自动检测网站的反爬虫强度，动态调整延迟
2. **暂停恢复**: 支持中途暂停和恢复导出
3. **失败重试**: 封禁后自动等待并重试
4. **速度监控**: 实时显示当前导出速度
5. **历史记录**: 记录每次导出的参数和结果

## 注意事项
- 延迟时间越长，被检测的风险越低，但导出时间也越长
- 不要使用 Aggressive 模式导出大量对话
- 如果遇到封禁，建议使用 Conservative 模式并增加延迟
- 不同平台的反爬虫策略可能不同，建议从 Conservative 开始测试

## 版本信息
- 版本: 2.2.0
- 发布日期: 2025-04-29
- 向后兼容: 是 (旧版本用户可无缝升级)
