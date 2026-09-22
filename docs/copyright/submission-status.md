# 在线办理记录（2026-09-22）

## 尚未提交

- 中国版权登记业务平台：已打开“计算机软件著作权登记申请”入口，当前停在登录窗口。
- 抖音开放平台：账号已登录；当前进入个人主体认证页，尚需完成证件与运营人验证。尚未取得真实 AppID，未上传或提交游戏审核。
- CDN：代码仍使用占位资源地址，待提供实际存储/CDN账号或域名。
- 官方开发者工具：从官方文档的 Mac arm64 下载链接发起下载；下载管理页被浏览器工具安全策略拦截，尚未确认下载或安装完成。

## 已准备的材料

- `output/pdf/source-code.pdf`：当前小游戏源码的前后各30页，共60页，每页50个非空原始源代码行。长行仅在PDF排版时折行，未改写源代码。
- `output/pdf/manual.pdf`：3页软件说明书，每页34行。已核对卡组规模、卡牌上限、商店操作、难度和本地存储描述；未使用模拟界面截图。
- `output/pdf/copyright-evidence.json`：105个本项目源文件的SHA-256、源程序页码和行号映射、非空源码计数及PDF指纹。
- `scripts/prepare-copyright-pdf.py`：可重建上述文件；需要Python、reportlab、pypdf及支持中文的字体（当前使用macOS系统Arial Unicode）。

当前材料依据现有版本生成。著作权人身份、开发关系、权利范围、开发完成日期和首次发表情况还需申请人确认。项目已有公开网页版记录，不预填为“未发表”。

## 本轮核对发现的上线缺口

- 商店“看广告领金币”仍是本地测试奖励逻辑，尚未播放真实激励视频；正式广告接入和广告位配置未完成。
- 缺少真实AppID和可用远程资源地址，尚不能证明抖音端完整运行与真机适配。
- 构建成功、页面源码存在及引擎测试通过，不等于平台审核通过，也不证明所有Canvas页面的真机操作已验证。

## 官方入口

- [版权登记业务平台](https://register.ccopyright.com.cn/registration.html#/registerSoft)
- [抖音小游戏注册与入驻](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/guide/minigame/register)
- [抖音开发者工具下载](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/dev-tools/developer-instrument-update-and-download)
