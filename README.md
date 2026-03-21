# 掼蛋

这是一个支持本地模式和联网房间的掼蛋原型项目。

当前已经支持：
- 本地模式：1 名玩家 + 3 个 AI
- 联网模式：创建房间、加入房间、房主开始、2 人房补 AI、多人随机组队
- 联机牌桌：出牌、不要、AI 建议、结算、下一局同步
- 联机聊天：聊天窗位于打牌界面，支持最小化、未读提示、闪烁提醒
- 联机控制：玩家可退出当前牌局，房主可从主牌 `3` 重新开始整场
- 系统消息：断线、重连、房主切换、房间关闭、开始下一局、重开整场都会进入聊天区显示
- 联机稳定性：动作去重、房间恢复、房主切换、房间关闭与重开提示已补强

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

联机稳定性回归：

```powershell
cmd /c "cd /d E:\guandan && npm run test:online-stability"
```

## 联网模式现状

已支持：
- 创建房间、加入房间、离开房间
- 房主开始：`2 人直接开` / `等满 4 人再开`
- 2 人房自动补 2 个 AI 搭档
- 3 人 / 4 人房随机座位与随机组队
- 房间聊天
- 联机牌桌同步当前轮次、主牌、手牌数量、最新出牌
- 玩家退出当前牌局后，其余在线玩家会收到通知并回到模式选择页
- 房主可在联机牌局中重新开始整场
- 房间关闭、房主切换、玩家断线重连等事件会作为系统消息进入聊天区
- 联机动作请求带客户端去重标识，服务端也会做重复提交保护

仍可继续增强：
- 更强的联机 AI 策略
- 更完整的断线重连恢复
- 更多自动化联机长局测试

## Render 部署

仓库已包含 [render.yaml](E:\guandan\render.yaml)，可以直接用 Render Blueprint 部署。

大致步骤：
1. 在 Render 里选择 `New -> Blueprint`
2. 连接 GitHub 仓库 `imgald/guandan`
3. 选择分支 `main`
4. 部署
