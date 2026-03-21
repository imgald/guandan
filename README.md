# 掼蛋

这是一个支持本地模式和联网房间的掼蛋原型项目。

当前已经支持：
- 本地模式：1 名玩家 + 3 个 AI
- 联网模式：创建房间、加入房间、房主开始、2 人房补 AI、多人随机组队
- 联机牌桌：出牌 / 不要 / AI 建议 / 结算 / 下一局同步
- 联机聊天：聊天窗位于打牌界面，支持最小化、未读提示和新消息闪烁提醒
- 联机控制：玩家可退出当前牌局，房主可从主牌 `3` 重新开始整场

## 本地运行

推荐直接启动 Node 服务：

```powershell
node E:\guandan\server.js
```

然后打开：

- [http://localhost:8000](http://localhost:8000)

如果你想用 `npm`，在这台 Windows 环境里更稳的是：

```powershell
cmd /c "cd /d E:\guandan && npm start"
```

## 测试命令

规则回归：

```powershell
cmd /c "cd /d E:\guandan && npm run test:rules"
```

联机前端视图回归：

```powershell
cmd /c "cd /d E:\guandan && npm run test:online-ui"
```

## 联网模式现状

已支持：
- 创建房间、加入房间、离开房间
- 房主开始
- `2 人直接开` / `等满 4 人再开`
- 2 人房自动补 2 个 AI 搭档
- 3 人 / 4 人房随机座位与组队
- 房间聊天
- 联机牌桌同步当前轮次、主牌、手牌数量、最新出牌
- 玩家退出当前牌局后，剩余在线玩家收到通知并返回模式选择页
- 房主在联机牌局中重新开始整场

仍可继续增强：
- 更强的联机 AI 策略
- 更多联机断线场景恢复
- 更完整的联机对局自动化测试

## Render 部署

仓库已包含 [render.yaml](E:\guandan\render.yaml)，可以直接用 Render Blueprint 部署。

大致步骤：
1. 在 Render 里选择 `New -> Blueprint`
2. 连接 GitHub 仓库 `imgald/guandan`
3. 选择分支 `main`
4. 部署
