import TencentCloudChat from '@tencentcloud/chat';
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

// 兼容 ES Module 和 CommonJS
const __filename = typeof import.meta !== 'undefined' && import.meta.url
  ? fileURLToPath(import.meta.url)
  : (typeof __filename !== 'undefined' ? __filename : process.cwd() + '/server.js');
const __dirname = typeof import.meta !== 'undefined' && import.meta.url
  ? path.dirname(fileURLToPath(import.meta.url))
  : (typeof __dirname !== 'undefined' ? __dirname : process.cwd());

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// IM 客户端状态
let chat = null;
let isReady = false;
let config = {
  uid: null,
  userId: null,
  token: null,
  appId: null,
  sign: null
};

// WebSocket 客户端管理
const wsClients = new Set();

const API_BASE = 'https://suo.jiushu1234.com/api.php';
const STATE_FILE = path.resolve(__dirname, '..', 'state.json');

// 日志函数
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}]`, ...args);
}

// WebSocket 广播函数
function broadcastToClients(data) {
  const message = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      try {
        client.send(message);
      } catch (error) {
        log('ERROR', 'WebSocket 发送失败:', error.message);
      }
    }
  });
}

// 加载配置
async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf-8');
    const state = JSON.parse(data);

    if (!state.uid || !state.token) {
      log('WARN', 'state.json 缺少 uid 或 token');
      return false;
    }

    // 处理 UID 格式
    const rawUid = state.uid.trim();
    if (rawUid.startsWith('game_')) {
      config.userId = rawUid.replace('game_', '');
      config.uid = `game_${config.userId}`;
    } else {
      config.userId = rawUid;
      config.uid = `game_${rawUid}`;
    }

    config.token = state.token;
    log('INFO', `已加载配置: UID=${config.uid}, UserID=${config.userId}`);
    return true;
  } catch (error) {
    log('ERROR', '加载配置失败:', error.message);
    return false;
  }
}

// 请求 IM 签名
async function requestGameSign() {
  try {
    const url = `${API_BASE}/user/game_sign`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uid: config.uid,
        token: config.token
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.code !== 1 || !result.data) {
      throw new Error(`API 返回错误: ${result.msg || 'Unknown error'}`);
    }

    config.appId = result.data.appid;
    config.sign = result.data.sign;
    log('INFO', '✓ 获取 IM 签名成功');
    return true;
  } catch (error) {
    log('ERROR', '✗ 获取 IM 签名失败:', error.message);
    return false;
  }
}

// 初始化 IM
async function initIM() {
  try {
    log('INFO', '正在初始化 IM 客户端...');

    // 加载配置
    const loaded = await loadState();
    if (!loaded) {
      log('ERROR', '配置加载失败，无法初始化 IM');
      return false;
    }

    // 获取签名
    const signOk = await requestGameSign();
    if (!signOk) {
      log('ERROR', '获取签名失败，无法初始化 IM');
      return false;
    }

    // 销毁旧实例
    if (chat) {
      try {
        await chat.logout();
        await chat.destroy();
      } catch (e) {
        log('WARN', '销毁旧实例失败:', e.message);
      }
    }

    // 创建 IM 实例
    chat = TencentCloudChat.create({
      SDKAppID: parseInt(config.appId)
    });

    // 设置日志级别
    chat.setLogLevel(1); // 0: 普通, 1: 发布, 2: 告警, 3: 错误

    // 注册事件监听
    chat.on(TencentCloudChat.EVENT.SDK_READY, () => {
      isReady = true;
      log('INFO', '✓ IM SDK 就绪');
      log('INFO', `当前登录用户: ${chat.getLoginUser()}`);

      // 广播状态变化
      broadcastToClients({
        type: 'status',
        data: {
          isReady: true,
          event: 'SDK_READY',
          user: chat.getLoginUser()
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, () => {
      isReady = false;
      log('WARN', '⚠ IM SDK 未就绪');

      // 广播状态变化
      broadcastToClients({
        type: 'status',
        data: {
          isReady: false,
          event: 'SDK_NOT_READY'
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.KICKED_OUT, async () => {
      isReady = false;
      log('WARN', '⚠ IM 被踢下线，5秒后重连...');

      // 广播被踢下线事件
      broadcastToClients({
        type: 'status',
        data: {
          isReady: false,
          event: 'KICKED_OUT',
          message: 'IM 被踢下线，正在重连...'
        }
      });

      setTimeout(() => {
        initIM().catch(e => log('ERROR', '重连失败:', e));
      }, 5000);
    });

    chat.on(TencentCloudChat.EVENT.NET_STATE_CHANGE, (event) => {
      log('INFO', '网络状态变化:', event.data.state);

      // 广播网络状态变化
      broadcastToClients({
        type: 'network',
        data: {
          state: event.data.state
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, (event) => {
      log('INFO', '📩 收到消息:', event.data.length, '条');

      // 广播收到的消息
      broadcastToClients({
        type: 'message',
        data: {
          count: event.data.length,
          messages: event.data.map(msg => ({
            from: msg.from,
            to: msg.to,
            type: msg.type,
            payload: msg.payload,
            time: msg.time
          }))
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.ERROR, (event) => {
      log('ERROR', 'IM 错误:', event.data);
    });

    // 登录 IM
    log('INFO', '正在登录 IM...');
    const loginRes = await chat.login({
      userID: config.uid,
      userSig: config.sign
    });

    if (loginRes.data?.repeatLogin) {
      log('WARN', '重复登录:', loginRes.data.errorInfo);
    }

    // 等待 SDK 就绪
    await waitReady(15000);

    log('INFO', '✓ IM 客户端初始化成功');
    log('INFO', `  UID: ${config.uid}`);
    log('INFO', `  UserID: ${config.userId}`);
    log('INFO', `  AppID: ${config.appId}`);
    return true;
  } catch (error) {
    log('ERROR', '✗ IM 初始化失败:', error.message);
    isReady = false;
    return false;
  }
}

// 等待 SDK 就绪
function waitReady(timeout = 15000) {
  if (isReady) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('等待 SDK_READY 超时'));
    }, timeout);

    const onReady = () => {
      isReady = true;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      if (chat) {
        chat.off(TencentCloudChat.EVENT.SDK_READY, onReady);
      }
    };

    if (chat) {
      chat.on(TencentCloudChat.EVENT.SDK_READY, onReady);
    }
  });
}

// 发送 IM 消息
async function sendIMMessage(commandId) {
  if (!chat || !isReady) {
    throw new Error('IM 未就绪');
  }

  try {
    // 构造消息内容
    const messageText = JSON.stringify({
      code: 'game_cmd',
      id: commandId,
      token: config.token
    });

    // 创建文本消息
    const message = chat.createTextMessage({
      to: config.userId,
      conversationType: TencentCloudChat.TYPES.CONV_C2C,
      payload: {
        text: messageText
      }
    });

    // 发送消息
    const sendRes = await chat.sendMessage(message);

    log('INFO', '✓ 指令发送成功:', commandId);
    return {
      success: true,
      message: '指令发送成功',
      data: sendRes
    };
  } catch (error) {
    log('ERROR', '✗ 指令发送失败:', error.message);
    throw error;
  }
}

// API 路由

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    imReady: isReady,
    uid: config.uid,
    userId: config.userId
  });
});

// 获取状态
app.get('/api/status', (req, res) => {
  res.json({
    isReady,
    config: {
      uid: config.uid,
      userId: config.userId,
      appId: config.appId,
      hasToken: !!config.token,
      hasSign: !!config.sign
    }
  });
});

// 发送指令
app.post('/api/send-command', async (req, res) => {
  try {
    const { commandId } = req.body;

    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: '缺少 commandId 参数'
      });
    }

    if (!isReady) {
      return res.status(503).json({
        success: false,
        message: 'IM 未就绪'
      });
    }

    const result = await sendIMMessage(commandId);
    res.json(result);
  } catch (error) {
    log('ERROR', 'API 错误:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 重新初始化
app.post('/api/reinit', async (req, res) => {
  try {
    log('INFO', '收到重新初始化请求');
    const success = await initIM();
    res.json({
      success,
      message: success ? 'IM 重新初始化成功' : 'IM 重新初始化失败'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 使用自定义凭证登录
app.post('/api/login', async (req, res) => {
  try {
    const { uid, token } = req.body;

    if (!uid || !token) {
      return res.status(400).json({
        success: false,
        message: '缺少 uid 或 token 参数'
      });
    }

    log('INFO', `收到登录请求: UID=${uid}`);

    // 临时更新配置
    const rawUid = uid.trim();
    if (rawUid.startsWith('game_')) {
      config.userId = rawUid.replace('game_', '');
      config.uid = rawUid;
    } else {
      config.userId = rawUid;
      config.uid = `game_${rawUid}`;
    }
    config.token = token;

    log('INFO', `使用自定义凭证: UID=${config.uid}, UserID=${config.userId}`);

    // 获取签名
    const signOk = await requestGameSign();
    if (!signOk) {
      return res.status(500).json({
        success: false,
        message: '获取 IM 签名失败'
      });
    }

    // 销毁旧实例
    if (chat) {
      try {
        await chat.logout();
        await chat.destroy();
      } catch (e) {
        log('WARN', '销毁旧实例失败:', e.message);
      }
    }

    // 创建 IM 实例
    chat = TencentCloudChat.create({
      SDKAppID: parseInt(config.appId)
    });

    // 设置日志级别
    chat.setLogLevel(1);

    // 注册事件监听
    chat.on(TencentCloudChat.EVENT.SDK_READY, () => {
      isReady = true;
      log('INFO', '✓ IM SDK 就绪');
      log('INFO', `当前登录用户: ${chat.getLoginUser()}`);

      broadcastToClients({
        type: 'status',
        data: {
          isReady: true,
          event: 'SDK_READY',
          user: chat.getLoginUser()
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, () => {
      isReady = false;
      log('WARN', '⚠ IM SDK 未就绪');

      broadcastToClients({
        type: 'status',
        data: {
          isReady: false,
          event: 'SDK_NOT_READY'
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.KICKED_OUT, async () => {
      isReady = false;
      log('WARN', '⚠ IM 被踢下线，5秒后重连...');

      broadcastToClients({
        type: 'status',
        data: {
          isReady: false,
          event: 'KICKED_OUT',
          message: 'IM 被踢下线，正在重连...'
        }
      });

      setTimeout(() => {
        initIM().catch(e => log('ERROR', '重连失败:', e));
      }, 5000);
    });

    chat.on(TencentCloudChat.EVENT.NET_STATE_CHANGE, (event) => {
      log('INFO', '网络状态变化:', event.data.state);

      broadcastToClients({
        type: 'network',
        data: {
          state: event.data.state
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, (event) => {
      log('INFO', '📩 收到消息:', event.data.length, '条');

      broadcastToClients({
        type: 'message',
        data: {
          count: event.data.length,
          messages: event.data.map(msg => ({
            from: msg.from,
            to: msg.to,
            type: msg.type,
            payload: msg.payload,
            time: msg.time
          }))
        }
      });
    });

    chat.on(TencentCloudChat.EVENT.ERROR, (event) => {
      log('ERROR', 'IM 错误:', event.data);
    });

    // 登录 IM
    log('INFO', '正在登录 IM...');
    const loginRes = await chat.login({
      userID: config.uid,
      userSig: config.sign
    });

    if (loginRes.data?.repeatLogin) {
      log('WARN', '重复登录:', loginRes.data.errorInfo);
    }

    // 等待 SDK 就绪
    await waitReady(15000);

    log('INFO', '✓ IM 登录成功');
    res.json({
      success: true,
      message: 'IM 登录成功',
      data: {
        uid: config.uid,
        userId: config.userId,
        appId: config.appId
      }
    });
  } catch (error) {
    log('ERROR', '✗ IM 登录失败:', error.message);
    isReady = false;
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// WebSocket 消息处理
function handleWebSocketMessage(ws, message) {
  try {
    const data = JSON.parse(message);
    log('INFO', 'WebSocket 收到消息:', data.type);

    switch (data.type) {
      case 'ping':
        // 心跳响应
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'getStatus':
        // 获取状态
        ws.send(JSON.stringify({
          type: 'status',
          data: {
            isReady,
            config: {
              uid: config.uid,
              userId: config.userId,
              appId: config.appId,
              hasToken: !!config.token,
              hasSign: !!config.sign
            }
          }
        }));
        break;

      case 'sendCommand':
        // 发送指令
        if (!data.commandId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 commandId 参数'
          }));
          return;
        }

        if (!isReady) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'IM 未就绪'
          }));
          return;
        }

        sendIMMessage(data.commandId)
          .then(result => {
            ws.send(JSON.stringify({
              type: 'commandResult',
              success: true,
              data: result
            }));
          })
          .catch(error => {
            ws.send(JSON.stringify({
              type: 'commandResult',
              success: false,
              message: error.message
            }));
          });
        break;

      case 'reinit':
        // 重新初始化
        initIM()
          .then(success => {
            ws.send(JSON.stringify({
              type: 'reinitResult',
              success,
              message: success ? 'IM 重新初始化成功' : 'IM 重新初始化失败'
            }));
          })
          .catch(error => {
            ws.send(JSON.stringify({
              type: 'reinitResult',
              success: false,
              message: error.message
            }));
          });
        break;

      case 'login':
        // 使用自定义凭证登录
        if (!data.uid || !data.token) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 uid 或 token 参数'
          }));
          return;
        }

        (async () => {
          try {
            log('INFO', `WebSocket 收到登录请求: UID=${data.uid}`);

            // 临时更新配置
            const rawUid = data.uid.trim();
            if (rawUid.startsWith('game_')) {
              config.userId = rawUid.replace('game_', '');
              config.uid = rawUid;
            } else {
              config.userId = rawUid;
              config.uid = `game_${rawUid}`;
            }
            config.token = data.token;

            log('INFO', `使用自定义凭证: UID=${config.uid}, UserID=${config.userId}`);

            // 获取签名
            const signOk = await requestGameSign();
            if (!signOk) {
              ws.send(JSON.stringify({
                type: 'loginResult',
                success: false,
                message: '获取 IM 签名失败'
              }));
              return;
            }

            // 销毁旧实例
            if (chat) {
              try {
                await chat.logout();
                await chat.destroy();
              } catch (e) {
                log('WARN', '销毁旧实例失败:', e.message);
              }
            }

            // 创建 IM 实例
            chat = TencentCloudChat.create({
              SDKAppID: parseInt(config.appId)
            });

            chat.setLogLevel(1);

            // 注册事件监听
            chat.on(TencentCloudChat.EVENT.SDK_READY, () => {
              isReady = true;
              log('INFO', '✓ IM SDK 就绪');
              broadcastToClients({
                type: 'status',
                data: {
                  isReady: true,
                  event: 'SDK_READY',
                  user: chat.getLoginUser()
                }
              });
            });

            chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, () => {
              isReady = false;
              broadcastToClients({
                type: 'status',
                data: { isReady: false, event: 'SDK_NOT_READY' }
              });
            });

            chat.on(TencentCloudChat.EVENT.KICKED_OUT, async () => {
              isReady = false;
              broadcastToClients({
                type: 'status',
                data: { isReady: false, event: 'KICKED_OUT' }
              });
            });

            chat.on(TencentCloudChat.EVENT.NET_STATE_CHANGE, (event) => {
              broadcastToClients({
                type: 'network',
                data: { state: event.data.state }
              });
            });

            chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, (event) => {
              broadcastToClients({
                type: 'message',
                data: {
                  count: event.data.length,
                  messages: event.data.map(msg => ({
                    from: msg.from,
                    to: msg.to,
                    type: msg.type,
                    payload: msg.payload,
                    time: msg.time
                  }))
                }
              });
            });

            // 登录 IM
            await chat.login({
              userID: config.uid,
              userSig: config.sign
            });

            // 等待 SDK 就绪
            await waitReady(15000);

            ws.send(JSON.stringify({
              type: 'loginResult',
              success: true,
              message: 'IM 登录成功',
              data: {
                uid: config.uid,
                userId: config.userId,
                appId: config.appId
              }
            }));
          } catch (error) {
            log('ERROR', '✗ IM 登录失败:', error.message);
            ws.send(JSON.stringify({
              type: 'loginResult',
              success: false,
              message: error.message
            }));
          }
        })();
        break;

      default:
        ws.send(JSON.stringify({
          type: 'error',
          message: `未知的消息类型: ${data.type}`
        }));
    }
  } catch (error) {
    log('ERROR', 'WebSocket 消息处理错误:', error.message);
    ws.send(JSON.stringify({
      type: 'error',
      message: '消息格式错误'
    }));
  }
}

// 启动服务器
async function startServer() {
  // 初始化 IM
  await initIM();

  // 创建 HTTP 服务器
  const server = createServer(app);

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server });

  // WebSocket 连接处理
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    log('INFO', `WebSocket 客户端连接: ${clientIp}`);

    // 添加到客户端集合
    wsClients.add(ws);

    // 发送欢迎消息
    ws.send(JSON.stringify({
      type: 'connected',
      message: 'WebSocket 连接成功',
      data: {
        isReady,
        uid: config.uid,
        userId: config.userId
      }
    }));

    // 消息处理
    ws.on('message', (message) => {
      handleWebSocketMessage(ws, message.toString());
    });

    // 错误处理
    ws.on('error', (error) => {
      log('ERROR', 'WebSocket 错误:', error.message);
    });

    // 断开连接
    ws.on('close', () => {
      log('INFO', `WebSocket 客户端断开: ${clientIp}`);
      wsClients.delete(ws);
    });
  });

  // 启动服务器
  server.listen(PORT, () => {
    log('INFO', '='.repeat(60));
    log('INFO', 'CS2 IM 服务已启动');
    log('INFO', `HTTP 服务: http://localhost:${PORT}`);
    log('INFO', `WebSocket 服务: ws://localhost:${PORT}`);
    log('INFO', `健康检查: http://localhost:${PORT}/health`);
    log('INFO', `状态查询: http://localhost:${PORT}/api/status`);
    log('INFO', '='.repeat(60));
  });

  // 定期心跳
  setInterval(() => {
    if (isReady) {
      log('DEBUG', '心跳: IM 连接正常');
    } else {
      log('WARN', '心跳: IM 未就绪');
    }

    // 向所有 WebSocket 客户端发送心跳
    broadcastToClients({
      type: 'heartbeat',
      data: {
        isReady,
        timestamp: Date.now(),
        clients: wsClients.size
      }
    });
  }, 30000);
}

// 错误处理
process.on('unhandledRejection', (reason) => {
  const msg = String(reason?.message || reason || '');
  const code = (reason && (reason.code ?? reason?.data?.code)) ?? undefined;
  if (code === 2801 || /请求超时/.test(msg)) return;
  log('ERROR', 'unhandledRejection:', reason);
});

process.on('uncaughtException', (err) => {
  const msg = String(err?.message || err || '');
  const code = (err && (err.code ?? err?.data?.code)) ?? undefined;
  if (code === 2801 || /请求超时/.test(msg)) return;
  log('ERROR', 'uncaughtException:', err);
});

// 优雅退出
process.on('SIGINT', async () => {
  log('INFO', '\n正在关闭服务...');
  if (chat) {
    try {
      await chat.logout();
      await chat.destroy();
      log('INFO', 'IM 客户端已关闭');
    } catch (e) {
      log('ERROR', '关闭 IM 客户端失败:', e.message);
    }
  }
  process.exit(0);
});

// 启动
startServer().catch(error => {
  log('ERROR', '启动失败:', error);
  process.exit(1);
});
