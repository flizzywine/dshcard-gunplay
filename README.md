# dshcard-gunplay · 现代战线

> **2026-11-03 · 纪念存档**
>
> 这一版留作做过一个射击游戏的纪念，开发暂告一段落。保存了烬区攻防、武器实验、AI、物理碰撞与验证代码，也保存了其中走过的弯路。
>
> 远程仓库保存代码、测试、来源说明及附带许可的 Unvanquished / Rapier 资源。本地转换的三张地图、雷达图和《三角洲行动》武器模型、贴图未提交，完整运行素材仍保存在 D 盘工作副本；因此本次源码存档不等同于可直接运行的完整游戏包。复现时需按下文说明准备本地资源。下方已发布人物卡下载链接属于此前的发布版本。

**一张导入 DSH Tavern 就能玩的枪战人物卡。** 内置完整 Three.js 游戏和随卡插件，在酒馆内点击「进入战场」即可开始 AI 对战。

[![下载 DSH 人物卡](https://img.shields.io/badge/下载人物卡-.dshcard-2ea44f?style=for-the-badge)](https://github.com/flizzywine/dshcard-gunplay/releases/latest/download/dshcard-gunplay.dshcard)

**[一键下载最新版人物卡](https://github.com/flizzywine/dshcard-gunplay/releases/latest/download/dshcard-gunplay.dshcard)** · [版本与更新记录](https://github.com/flizzywine/dshcard-gunplay/releases) · [DSH Tavern](https://github.com/flizzywine/dsh-tavern)

## 怎么玩

1. 下载上面的 `dshcard-gunplay.dshcard`。
2. 打开 DSH Tavern，在「人物卡库 → 导入人物卡」选择该文件，确认随卡插件已启用。
3. 刷新酒馆页面，用「现代战线 · 枪战试验场」人物卡开局。
4. 点击 **进入战场**，选择地图，开始比赛。

无需下载源码、安装 Three.js 或另开游戏服务器。游戏资源全部随卡打包，进入战场不会自动调用 LLM。已在桌面 Chrome 的 DSH Tavern 中验证可玩；需要键盘、鼠标及支持 WebGL2 的浏览器。

按 **Esc** 暂停并释放鼠标，再点击顶部 **返回酒馆**。关闭战场会结束当前比赛，灵敏度等设置保存在当前浏览器。

## 卡里有什么

- **三张地图**：烬区、Dust II 与 Karkand，默认烬区攻防。
- **烬区攻防推进**：玩家固定为进攻方，从 A 区出生，占领 A 后依次解锁 B1/B2、C1/C2；同区两个点都占领后才推进。AI 围绕当前前线行动，出生点随区域改变，守军在场时暂停占领。进攻方初始 100 增援，阵亡扣 1，每次推进补充 40 和 2 分钟；时间耗尽时正在占领则进入加时。占完 C 区获胜，超时失去进攻或增援耗尽且全员阵亡则防守方胜利。Dust II / Karkand 保留团队死斗，目前不支持真人联网对战。
- 按住 **M** 查看整张战术地图与地标。
- 本地开发版固定携带 **腾龙突击步枪、M870 霰弹枪、AWM 狙击步枪、AT4 火箭筒**，按 1–4 或滚轮切换。模型部件与基础颜色贴图来自本机三角洲资源，使用简化手臂、换弹、拉栓和泵动动画；AT4 直接替换 4 号位，无兵种限制，右键进入独立 2.4 倍瞄具，R 丢下旧筒并换上新筒。保留右键瞄准和 AWM 高倍镜；没有配装菜单、技能、投掷物和连杀奖励。NPC 使用腾龙基础步枪。新增素材尚未重新打包人物卡，来源与限制见 [武器说明](assets/delta-weapons/README.md)。
- 霰弹枪采用中心弹丸与均匀外圈的固定分布，开镜时收束；“随机散布 0”不会消除霰弹本身的扩散。火箭筒换弹保持在右下方，避免筒身与手臂遮住中央视野。
- 所有 NPC 均为基础步枪兵，不随机配装、不投手雷、不呼叫连杀支援，保留掩体换弹逻辑。
- 火箭筒保留飞行、碰撞和范围伤害；目前地图墙体和车辆代理是静态几何，尚不支持炸穿墙体、摧毁载具。
- 右键一键持续开镜，支持跑动中开镜射击、蹲伏、滑铲和趴下。
- 本地开发版的跳跃射击使用当帧镜头发射，修复高刷新率起跳被着地判定截断的问题；空中镜头跟随角色高度，散布渐变、落地小幅回弹，开镜时减少额外手部晃动。`npm run test:jump` 验证 30/60/120 FPS 下的实际玩家、射线及视图模型同步（需先启动本地 HTTP 服务）。
- 可调鼠标灵敏度、后坐力强度、子弹随机散布；设置自动保存。
- 命中、爆头、击杀反馈与个人加分，近距离擦弹触发压制反馈。
- AI 巡逻使用近期目击/声音记忆与队友报告，移除了按未知敌人实时坐标选点的逻辑；局部分离按胶囊尺寸与高度筛选邻居，避免上下楼互推，并处理完全重合。支持掩体评分与隐蔽换弹，小队战术仍待扩展。
- 背景环境循环音关闭、配音默认关闭，保留枪声与脚步等战斗音效。

当前版本完成了 **人物卡导入 → 内嵌战场 → 返回酒馆**。实时战况回传、LLM 指挥队友尚未实现。

## 操作

本地浏览器开发版新增 **Dust II · 经典灰盒**：在多人大厅选择该地图，可玩团队死斗；按住 **M** 查看通路与点位。基于 CS: Source 完整地图的原始建筑几何和高差，箱子、车辆、油桶采用方块近似，没有加载原作材质。地图来源、限制和离线重建方式见 [地图说明](assets/maps/DUST2-SOURCE.md)。新增版本尚未打包人物卡。

同样新增 **Karkand · 大战场灰盒**：以 Insurgency 社区完整 PvP 重制版为底稿，保留长街、建筑刷体、桥梁和地形尺度，模型掩体用方块近似。支持团队死斗和 M 战术地图，包含城区到工业区的多层导航。版本、近似范围与重建说明见 [Karkand 地图说明](assets/maps/KARKAND-SOURCE.md)。

本地开发版新增 **烬区 · 战场灰盒**：从本机《三角洲行动》资源整理约 800 × 500 米的主要战斗区域，保留原尺度地形、建筑、街道与静态掩体，并补入 A 点屋顶水塔、可摧毁房屋和 C1 厂房的完整初始几何。地图默认使用 A → B1/B2 → C1/C2 攻防，支持人物碰撞、子弹遮挡、前线出生与复活、AI 导航及 M 战术地图。建筑固定为初始状态，尚不支持导弹摧毁；低细节网格会简化部分门洞、楼梯和小型掩体。此版本尚未重新打包人物卡。

攻防规则检查：`node --test test/sector-control.test.mjs`；实际攻防对局检查：`npm run test:attack-defense`，覆盖初始 A 区出生、后续区域锁定、争夺、前线推进、胜利与 AI 移动。`npm run test:combat-feedback` 验证实际玩家开火与 AI 扣血，以及 AT4 瞄具和换筒结构。腾龙现按大战场距离调整为约 3–4 发胸部命中击倒 100 血目标，AWM 胸部仍可一枪击倒；HUD 单独显示实际伤害和敌人剩余生命。

烬区离线重建：`npm run build:cracked`，默认读取 `D:/Workspace/deltaforce-map-extract/exports/graybox/cracked-graybox.glb`；也可先运行 `node scripts/build-cracked.mjs /path/to/cracked-graybox.glb`，再运行 `node scripts/build-cracked-nav.mjs`。运行 `npm run test:cracked` 验证实际对局；相关碰撞、出生点、跨区通路和完整建筑几何检查包含在 `npm test` 中。

| 按键 | 功能 |
| --- | --- |
| WASD / Shift | 移动 / 冲刺 |
| 鼠标左键 / 右键 | 射击 / 切换并保持开镜 |
| C 或 Ctrl | 蹲伏；冲刺时滑铲 |
| Z / 空格 | 趴下或起身 / 起身或跳跃 |
| R | 换弹 |
| 1 / 2 / 3 / 4 | 腾龙 / M870 / AWM / AT4 |
| 滚轮 | 循环切换四把武器 |
| Tab / Esc | 记分板 / 暂停与设置 |
| 按住 M | 战术地图 |

鼠标灵敏度默认 **0.8**，后坐力默认是原版的 **30%**，随机散布默认 **0%**，均可在设置中调整。帧数偏低时可降低画面质量。

## 开发与打包

普通玩家直接下载人物卡即可。以下步骤用于修改源码和重新构建。

```bash
git clone https://github.com/flizzywine/dshcard-gunplay.git
cd dshcard-gunplay
python3 -m http.server 8089 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:8089/` 可独立调试游戏。

**Unvanquished 原始步枪动画预览**：打开 `http://127.0.0.1:8089/weapon-preview.html`。加载官方原模型、原配手臂、贴图及五段骨骼动画，默认循环换弹；支持 R 换弹、F 开火、空格暂停、慢放、逐帧拖动及模型旋转观察。此页独立于正式游戏。来源、署名、CC BY-SA 3.0 许可与下载清单见 [素材说明](assets/unvanquished-rifle/README.md)。`npm run test:weapon-preview` 验证加载与播放控件；`npm test` 包含 MD5 原始权重与 Three.js 蒙皮结果的逐顶点对照。重新获取素材：`npm run vendor:unvanquished`。

当前玩家及 AI 的移动碰撞、环境射线，以及手雷、闪光弹、烟雾弹、粘性炸弹、燃烧瓶由 **Rapier 3D 0.21.0** 驱动。角色使用胶囊体、自动上台阶和坡面检测；投掷物采用固定步长、连续碰撞检测及刚体反弹。子弹遮挡、AI 视线与爆炸遮挡共用物理世界的射线查询；移动胶囊不参与子弹命中，头部/身体/腿部判定和伤害规则单独保留。AI 的 A* 路线规划与火箭弹运动轨迹仍由游戏逻辑控制。

打开 `http://127.0.0.1:8089/physics-lab.html` 可进入独立物理试验场，验证坡面、台阶、低洞与薄墙。WASD 移动、空格跳跃、C 蹲伏、Z 趴下/起身、E 投球、R 重置；Shift 突进仅是试验场的高速碰撞验证动作。

Rapier 的 WebAssembly 内嵌在本地 `lib/rapier/rapier.mjs`，无需 CDN 或额外构建即可运行。依赖固定在 `package-lock.json`；更新依赖后用 `npm run vendor:rapier` 同步浏览器模块与 Apache-2.0 许可证。

构建人物卡需要本机 [DSH Tavern 源码](https://github.com/flizzywine/dsh-tavern)及其已安装的构建依赖，使用 Tavern 自带的卡包写入器与 esbuild：

```bash
DSH_TAVERN_SOURCE=/path/to/dsh-tavern \
  node scripts/build-dsh-card.mjs dist/dshcard-gunplay.dshcard
```

规则与物理基础测试：`npm test`。启动本地服务器后，使用 `npm run test:standalone` 检查地图/模式入口、旧参数拒绝、团队死斗计分、复活和结算；使用 `npm run test:dust2`、`npm run test:karkand` 检查两张地图的对战、地图切换和渲染。默认使用本机 Chrome，也可通过 `PLAYWRIGHT_CHANNEL` 指定浏览器渠道。截图保存在 `output/playwright/`。

`npm test` 还覆盖射线遮挡、命中部位、伤害、友军过滤与动态物件。Rapier 浏览器集成测试：`npm run test:physics`，验证玩家跳跃/趴下/起身、五类投掷物、AI 上台阶/碰墙/死亡重生/固定哨兵、两张地图和物理试验场。

固定武器集成测试：`npm run test:arsenal`，检查四个武器槽、数字键/滚轮、四种武器开火、NPC 装备、重生补弹、旧存档兼容和贴墙火箭碰撞。

手感回归测试：`npm run test:weapon-feel`，检查真实右键瞄准、零随机散布下的九颗霰弹、近远距离伤害、开镜收束，以及重型武器换弹过程的中央视野遮挡。数据与截图保存在 `output/playwright/`。

当前四武器集成测试：`npm run test:weapons`，验证腾龙、M870、AWM、AT4 的模型、开火、补弹、泵动和拉栓，并生成腰射、瞄准、换弹截图。`npm run test:launcher-ads` 检查 AT4 中央视野。`npm run build:weapons` 从 D 盘本地解析结果重建模型。旧 Unvanquished 独立预览和 [素材许可](assets/unvanquished-weapons/README.md) 仍保留，原动画正式对局测试仅适用于旧版本。

死亡复活回归：`npm run test:death-respawn`，通过真实玩家和对战更新流程，验证切换火箭筒、装填火箭筒时阵亡后仍继续计时，能够重新部署并恢复四把武器的弹药。

换弹动作测试：`npm run test:reload`，检查四种武器的手部联动、装弹与音效时序、开镜退出和切枪复位。设置 `RELOAD_VIDEO=1` 可额外录制非空仓与空仓换弹预览。

AI 弹量低于约 20% 时会根据最近感知的威胁寻找附近掩体，评分考虑头部/身体遮挡、站姿或蹲姿、移动距离、路线暴露和侧面探头空间，排除无法容纳角色、被占用或不可达的位置。到位且实际姿势受到遮挡后才开始换弹，完成后补弹；绕侧面导致暴露、眩晕或阵亡会取消换弹。无有效掩体、移动超时或固定哨兵采用原地换弹兜底。当前针对最近一个已知威胁判断，不是多方向火力的安全保证。

`npm test` 包含掩体评分与换弹状态测试；`npm run test:ai-cover` 通过真实 Bot 更新、Rapier 移动验证矮掩体换弹与中断，并检查 Dust II 和 Karkand 的流程。跳跃射击回归：`npm run test:jump`。

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
