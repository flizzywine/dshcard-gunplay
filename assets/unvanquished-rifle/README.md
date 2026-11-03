# Unvanquished 步枪、原配手臂与动画

本目录保存官方资源的原始文件，MD5 骨骼、动画帧和 PNG 纹理未改写。浏览器的 `js/md5-model.js` 仅适配格式，预览页统一转换坐标和尺度，使用 Three.js AnimationMixer 播放原动画；未使用本项目原有的程序化换弹动作。

- 来源：[Unvanquished 官方武器资产仓库](https://github.com/UnvanquishedAssets/res-weapons_src.dpkdir/tree/master/models/weapons/rifle)。步枪由 Vlad Hristev / hristew 制作，概念 AlexBo，动画 Burning Ice，接入 Enneract；见官方[媒体署名表](https://wiki.unvanquished.net/wiki/Credits/Media)。
- 步枪文件的原始许可见本目录 `license.txt`：**CC BY-SA 3.0**。这些第三方资源不采用本项目代码的 ISC 许可证。
- 原配手套纹理来自[官方玩家资产仓库](https://github.com/UnvanquishedAssets/res-players_src.dpkdir/tree/master/models/players/human_hand)。官方媒体表将人类手套/护甲署名给 Angelo / Stannum / RXMT，并标为 **CC BY-SA 3.0**。
- 许可正文：[Creative Commons Attribution-ShareAlike 3.0](https://creativecommons.org/licenses/by-sa/3.0/legalcode)。复用这些素材及改编素材时保留署名和对应许可。
- `manifest.json` 保存两个上游提交、每个文件的精确来源、字节数及 SHA-256。重新获取：`node scripts/vendor-unvanquished-rifle.mjs`。

动画：idle（待机）、fire（开火）、reload（换弹）、raise（举枪）、lower（收枪）。换弹原片段为 139 帧 / 60 FPS；首帧到末帧的跨度为 2.30 秒。

独立预览：[weapon-preview.html](../../weapon-preview.html)。支持第一人称/模型旋转观察、原速/慢放、动作切换、循环和拖动进度。它没有修改正式游戏的地图、武器或伤害逻辑。Unvanquished 的原引擎材质由独立 GLSL 管线渲染，此处使用其原始漫反射/法线/高光贴图，在 Three.js 中近似原材质光照。
