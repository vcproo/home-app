# 数据库

`schema.sql` 包含全部 MySQL 表结构，不含账号、手机号、密码哈希或业务记录。应用首次注册时自动初始化家庭与个人资料，不提供共享默认账号。

1. 在 MySQL 创建空数据库 `home-app`（UTF-8 / utf8mb4）。
2. 将 `connection.example.md` 复制到项目根目录为 `本地数据库连接.md`，配置自己的数据库用户和密码。
3. 导入 `schema.sql`，或启动 `python -m server.app` 让应用创建所需表。
4. 按 `docs/database-local.md` 启动后端和模拟器联调。

## 版本数据备份

GitHub Release 中的 `home-app-database-v1.5.0.sql.enc` 是 AES-256-GCM 加密的数据快照，包含表结构和导出时的业务数据；不包含登录会话。解密密钥仅保存在原电脑 `.local-server/backups/home-app-database-v1.5.0.key`，不提交 GitHub。请自行妥善备份该密钥，丢失后无法恢复加密快照。

```powershell
python tools/database-backup.py decrypt --backup artifacts/home-app-database-v1.5.0.sql.enc --key .local-server/backups/home-app-database-v1.5.0.key --output backups/database-restore.sql
```

解密后 SQL 含私人数据，仅在本机使用，导入一个新的空数据库，不要上传。恢复不包含旧登录会话，需要重新登录。加密备份不是数据库密码或模型密钥的备份。

创建新的备份：`python tools/database-backup.py export --version v1.5.1`。同一版本文件不允许覆盖，以免旧备份的解密密钥丢失。
