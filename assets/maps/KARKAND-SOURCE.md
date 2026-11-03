# Karkand 大战场灰盒

底稿是 **gehstur / G4RY 的 Insurgency 2014 社区重制 `karkand_b3` 完整 PvP 版**，不是《战地 2》原版地图资产，也不是只有部分区域的合作版。主建筑、街道、桥梁和地形使用下载地图反编译后的几何。

- 作者发布页：<https://steamcommunity.com/sharedfiles/filedetails/?id=394489681>
- SteamCMD 匿名下载实测成功，包内 `maps/karkand_b3.bsp` 为 78,698,504 字节。
- 使用 [BSPSource 1.4.8](https://github.com/ata4/bspsrc/releases/tag/v1.4.8) 转为 VMF。转换不能保证恢复全部原编辑数据。
- 输入 VMF 的 SHA-256、尺度与变换保存在 `karkand.json` 的 `provenance`。

统一尺度 0.0254 米/Source 单位；坐标 `(x,y,z)` 转成 `(x+4096,z+2560,2048-y)` 再统一缩放。没有为适配浏览器压缩街道距离或单独拉伸地形高度。840 米是雷达显示范围，不代表原版 BF2 的可玩边界或实测边长。

## 保留与近似

保留 4,838 个几何刷体、200 个 displacement 曲面，使用同一套三角形渲染和 Rapier 碰撞。装饰窗户、线缆、植被、部分模型楼梯等未加载；原模型 MDL 没有包含在工坊地图包中。本版本保留建筑刷体与地形形成的通路，但并未复刻所有模型碰撞体、梯子攀爬和屋顶入口。

421 个车辆、箱子、路障、沙袋、墙段、集装箱等模型部件以方块近似。位置和水平朝向来自地图，尺寸按模型类型近似，详见 JSON 的 `proxies`；敞开集装箱由两侧墙和顶板组成，入口可穿过。模型代理不保证原作的精确射击间隙。无需原作贴图或模型。

导航在所有楼层分别采样，并用 AI 同尺寸的 Rapier 胶囊验证相邻边；平坦路段使用一次连续形状扫掠，斜坡和台阶细分验证。保留连接原出生区的 206,763 个节点。Source 的两队各 64 个出生位置投到附近安全导航点，原始位置保存在 JSON；测试约束偏移不超过 1.5 米。

当前支持团队死斗。地图标签用于标示地标，没有冒充 BF2 原版旗点名称。按住 M 看战术地图。

## 重建与验证

在 D 盘项目的 `output` 内放置 SteamCMD 与 BSPSource，子进程 TEMP/TMP 指向 `output/tmp`。原始下载及 VMF 在忽略的 `output/sources/karkand`，运行时只加载 `assets/maps/karkand.json`，不依赖在线服务。

```powershell
# SteamCMD 官方下载：https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip
steamcmd.exe +force_install_dir D:\Workspace\dshcard-gunplay\output\sources\karkand\steam +login anonymous +workshop_download_item 222880 394489681 +quit

# 从 BSPSource 安装目录运行命令行入口，避免打开 GUI：
.\bin\java.exe -m info.ata4.bspsrc.app/info.ata4.bspsrc.app.src.BspSourceLauncher --appid 222880 -o D:\Workspace\dshcard-gunplay\output\sources\karkand\karkand_b3.vmf D:\Workspace\dshcard-gunplay\output\sources\karkand\steam\steamapps\workshop\content\222880\394489681\maps\karkand_b3.bsp

# 回到项目根目录：
npm run build:karkand
npm test
npm run test:karkand
```

`test:karkand` 需要先启动本地 HTTP 服务（默认 8089 端口）。验证包含所有出生点、8 条跨区实走路线、桥面连续穿越、近邻索引正确性、90 秒 AI 团队死斗和地图切换。截图位于 `output/playwright/karkand-*.png`。

地图与原作资源的权利归对应作者所有。公开工坊下载不是跨游戏再发布许可；当前产物用于本地布局测试，没有打包人物卡或发布到远端。
