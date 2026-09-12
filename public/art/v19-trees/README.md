# V19 粗像素树木

两类树木参考各自 V17 图册，通过内建 `image_gen` 执行风格编辑；保留完整、受损、8 帧倒伏、倒地、秃枝倒地，共 24 帧。未用程序绘制树形、旋转完整树或压扁树木来替代动作。

## 资产

- `pine-original.png`：生图原始输出，1832×858。
- `broadleaf-original.png`：生图原始输出，1832×859。
- `generation-manifest.json`：两次完整提示词、内建工具模式、V17 编辑目标路径与生成原图路径。
- `pine-alpha.png`、`broadleaf-alpha.png`：透明提取后的源图。工具输出了灰白棋盘背景，技术处理仅移除该背景，保留树木色彩；原始输出完整留存。
- `pine-logical.png`、`broadleaf-logical.png`：512×240，4×3 格，每格 128×80 逻辑像素。
- `pine.png`、`broadleaf.png`：运行图册，1024×480，4×3 格，每格 256×160；逻辑像素按最近邻严格扩大 2 倍。
- `atlas-manifest.json`：逐帧源图内容边界、树根、统一等比缩放、逻辑放置位置与根点校准记录。

## 接入约定

`game/tree-art-v17.ts` 的加载路径指向本目录。已有 API、256×160 帧尺寸、[70,150] 树根锚点与 1.12 秒倒伏时长不变。完整树高 140 世界像素。所有状态统一 2×2 世界像素颗粒。倒伏帧继承原图的物理姿态，源图按类型统一等比缩放，保持大轮廓与落地范围。松树倒伏第 7 帧与阔叶树倒伏第 6 帧在量化后根点偏高 2 世界像素，已只向下校准放置 1 逻辑像素。

`TREE_PROFILES_V17`、`tree-state-v17.ts`、`render.ts`、`render-depth.ts` 未修改。

## 验证

`output/v19-tree-qa/` 保存技术打包脚本、真实浏览器 QA 与截图：

- `pack-trees.mjs`：透明背景提取、逐帧裁切与最近邻打包，无树形生成。
- `qa.js`、`qa.mjs`、`qa.json`：真实 localhost:3001 模块加载，30/30 检查通过，浏览器错误 0。
- 24 帧检查：所有 2×2 像素块颜色和 alpha 完全一致；树根贴地；主体未碰图格边缘或遭裁断。
- 6 组实际 `createGame/startGame/spawnUnit/tick/loadArt/render` 场景：真实渲染命中两种树的全部 12 状态。
- `contact.png`：24 帧实际世界尺寸联系图。
- `pine-zoom.png`、`broadleaf-zoom.png`：2 倍查看完整与受损状态。
- `pine-{0,1,2}.png`、`broadleaf-{0,1,2}.png`：真实战场全部状态。
- `natural.png`：未改原始地形和房屋树木位置的 1440×480 战场，含士兵、房屋、树木与视野灰度。

对联系图、放大图和真实战场进行了视觉检查。单文件严格 TypeScript 与 oxlint 检查通过。未提交、未部署。
