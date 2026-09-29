# 家庭生活 · Mobile v2

Android WebView 客户端。以用户导出的 `stitch_mobile_v2_390_844` 为视觉验收基准，主视口为 390 × 844；界面同时支持 320、430px 等手机宽度。

## 开发与构建

- `web/` 是唯一的客户端源目录；不要直接编辑 Android 的 assets 副本。
- `android/` 为 Java 17 / Gradle Android 工程。构建时通过 Sync 任务同步前端文件，删除过期的副本。
- `domain/`、`store/` 为 Python 业务规则和数据库连接层；`server/` 提供真实登录及 MySQL 持久化接口。
- `tools/review.html` 为逐页设计对照工具；`tests/browser-audit.html` 为浏览器交互回归工具。这些文件不会进入 APK。

安装 Node 开发工具并执行回归：

```powershell
npm ci
npm test
npm run format:check
python -m unittest tests.test_shipped_rules -v
```

构建及 Android 静态检查（需配置 Android SDK 和 Java 17）：

```powershell
./tools/build-android.ps1 -JavaHome $env:JAVA_HOME
```

构建前运行 `python tools/setup-local-tls.py` 生成本机调试证书。输出：根目录 `app-debug.apk` 和 `artifacts/family-life-mobile-v2-1.5.0.apk`。这是开发签名包，正式发布仍需配置生产签名。

启动本地对照服务：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

打开 [逐页对照](http://127.0.0.1:4173/tools/review.html) 或 [交互回归](http://127.0.0.1:4173/tests/browser-audit.html)。

## 实现约定

- 页面、卡片、导航、表单、数字键盘与底部弹窗使用共用组件。
- 收入、支出、人情使用统一汇总口径；余额以分为单位做加减，最多两位小数。
- 切换分类、颜色、账户类型及表单状态时保留输入；返回按导航层级恢复。
- 正式客户端通过 HTTPS 后端保存 MySQL 数据，Android 会话及待同步草稿本机加密；旧 localStorage 保留供首次导入。设计预览继续使用独立示例数据。备份通过 Android 文档选择器导出，邀请复制和分享使用系统能力。
- Android 状态栏、导航栏和输入法分别处理；装饰图与字体均从 APK 本地加载。
- 旧前端源码及旧 APK 保留在 `backups/before-stitch-restoration/`。

## 当前边界

1.5.0 已接通真实登录、家庭邀请码和业务数据库，后端部署在当前电脑，模拟器通过端口转发连接。健康按个人账号隔离，家庭账本按家庭共享。详见 [本机部署、旧数据导入与数据库结构](docs/database-local.md)。电脑需保持服务运行；尚未部署公网服务器，也未配置生产签名或自动数据库备份。

设计只有入口、没有交互规格的设置项保留入口并说明暂未开放。地图按钮调用设备地图应用按地址查询；尚无应用内地图 SDK 或坐标回传。界面金额、记录数量、图表比例取自当前数据，不用截图中的固定金额替代计算结果。

## 字体及资源

登录 HTML 指定的是系统字体栈，没有附带 PingFang 等系统字体文件。Android 使用本地 Noto Sans SC（400/600/700）和 Inter（400/500/600/700）稳定映射中文、数字字形；它不是对苹果专有字体的复制。字体依 SIL Open Font License 1.1 分发，许可证保存在 `web/assets/fonts/`。

WOFF2 是运行资源，TTF 作为源文件保留但不进入 APK。字体来自 [Google Fonts](https://github.com/google/fonts)。图标为本地 SVG，家庭卡片和地图装饰为依据截图重建的 SVG，无外部图标或图片 CDN 依赖。
