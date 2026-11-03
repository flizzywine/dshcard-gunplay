# Dust II 经典灰盒

本地浏览器布局研究版本，基于 **Counter-Strike: Source** 的完整 `de_dust2`，不是 CS2 新版，也不是 Shortdust / 小型竞技场。

原始 VMF 下载地址：<https://temaps.com/files/source/vmf-maps/de_dust2.vmf>
索引：<https://temaps.com/files/source/vmf-maps/>
地图归原作者 / Valve 所有；下载可用不等于开源许可。本项目没有取得公开再分发这张地图的授权，当前转换产物供本地测试，发布前应另行确认许可。

`dust2.json` 的 provenance 包含输入 SHA-256、坐标转换及尺度。以 72 单位人物约 1.83 米校准，统一采用 0.0254 米/单位；Source `(x,y,z)` 转为 Three `(x,z+384,1024-y)` 后统一缩放。距离和高差没有独立拉伸，垂直偏移只用于适配现有游戏坐标。

转换保留凸刷面、坡面、拱门、61 个 displacement 地面和玩家阻挡体；排除触发器、天空材质和地图外独立 3D skybox。没有加载 Valve 材质或模型。45 个箱子按模型名标称尺寸、原点和朝向生成方块；车辆和油桶使用近似尺寸。模型碰撞体并未精确复刻，装饰模型被省略，因此这是原始建筑布局的可玩灰盒，不是逐碰撞体复刻。

导航按多个地面高度采样，并用 Rapier 中与 AI 等尺寸的胶囊双向验证相邻边，只保留连接 T 出生区的分量。上下层在同一水平坐标仍是独立节点。此导航是离线生成，浏览器只加载结果和寻路。

重建（在项目根目录）：

```powershell
New-Item -ItemType Directory -Force output/sources/dust2 | Out-Null
Invoke-WebRequest https://temaps.com/files/source/vmf-maps/de_dust2.vmf -OutFile output/sources/dust2/de_dust2.vmf
npm run build:dust2
npm test
npm run test:dust2
```

原始输入位于忽略的 output 目录，不依赖在线 CDN。浏览器测试需先在项目根目录启动 HTTP 服务（当前测试默认端口 8089）。
