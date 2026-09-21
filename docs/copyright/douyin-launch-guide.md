# 抖音小游戏上线指南

## 一、前期准备

### 1.1 注册抖音开发者账号
1. 访问 [抖音开放平台](https://developer.open-douyin.com/)
2. 使用抖音号登录，完成开发者注册
3. 选择"小游戏"类型
4. 完成个人/企业实名认证（需要身份证或营业执照）

### 1.2 软件著作权
- 抖音小游戏上架**必须**提供软件著作权登记证书
- 按 `application-draft.md` 准备材料，在 register.ccopyright.com.cn 提交申请
- 审查周期约30-60个工作日，建议尽早申请
- 拿到证书后在抖音开发者平台填写证书编号

### 1.3 ICP备案（如适用）
- 如果游戏有联网功能且服务器在中国大陆，需要ICP备案
- 如果美术资源CDN使用国内服务，CDN域名也需备案
- 个人开发者可使用已备案的云服务（如阿里云OSS/腾讯云COS）

## 二、创建小游戏

### 2.1 创建应用
1. 在抖音开发者平台点击"创建小游戏"
2. 填写应用名称：像素前线（或你想要的名称）
3. 获取 **AppID**（形如 `ttxxxxxxxxxxxxxxxx`）
4. 记录 AppID，后续需要替换到项目配置中

### 2.2 替换项目配置
打开 `minigame/project.config.json`，将 `appid` 字段从 `touristappid` 替换为你的真实 AppID：

```json
{
  "appid": "tt你的真实AppID"
}
```

### 2.3 配置CDN（美术资源）
美术资源约29.5MB（WebP格式），超过主包4MB限制，需通过CDN加载：

1. 将 `minigame-cdn/` 目录上传到你的CDN/云存储
2. 确保CDN支持HTTPS和跨域访问（CORS）
3. 打开 `minigame/src/main.ts`，修改 `ART_CDN_BASE`：

```typescript
const ART_CDN_BASE = 'https://你的CDN域名/pixel-frontline/';
```

4. CDN目录结构需保持：
   ```
   https://你的CDN域名/pixel-frontline/art/battlefield-v3.webp
   https://你的CDN域名/pixel-frontline/art/tanks-v12.webp
   ...
   ```

### 2.4 隐私协议
1. 在抖音开发者平台填写隐私政策链接
2. 游戏需要声明的权限：
   - 存储权限（保存游戏进度）
   - 网络权限（加载美术资源）
   - 音频权限（播放音效）
3. 可使用抖音提供的隐私协议模板

## 三、上传与审核

### 3.1 安装开发者工具
1. 下载 [抖音开发者工具](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/developer-instrument/developer-instrument-update-and-download)
2. 用开发者账号登录

### 3.2 导入项目
1. 打开开发者工具，选择"导入项目"
2. 项目目录选择 `minigame/` 文件夹
3. 确认 AppID 已正确填写
4. 等待编译完成

### 3.3 真机测试
1. 使用"预览"功能，在手机抖音上扫码测试
2. 重点测试：
   - 横屏大厅/商店/组卡界面
   - 横屏战斗界面
   - 美术资源是否从CDN正确加载
   - 音频播放
   - 触摸操作响应
   - 暂停/恢复

### 3.4 提交审核
1. 在开发者工具中点击"上传"
2. 填写版本号（如 1.0.0）和更新说明
3. 在抖音开发者平台提交审核
4. 审核通常需要1-7个工作日
5. 审核通过后游戏上线

## 四、类目与资质

| 类目 | 要求 |
|------|------|
| 游戏-策略类 | 软著证书 |
| 游戏-卡牌类 | 软著证书 |

如游戏包含付费功能，还需：
- 增值电信业务经营许可证（企业）
- 网络文化经营许可证

## 五、注意事项

1. **主包大小**：当前主包约2.2MB（game.js + 字体 + 短音效），不超过4MB限制
2. **CDN缓存**：建议CDN设置长期缓存（Cache-Control: max-age=31536000），减少重复下载
3. **加载体验**：首次进入战斗时需下载约29.5MB美术资源，建议在WiFi环境下体验
4. **横屏适配**：游戏全局锁定横屏（game.json 中 deviceOrientation: landscape），所有界面均为横屏
5. **性能**：低端手机上可能需要降低同屏单位数量，后续版本可加入画质选项
