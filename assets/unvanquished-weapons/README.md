# Unvanquished 正式游戏武器资源

官方来源：[Unvanquished 武器资源仓库](https://github.com/UnvanquishedAssets/res-weapons_src.dpkdir)、[玩家/手臂资源仓库](https://github.com/UnvanquishedAssets/res-players_src.dpkdir)。本目录文件保留原字节；具体上游提交、文件 URL、长度与 SHA-256 见 `manifest.json`。重新获取：`node scripts/vendor-unvanquished-weapons.mjs`。

四槽映射：

| 槽 | 原始模型 | 用途 |
| --- | --- | --- |
| 1 | rifle（资源在相邻 `unvanquished-rifle` 目录） | 中距离步枪 |
| 2 | shotgun | 近距离霰弹枪 |
| 3 | mdriver / Mass Driver | 远距离精确步枪，使用游戏高倍瞄准 |
| 4 | lcannon / Lucifer Cannon | 重型爆炸武器，沿用本项目已有飞行弹体与爆炸规则 |

它们是 Unvanquished 的科幻武器，不将其冒充为 M4、L115 或 RPG。仅玩家第一人称使用这些模型；NPC 保持基础步枪兵。播放原始 idle、fire、reload、raise 片段，切枪直接举起所选武器；不添加额外武器操作系统。各槽原有伤害、射速和弹药容量保留。换弹时长采用原片段，完成后补弹；霰弹枪采用一次动作补满可用弹药，切枪可取消。

## 署名与许可

- 步枪署名与独立 CC BY-SA 3.0 许可见 [步枪说明](../unvanquished-rifle/README.md)及其中的 `license.txt`。
- Mass Driver：官方媒体表署名 Stannum，CC BY-SA 3.0。
- Lucifer Cannon：官方媒体表的概念、模型、纹理和动画均署名 Stannum，CC BY-SA 3.0。
- 手臂/手套纹理：Angelo、Stannum、RXMT 及 Unvanquished contributors；按官方媒体表保留对应 CC BY-SA 3.0 署名。
- 霰弹枪：Unvanquished contributors；所取目录没有附单独许可文本，按上游公布的默认贡献许可 CC BY-SA 4.0 处理并保留来源。官方媒体表说明其逐项清单尚不完整，后续发行应继续保留/核对更新的逐文件署名。
- 官方[媒体署名表](https://wiki.unvanquished.net/wiki/Credits/Media)、[默认媒体许可](https://wiki.unvanquished.net/wiki/Licenses/Media)、[CC BY-SA 3.0 正文](https://creativecommons.org/licenses/by-sa/3.0/legalcode)、[CC BY-SA 4.0 正文](https://creativecommons.org/licenses/by-sa/4.0/legalcode)。这些资源及其改编不采用本项目代码的 ISC 许可。

浏览器使用本项目编写的 MD5 适配层和 Three.js 播放骨骼动画，没有复制上游 GPL 游戏代码。源模型和动画不修改；材质使用原贴图近似其原引擎光照。运行时贴图在 GPU 上传前限制为最长边 2048，以减少显存占用，不改写本目录原文件。瞄准时仅对整个模型做视角对齐，骨骼动作沿用原片段。
