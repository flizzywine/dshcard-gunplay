# dshcard-gunplay · 现代战线

**一张导入 DSH Tavern 就能玩的枪战人物卡。** 内置完整 Three.js 游戏和随卡插件，在酒馆内点击「进入战场」即可开始 AI 对战。

[![下载 DSH 人物卡](https://img.shields.io/badge/下载人物卡-.dshcard-2ea44f?style=for-the-badge)](https://github.com/flizzywine/dshcard-gunplay/releases/latest/download/dshcard-gunplay.dshcard)

**[一键下载最新版人物卡](https://github.com/flizzywine/dshcard-gunplay/releases/latest/download/dshcard-gunplay.dshcard)** · [版本与更新记录](https://github.com/flizzywine/dshcard-gunplay/releases) · [DSH Tavern](https://github.com/flizzywine/dsh-tavern)

## 怎么玩

1. 下载上面的 `dshcard-gunplay.dshcard`。
2. 打开 DSH Tavern，在「人物卡库 → 导入人物卡」选择该文件，确认随卡插件已启用。
3. 刷新酒馆页面，用「现代战线 · 枪战试验场」人物卡开局。
4. 点击 **进入战场**，选择地图、模式和配装，开始比赛。

无需下载源码、安装 Three.js 或另开游戏服务器。游戏资源全部随卡打包，进入战场不会自动调用 LLM。已在桌面 Chrome 的 DSH Tavern 中验证可玩；需要键盘、鼠标及支持 WebGL2 的浏览器。

按 **Esc** 暂停并释放鼠标，再点击顶部 **返回酒馆**。关闭战场会结束当前比赛，灵敏度、配装等设置保存在当前浏览器。

## 卡里有什么

- **五张地图**：烬区、沙丘镇、寒霜炼厂、霓虹街区、货柜场。
- **四种 AI 对战模式**：攻防推进、团队死斗、据点占领、自由混战；目前不支持真人联网对战。
- **烬区攻防**：默认选中，可选进攻方或防守方。按 A 岩下村 → B1 临时营地 / B2 贫民窟 → C1 军需仓库 / C2 办公区推进；同一区的两个点都控制后才开放下一区。进攻方 180 兵力，每次阵亡扣 1，突破区域增加 80；防守方可夺回当前区域的据点。时间耗尽时仍在攻点则加时。
- **烬区地形**：西侧高地、村落、营地沙墙与双哨塔、连通屋顶、仓库夹层和双层围墙、办公区三路入口；支持地形碰撞、弹道遮挡和 AI 寻路。按住 **M** 查看整张战术地图。
- **12 把武器**、枪匠配件、自定义配装、投掷物和连杀奖励。
- 右键一键持续开镜，支持跑动中开镜射击、蹲伏、滑铲和趴下。
- 可调鼠标灵敏度、后坐力强度、子弹随机散布；设置自动保存。
- 命中、爆头、击杀反馈与个人加分，近距离擦弹触发压制反馈。
- 背景环境循环音关闭、配音默认关闭，保留枪声与脚步等战斗音效。

当前版本完成了 **人物卡导入 → 内嵌战场 → 返回酒馆**。实时战况回传、LLM 指挥队友尚未实现。

## 操作

| 按键 | 功能 |
| --- | --- |
| WASD / Shift | 移动 / 冲刺 |
| 鼠标左键 / 右键 | 射击 / 切换并保持开镜 |
| C 或 Ctrl | 蹲伏；冲刺时滑铲 |
| Z / 空格 | 趴下或起身 / 起身或跳跃 |
| R | 换弹 |
| 1、2 或滚轮 | 切换武器 |
| V | 近战 |
| G / Q | 致命装备 / 战术装备 |
| F | 互动、拾取武器 |
| 3、4、5 | 使用连杀奖励 |
| Tab / Esc | 记分板 / 暂停与设置 |
| 按住 M | 烬区战术地图 |

后坐力默认是原版的 **60%**，随机散布默认 **65%**，均可在设置中降至 0。帧数偏低时可降低画面质量。

## 开发与打包

普通玩家直接下载人物卡即可。以下步骤用于修改源码和重新构建。

```bash
git clone https://github.com/flizzywine/dshcard-gunplay.git
cd dshcard-gunplay
python3 -m http.server 8089 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8089/` 可独立调试游戏。

构建人物卡需要本机 [DSH Tavern 源码](https://github.com/flizzywine/dsh-tavern)及其已安装的构建依赖，使用 Tavern 自带的卡包写入器与 esbuild：

```bash
DSH_TAVERN_SOURCE=/path/to/dsh-tavern \
  node scripts/build-dsh-card.mjs dist/dshcard-gunplay.dshcard
```

攻防规则测试：`npm test`。启动上述本地服务器后，使用 `npm run test:jinqu` 检查烬区的出生点、路线碰撞、屋顶楼梯、攻防阶段与旧地图回归；默认使用本机 Chrome，也可通过 `PLAYWRIGHT_CHANNEL` 指定浏览器渠道。截图保存在 `output/playwright/`。

| 路径 | 内容 |
| --- | --- |
| `dsh/card.json` | 人物卡设定与开场说明 |
| `dsh/plugin/` | 随卡插件与战场入口 |
| `scripts/build-dsh-card.mjs` | 将游戏及插件打成 `.dshcard` |
| `js/` | 游戏逻辑、地图、模型、音效与界面 |
| `lib/` | 本地 Three.js 及扩展模块 |
| `index.html`、`style.css` | 独立调试入口与样式 |

卡包使用 Character Card V3，DSH 卡包格式版本为 1。游戏通过 Tavern 公开的 `openOverlay` 接口嵌入，无需配置素材舞台。项目统一采用 `dshcard-` 命名前缀。

## 来源

游戏基于 [zty828/OPUS5.5-COD](https://github.com/zty828/OPUS5.5-COD)，保留其 Three.js 渲染、程序化素材与四张对战地图，在此基础上调整操作、射击反馈并制作 DSH 人物卡。人物卡封装与后续改造由 flizzywine 维护。早期体素试验版保留在 Git 历史中。

新增烬区按[三角洲行动官方公开攻略及俯视图](https://www.taptap.cn/moment/562314642454482868)重建主要区域关系、路线和据点特征，采用适配本游戏步兵速度的压缩比例与程序化模型、纹理。当前是可玩的布局重建，尚未达到原作的模型、尺寸与美术精度；未实现可驾驶载具和原作的建筑破坏系统。
