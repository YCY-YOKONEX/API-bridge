import TencentCloudChat from '@tencentcloud/chat';
import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import AsyncLock from 'async-lock';
import jwt from 'jsonwebtoken';
import XMLHttpRequest from 'xhr2';
import {
  initDatabase,
  verifyAdmin,
  resetAdminPassword,
  logConnection,
  logCommand,
  getConnectionLogs,
  getCommandLogs,
  getLogStats,
  getRealtimeStats,
  getTrafficTrend,
  getSystemMetrics,
  closeDatabase
} from './database.js';
import {
  getDetailReport,
  getDistributionReport,
  getOverviewReport,
  getRankingReport,
  getTrendReport
} from './reporting/service.js';
import { getSummaryReport } from './reporting/summary.js';
import { normalizeReportQuery } from './reporting/query.js';
import { buildCsvExport } from './reporting/export.js';

// 为腾讯云 SDK 提供 WebSocket polyfill (Node.js 环境需要)
if (typeof global.WebSocket === 'undefined') {
  global.WebSocket = WebSocket;
}

// 为腾讯云 SDK 提供 XMLHttpRequest polyfill (Node.js 环境需要)
if (typeof global.XMLHttpRequest === 'undefined') {
  global.XMLHttpRequest = XMLHttpRequest;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// 中间件
app.use(cors());
app.use(express.json());

// 常量配置
const API_BASE = 'https://suo.jiushu1234.com/api.php';

// 资源限制配置
const MAX_SESSIONS = 100;              // 最大会话数
const MAX_WS_CONNECTIONS = 200;       // 最大 WebSocket 连接数
const SESSION_TIMEOUT = 3 * 60 * 1000; // 会话超时时间
const SESSION_CLEANUP_INTERVAL = 5 * 60 * 1000; // 清理检查间隔 (5分钟)

const JWT_SECRET = process.env.JWT_SECRET || 'f9e2a1b8c7d4e6f3a0c5d2e9b8f1a3c7';
const JWT_EXPIRES_IN = '24h';

// 全局锁管理器 (超时时间需大于 SDK_READY 等待时间)
const lock = new AsyncLock({ timeout: 25000 });

// 初始化数据库
initDatabase();

// 日志函数
function log(level, ...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${level}]`, ...args);
}

/**
 * JWT 认证中间件
 */
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: '令牌无效或已过期'
      });
    }
    req.user = user;
    next();
  });
}

/**
 * IM 会话类 - 封装单个用户的 IM 连接
 */
class IMSession {
  constructor(userId, uid, token, appId, sign) {
    this.userId = userId;
    this.uid = uid;
    this.token = token;
    this.appId = appId;
    this.sign = sign;
    this.chat = null;
    this.isReady = false;
    this.createdAt = Date.now();
    this.lastAccessTime = Date.now();
    this.eventHandlers = new Map(); // 存储事件处理器引用，用于清理
    // 内部 Promise 用于等待 SDK 就绪，避免事件监听时序问题
    this._readyResolve = null;
    this._readyPromise = new Promise((resolve) => {
      this._readyResolve = resolve;
    });
  }

  /**
   * 初始化 IM 会话
   */
  async init(broadcastCallback) {
    try {
      log('INFO', `[${this.userId}] 正在初始化 IM 会话...`);

      // 创建 IM 实例
      this.chat = TencentCloudChat.create({
        SDKAppID: parseInt(this.appId)
      });

      this.chat.setLogLevel(3);

      // 注册事件监听器并保存引用
      const onReady = () => {
        this.isReady = true;
        // 触发内部 Promise，通知所有等待者
        if (this._readyResolve) {
          this._readyResolve();
          this._readyResolve = null;
        }
        log('INFO', `[${this.userId}] ✓ IM SDK 就绪`);
        if (broadcastCallback) {
          broadcastCallback({
            type: 'status',
            userId: this.userId,
            data: {
              isReady: true,
              event: 'SDK_READY',
              user: this.chat.getLoginUser()
            }
          });
        }
      };

      const onNotReady = () => {
        this.isReady = false;
        log('WARN', `[${this.userId}] ⚠ IM SDK 未就绪`);
        if (broadcastCallback) {
          broadcastCallback({
            type: 'status',
            userId: this.userId,
            data: {
              isReady: false,
              event: 'SDK_NOT_READY'
            }
          });
        }
      };

      const onKickedOut = () => {
        this.isReady = false;
        log('WARN', `[${this.userId}] ⚠ IM 被踢下线`);
        if (broadcastCallback) {
          broadcastCallback({
            type: 'status',
            userId: this.userId,
            data: {
              isReady: false,
              event: 'KICKED_OUT',
              message: 'IM 被踢下线'
            }
          });
        }
      };

      const onNetStateChange = (event) => {
        log('INFO', `[${this.userId}] 网络状态变化:`, event.data.state);
        if (broadcastCallback) {
          broadcastCallback({
            type: 'network',
            userId: this.userId,
            data: {
              state: event.data.state
            }
          });
        }
      };

      const onMessageReceived = (event) => {
        log('INFO', `[${this.userId}] 📩 收到消息:`, event.data.length, '条');
        if (broadcastCallback) {
          broadcastCallback({
            type: 'message',
            userId: this.userId,
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
        }
      };

      const onError = (event) => {
        log('ERROR', `[${this.userId}] IM 错误:`, event.data);
      };

      // 注册事件并保存处理器引用
      this.chat.on(TencentCloudChat.EVENT.SDK_READY, onReady);
      this.chat.on(TencentCloudChat.EVENT.SDK_NOT_READY, onNotReady);
      this.chat.on(TencentCloudChat.EVENT.KICKED_OUT, onKickedOut);
      this.chat.on(TencentCloudChat.EVENT.NET_STATE_CHANGE, onNetStateChange);
      this.chat.on(TencentCloudChat.EVENT.MESSAGE_RECEIVED, onMessageReceived);
      this.chat.on(TencentCloudChat.EVENT.ERROR, onError);

      // 保存处理器引用
      this.eventHandlers.set('SDK_READY', onReady);
      this.eventHandlers.set('SDK_NOT_READY', onNotReady);
      this.eventHandlers.set('KICKED_OUT', onKickedOut);
      this.eventHandlers.set('NET_STATE_CHANGE', onNetStateChange);
      this.eventHandlers.set('MESSAGE_RECEIVED', onMessageReceived);
      this.eventHandlers.set('ERROR', onError);

      // 登录 IM
      log('INFO', `[${this.userId}] 正在登录 IM...`);
      const loginRes = await this.chat.login({
        userID: this.uid,
        userSig: this.sign
      });

      // 处理重复登录：SDK 可能不会再触发 SDK_READY，需要直接标记就绪
      if (loginRes.data?.repeatLogin) {
        log('WARN', `[${this.userId}] 重复登录，直接标记为就绪状态`);
        this.isReady = true;
        if (this._readyResolve) {
          this._readyResolve();
          this._readyResolve = null;
        }
      }

      // 等待 SDK 就绪
      await this.waitReady(15000);

      log('INFO', `[${this.userId}] ✓ IM 会话初始化成功`);
      return true;
    } catch (error) {
      log('ERROR', `[${this.userId}] ✗ IM 会话初始化失败:`, error.message);
      this.isReady = false;
      throw error;
    }
  }

  /**
   * 等待 SDK 就绪 - 使用内部 Promise 避免事件监听时序问题
   */
  waitReady(timeout = 15000) {
    // 已经就绪，直接返回
    if (this.isReady) return Promise.resolve();

    // 使用内部 Promise 配合超时竞争
    return Promise.race([
      this._readyPromise,
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error('等待 SDK_READY 超时'));
        }, timeout);
      })
    ]);
  }

  /**
   * 发送 IM 消息
   */
  async sendMessage(commandId) {
    this.lastAccessTime = Date.now();

    if (!this.chat || !this.isReady) {
      throw new Error('IM 会话未就绪');
    }

    try {
      const messageText = JSON.stringify({
        code: 'game_cmd',
        id: commandId,
        token: this.token
      });

      const message = this.chat.createTextMessage({
        to: this.userId,
        conversationType: TencentCloudChat.TYPES.CONV_C2C,
        payload: {
          text: messageText
        }
      });

      const sendRes = await this.chat.sendMessage(message);

      log('INFO', `[${this.userId}] ✓ 指令发送成功:`, commandId);
      return {
        success: true,
        message: '指令发送成功',
        data: sendRes
      };
    } catch (error) {
      log('ERROR', `[${this.userId}] ✗ 指令发送失败:`, error.message);
      throw error;
    }
  }

  /**
   * 销毁会话
   */
  async destroy() {
    try {
      log('INFO', `[${this.userId}] 正在销毁 IM 会话...`);

      if (this.chat) {
        // 移除所有事件监听器
        for (const [eventName, handler] of this.eventHandlers) {
          const eventType = TencentCloudChat.EVENT[eventName];
          if (eventType) {
            this.chat.off(eventType, handler);
          }
        }
        this.eventHandlers.clear();

        // 登出并销毁
        try {
          await this.chat.logout();
          await this.chat.destroy();
        } catch (e) {
          log('WARN', `[${this.userId}] 销毁 IM 实例时出错:`, e.message);
        }

        this.chat = null;
      }

      this.isReady = false;
      log('INFO', `[${this.userId}] ✓ IM 会话已销毁`);
    } catch (error) {
      log('ERROR', `[${this.userId}] 销毁会话失败:`, error.message);
    }
  }

  /**
   * 检查会话是否超时
   */
  isExpired() {
    return Date.now() - this.lastAccessTime > SESSION_TIMEOUT;
  }

  /**
   * 获取会话信息
   */
  getInfo() {
    return {
      userId: this.userId,
      uid: this.uid,
      appId: this.appId,
      isReady: this.isReady,
      createdAt: this.createdAt,
      lastAccessTime: this.lastAccessTime,
      age: Date.now() - this.createdAt
    };
  }
}

/**
 * 会话管理器 - 管理所有用户的 IM 会话
 */
class SessionManager {
  constructor() {
    this.sessions = new Map(); // userId -> IMSession
    this.wsClients = new Set(); // WebSocket 客户端集合
    this.startCleanupTask();
  }

  /**
   * 获取或创建会话
   */
  async getOrCreateSession(userId, uid, token) {
    // 使用锁保护会话创建过程
    return await lock.acquire(`session:${userId}`, async () => {
      // 检查会话数限制
      if (!this.sessions.has(userId) && this.sessions.size >= MAX_SESSIONS) {
        throw new Error(`会话数已达上限 (${MAX_SESSIONS})，请稍后再试`);
      }

      // 如果会话已存在，检查 token 是否匹配
      if (this.sessions.has(userId)) {
        const existingSession = this.sessions.get(userId);

        // 如果 token 不同，需要重新登录
        if (existingSession.token !== token) {
          log('INFO', `[${userId}] Token 已变更，重新创建会话`);
          await this.destroySession(userId);
        } else {
          // Token 相同，更新访问时间并返回现有会话
          existingSession.lastAccessTime = Date.now();
          log('INFO', `[${userId}] 复用现有会话`);
          return existingSession;
        }
      }

      // 创建新会话
      log('INFO', `[${userId}] 创建新会话`);

      // 获取签名
      const signData = await this.requestGameSign(uid, token);
      if (!signData) {
        throw new Error('获取 IM 签名失败');
      }

      // 创建会话实例
      const session = new IMSession(
        userId,
        uid,
        token,
        signData.appId,
        signData.sign
      );

      // 初始化会话
      await session.init((data) => this.broadcastToClients(data));

      // 保存会话
      this.sessions.set(userId, session);
      log('INFO', `[${userId}] ✓ 会话创建成功 (当前会话数: ${this.sessions.size})`);

      return session;
    });
  }

  /**
   * 获取已存在的会话
   */
  getSession(userId) {
    const session = this.sessions.get(userId);
    if (session) {
      session.lastAccessTime = Date.now();
    }
    return session;
  }

  /**
   * 销毁会话
   */
  async destroySession(userId) {
    return await lock.acquire(`session:${userId}`, async () => {
      const session = this.sessions.get(userId);
      if (session) {
        await session.destroy();
        this.sessions.delete(userId);
        log('INFO', `[${userId}] 会话已移除 (当前会话数: ${this.sessions.size})`);
        return true;
      }
      return false;
    });
  }

  /**
   * 请求游戏签名
   */
  async requestGameSign(uid, token) {
    try {
      const url = `${API_BASE}/user/game_sign`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, token })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      if (result.code !== 1 || !result.data) {
        throw new Error(`API 返回错误: ${result.msg || 'Unknown error'}`);
      }

      log('INFO', '✓ 获取 IM 签名成功');
      return {
        appId: result.data.appid,
        sign: result.data.sign
      };
    } catch (error) {
      log('ERROR', '✗ 获取 IM 签名失败:', error.message);
      return null;
    }
  }

  /**
   * 广播消息到所有 WebSocket 客户端
   */
  broadcastToClients(data) {
    const message = JSON.stringify(data);
    this.wsClients.forEach(client => {
      if (client.readyState === 1) { // WebSocket.OPEN
        try {
          client.send(message);
        } catch (error) {
          log('ERROR', 'WebSocket 发送失败:', error.message);
        }
      }
    });
  }

  /**
   * 添加 WebSocket 客户端
   */
  addWebSocketClient(ws) {
    if (this.wsClients.size >= MAX_WS_CONNECTIONS) {
      throw new Error(`WebSocket 连接数已达上限 (${MAX_WS_CONNECTIONS})`);
    }
    this.wsClients.add(ws);
    log('INFO', `WebSocket 客户端已添加 (当前连接数: ${this.wsClients.size})`);
  }

  /**
   * 移除 WebSocket 客户端
   */
  removeWebSocketClient(ws) {
    this.wsClients.delete(ws);
    log('INFO', `WebSocket 客户端已移除 (当前连接数: ${this.wsClients.size})`);
  }

  /**
   * 启动会话清理任务
   */
  startCleanupTask() {
    setInterval(async () => {
      log('DEBUG', '开始清理过期会话...');
      const expiredSessions = [];

      for (const [userId, session] of this.sessions) {
        if (session.isExpired()) {
          expiredSessions.push(userId);
        }
      }

      for (const userId of expiredSessions) {
        log('INFO', `[${userId}] 会话已超时，正在清理...`);
        await this.destroySession(userId);
      }

      if (expiredSessions.length > 0) {
        log('INFO', `清理了 ${expiredSessions.length} 个过期会话`);
      }
    }, SESSION_CLEANUP_INTERVAL);
  }

  /**
   * 获取所有会话信息
   */
  getAllSessionsInfo() {
    const info = [];
    for (const session of this.sessions.values()) {
      info.push(session.getInfo());
    }
    return info;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      maxSessions: MAX_SESSIONS,
      wsConnections: this.wsClients.size,
      maxWsConnections: MAX_WS_CONNECTIONS,
      sessions: this.getAllSessionsInfo()
    };
  }
}

// 创建全局会话管理器
const sessionManager = new SessionManager();

/**
 * 处理 UID 格式
 */
function processUid(rawUid) {
  const trimmed = rawUid.trim();
  if (trimmed.startsWith('game_')) {
    return {
      userId: trimmed.replace('game_', ''),
      uid: trimmed
    };
  } else {
    return {
      userId: trimmed,
      uid: `game_${trimmed}`
    };
  }
}

// ============================================================================
// HTTP API 路由
// ============================================================================

/**
 * 管理员登录
 */
app.post('/api/admin/login', (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '用户名和密码不能为空'
      });
    }

    // 使用数据库验证
    const verifyResult = verifyAdmin(username, password);

    if (verifyResult.success) {
      const token = jwt.sign(
        { username, role: 'admin' },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );

      log('INFO', `管理员登录成功: ${username}`);
      res.json({
        success: true,
        message: '登录成功',
        data: {
          token,
          username,
          expiresIn: JWT_EXPIRES_IN
        }
      });
    } else {
      log('WARN', `管理员登录失败: ${username} - ${verifyResult.message}`);
      res.status(401).json({
        success: false,
        message: verifyResult.message
      });
    }
  } catch (error) {
    log('ERROR', '管理员登录错误:', error.message);
    res.status(500).json({
      success: false,
      message: '登录失败'
    });
  }
});

/**
 * 获取所有会话（需要认证）
 */
app.get('/api/admin/sessions', authenticateToken, (req, res) => {
  try {
    const stats = sessionManager.getStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    log('ERROR', '获取会话列表失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 重置管理员密码（需要认证）
 */
app.post('/api/admin/reset-password', authenticateToken, (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const username = req.user.username;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '原密码和新密码不能为空'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码长度不能少于6位'
      });
    }

    const result = resetAdminPassword(username, oldPassword, newPassword);

    if (result.success) {
      log('INFO', `管理员密码重置成功: ${username}`);
      res.json(result);
    } else {
      log('WARN', `管理员密码重置失败: ${username} - ${result.message}`);
      res.status(400).json(result);
    }
  } catch (error) {
    log('ERROR', '密码重置错误:', error.message);
    res.status(500).json({
      success: false,
      message: '密码重置失败'
    });
  }
});

/**
 * 获取连接日志（需要认证）
 */
app.get('/api/admin/logs/connections', authenticateToken, (req, res) => {
  try {
    const {
      userId,
      action,
      status,
      startTime,
      endTime,
      limit = 100,
      offset = 0
    } = req.query;

    const result = getConnectionLogs({
      userId,
      action,
      status,
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取连接日志失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取日志失败'
    });
  }
});

/**
 * 获取指令日志（需要认证）
 */
app.get('/api/admin/logs/commands', authenticateToken, (req, res) => {
  try {
    const {
      userId,
      status,
      startTime,
      endTime,
      limit = 100,
      offset = 0
    } = req.query;

    const result = getCommandLogs({
      userId,
      status,
      startTime: startTime ? parseInt(startTime) : null,
      endTime: endTime ? parseInt(endTime) : null,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取指令日志失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取日志失败'
    });
  }
});

/**
 * 获取日志统计（需要认证）
 */
app.get('/api/admin/logs/stats', authenticateToken, (req, res) => {
  try {
    const result = getLogStats();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取日志统计失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取统计失败'
    });
  }
});

/**
 * 获取实时统计数据（需要认证）
 */
app.get('/api/admin/stats/realtime', authenticateToken, (req, res) => {
  try {
    const result = getRealtimeStats();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取实时统计失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取实时统计失败'
    });
  }
});

/**
 * 获取流量趋势数据（需要认证）
 */
app.get('/api/admin/stats/traffic-trend', authenticateToken, (req, res) => {
  try {
    const range = req.query.range || 'day';
    const result = getTrafficTrend(range);

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取流量趋势失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取流量趋势失败'
    });
  }
});

/**
 * 获取系统指标（需要认证）
 */
app.get('/api/admin/stats/system-metrics', authenticateToken, async (req, res) => {
  try {
    const result = await getSystemMetrics();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    log('ERROR', '获取系统指标失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取系统指标失败'
    });
  }
});

app.get('/api/admin/reports/overview', authenticateToken, (req, res) => {
  try {
    const report = getOverviewReport(req.query);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    log('ERROR', '获取报表总览失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表总览失败'
    });
  }
});

app.get('/api/admin/reports/trends', authenticateToken, (req, res) => {
  try {
    const metric = req.query.metric || 'messageCount';
    const series = getTrendReport(req.query, metric);
    res.json({
      success: true,
      data: series
    });
  } catch (error) {
    log('ERROR', '获取报表趋势失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表趋势失败'
    });
  }
});

app.get('/api/admin/reports/distributions', authenticateToken, (req, res) => {
  try {
    const metric = req.query.metric || 'commandStatus';
    const report = getDistributionReport(req.query, metric);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    log('ERROR', '获取报表分布失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表分布失败'
    });
  }
});

app.get('/api/admin/reports/rankings', authenticateToken, (req, res) => {
  try {
    const metric = req.query.metric || 'topCommands';
    const report = getRankingReport(req.query, metric);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    log('ERROR', '获取报表排行失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表排行失败'
    });
  }
});

app.get('/api/admin/reports/details', authenticateToken, (req, res) => {
  try {
    const type = req.query.type || 'commands';
    const report = getDetailReport(req.query, type);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    log('ERROR', '获取报表明细失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表明细失败'
    });
  }
});

app.get('/api/admin/reports/summary', authenticateToken, (req, res) => {
  try {
    const summary = getSummaryReport(req.query);
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    log('ERROR', '获取报表摘要失败:', error.message);
    res.status(500).json({
      success: false,
      message: '获取报表摘要失败'
    });
  }
});

app.post('/api/admin/reports/export', authenticateToken, (req, res) => {
  try {
    const query = normalizeReportQuery(req.body || {});
    const type = req.body?.type || 'commands';
    const format = req.body?.format || 'csv';

    if (format !== 'csv') {
      return res.status(400).json({
        success: false,
        message: '当前仅支持 CSV 导出'
      });
    }

    const exported = buildCsvExport(query, type);
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.filename}"`);
    res.send(exported.body);
  } catch (error) {
    log('ERROR', '导出报表失败:', error.message);
    res.status(500).json({
      success: false,
      message: '导出报表失败'
    });
  }
});

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  const stats = sessionManager.getStats();
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    stats
  });
});

/**
 * 获取状态（向后兼容）
 */
app.get('/api/status', (req, res) => {
  const stats = sessionManager.getStats();
  res.json({
    stats,
    // 向后兼容字段
    isReady: stats.totalSessions > 0
  });
});

/**
 * 发送指令（需要提供 userId）
 */
app.post('/api/send-command', async (req, res) => {
  try {
    const { userId, commandId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少 userId 参数'
      });
    }

    if (!commandId) {
      return res.status(400).json({
        success: false,
        message: '缺少 commandId 参数'
      });
    }

    // 获取会话
    const session = sessionManager.getSession(userId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在，请先登录'
      });
    }

    if (!session.isReady) {
      return res.status(503).json({
        success: false,
        message: 'IM 会话未就绪'
      });
    }

    // 发送消息并记录响应时间
    const startTime = Date.now();
    const result = await session.sendMessage(commandId);
    const responseTime = Date.now() - startTime;

    // 记录指令日志（包含响应时间）
    logCommand(userId, commandId, 'success', '指令发送成功', responseTime);

    res.json(result);
  } catch (error) {
    log('ERROR', 'API 错误:', error.message);

    // 记录失败日志（响应时间为null表示失败）
    const { userId, commandId } = req.body;
    if (userId && commandId) {
      logCommand(userId, commandId, 'failed', error.message, null);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 登录（创建或复用会话）
 */
app.post('/api/login', async (req, res) => {
  try {
    const { uid: rawUid, token } = req.body;

    if (!rawUid || !token) {
      return res.status(400).json({
        success: false,
        message: '缺少 uid 或 token 参数'
      });
    }

    const { userId, uid } = processUid(rawUid);
    const clientIp = req.ip || req.connection.remoteAddress;
    log('INFO', `收到登录请求: UID=${uid}, UserID=${userId}`);

    // 获取或创建会话
    const session = await sessionManager.getOrCreateSession(userId, uid, token);

    // 记录连接日志
    logConnection(userId, uid, 'login', 'success', 'IM 登录成功', clientIp);

    res.json({
      success: true,
      message: 'IM 登录成功',
      data: {
        userId: session.userId,
        uid: session.uid,
        appId: session.appId,
        isReady: session.isReady
      }
    });
  } catch (error) {
    log('ERROR', '✗ IM 登录失败:', error.message);

    // 记录失败日志
    const { uid: rawUid } = req.body;
    if (rawUid) {
      const { userId, uid } = processUid(rawUid);
      const clientIp = req.ip || req.connection.remoteAddress;
      logConnection(userId, uid, 'login', 'failed', error.message, clientIp);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 登出（销毁会话）
 */
app.post('/api/logout', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: '缺少 userId 参数'
      });
    }

    const session = sessionManager.getSession(userId);
    const uid = session ? session.uid : userId;
    const clientIp = req.ip || req.connection.remoteAddress;

    const destroyed = await sessionManager.destroySession(userId);

    if (destroyed) {
      // 记录登出日志
      logConnection(userId, uid, 'logout', 'success', '登出成功', clientIp);

      res.json({
        success: true,
        message: '登出成功'
      });
    } else {
      // 记录失败日志
      logConnection(userId, uid, 'logout', 'failed', '会话不存在', clientIp);

      res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }
  } catch (error) {
    log('ERROR', '登出失败:', error.message);

    // 记录失败日志
    const { userId } = req.body;
    if (userId) {
      const clientIp = req.ip || req.connection.remoteAddress;
      logConnection(userId, userId, 'logout', 'failed', error.message, clientIp);
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * 获取会话详情
 */
app.get('/api/session/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const session = sessionManager.getSession(userId);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: '会话不存在'
      });
    }

    res.json({
      success: true,
      data: session.getInfo()
    });
  } catch (error) {
    log('ERROR', '获取会话详情失败:', error.message);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================================================
// WebSocket 消息处理
// ============================================================================

/**
 * 处理 WebSocket 消息
 */
async function handleWebSocketMessage(ws, message) {
  try {
    const data = JSON.parse(message);
    log('INFO', 'WebSocket 收到消息:', data.type, data.userId ? `(用户: ${data.userId})` : '');

    switch (data.type) {
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        break;

      case 'getStatus':
        const stats = sessionManager.getStats();
        ws.send(JSON.stringify({
          type: 'status',
          data: stats
        }));
        break;

      case 'login':
        if (!data.uid || !data.token) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 uid 或 token 参数'
          }));
          return;
        }

        try {
          const { userId, uid } = processUid(data.uid);
          log('INFO', `WebSocket 收到登录请求: UID=${uid}, UserID=${userId}`);

          const session = await sessionManager.getOrCreateSession(userId, uid, data.token);
          
          // 非管理后台连接才记录日志
          if (!ws.isAdmin) {
            logConnection(userId, uid, 'login', 'success', 'WebSocket IM 登录成功', session.userId);
          }

          ws.send(JSON.stringify({
            type: 'loginResult',
            success: true,
            message: 'IM 登录成功',
            data: {
              userId: session.userId,
              uid: session.uid,
              appId: session.appId,
              isReady: session.isReady
            }
          }));
        } catch (error) {
          // 非管理后台连接才记录失败日志
          if (!ws.isAdmin && data.uid) {
            try {
              const { userId, uid } = processUid(data.uid);
              logConnection(userId, uid, 'login', 'failed', `WebSocket登录失败: ${error.message}`, userId);
            } catch (e) {
              // 如果uid解析失败，记录通用日志
              logConnection('unknown', 'unknown', 'login', 'failed', `WebSocket登录失败-UID解析错误: ${error.message}`, "");
            }
          }
          ws.send(JSON.stringify({
            type: 'loginResult',
            success: false,
            message: error.message
          }));
        }
        break;

      case 'logout':
        if (!data.userId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 userId 参数'
          }));
          return;
        }

        try {
          const destroyed = await sessionManager.destroySession(data.userId);
          ws.send(JSON.stringify({
            type: 'logoutResult',
            success: destroyed,
            message: destroyed ? '登出成功' : '会话不存在'
          }));
          logConnection(data.userId, "game_"+data.userId, 'logout', 'success', 'WebSocket IM 登出成功', data.userId);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'logoutResult',
            success: false,
            message: error.message
          }));
        }
        break;

      case 'sendCommand':
        if (!data.userId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 userId 参数'
          }));
          return;
        }

        if (!data.commandId) {
          ws.send(JSON.stringify({
            type: 'error',
            message: '缺少 commandId 参数'
          }));
          return;
        }

        try {
          const session = sessionManager.getSession(data.userId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'error',
              message: '会话不存在，请先登录'
            }));
            return;
          }

          if (!session.isReady) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'IM 会话未就绪'
            }));
            return;
          }

          const startTime = Date.now();
          const result = await session.sendMessage(data.commandId);
          const responseTime = Date.now() - startTime;
          
          ws.send(JSON.stringify({
            type: 'commandResult',
            success: true,
            data: result
          }));
          
          // 记录指令日志（包含响应时间）
          logCommand(data.userId, data.commandId, 'success', '指令发送成功', responseTime);
        } catch (error) {
          ws.send(JSON.stringify({
            type: 'commandResult',
            success: false,
            message: error.message
          }));
          
          // 记录失败日志
          logCommand(data.userId, data.commandId, 'failed', error.message, null);
        }
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

// ============================================================================
// 服务器启动
// ============================================================================

/**
 * 启动服务器
 */
async function startServer() {
  // 创建 HTTP 服务器
  const server = createServer(app);

  // 创建 WebSocket 服务器
  const wss = new WebSocketServer({ server });

  // WebSocket 连接处理
  wss.on('connection', (ws, req) => {
    const clientIp = req.socket.remoteAddress;
    const url = new URL(req.url, 'http://localhost');
    const isAdmin = url.searchParams.get('admin') === 'true';
    
    // 将isAdmin存储到ws对象，供消息处理使用
    ws.isAdmin = isAdmin;

    try {
      sessionManager.addWebSocketClient(ws);
      log('INFO', `WebSocket 客户端连接: ${clientIp}${isAdmin ? ' (管理后台)' : ''}`);


      // 发送欢迎消息
      ws.send(JSON.stringify({
        type: 'connected',
        message: 'WebSocket 连接成功',
        data: sessionManager.getStats()
      }));

      // 消息处理
      ws.on('message', (message) => {
        handleWebSocketMessage(ws, message.toString()).catch(error => {
          log('ERROR', 'WebSocket 消息处理异常:', error);
        });
      });

      // 错误处理
      ws.on('error', (error) => {
        log('ERROR', 'WebSocket 错误:', error.message);
      });

      // 断开连接
      ws.on('close', () => {
        log('INFO', `WebSocket 客户端断开: ${clientIp}${ws.isAdmin ? ' (管理后台)' : ''}`);
        sessionManager.removeWebSocketClient(ws);
        
        // 非管理后台连接才记录日志
        if (!ws.isAdmin) {
          logConnection(clientIp, 'N/A', 'ws_disconnect', 'success', 'WebSocket连接断开', clientIp);
        }
      });
    } catch (error) {
      log('ERROR', 'WebSocket 连接失败:', error.message);
      ws.close(1008, error.message);
    }
  });

  // 启动服务器
  server.listen(PORT, () => {
    log('INFO', '='.repeat(60));
    log('INFO', 'IM 多用户并发安全服务已启动');
    log('INFO', `HTTP 服务: http://localhost:${PORT}`);
    log('INFO', `WebSocket 服务: ws://localhost:${PORT}`);
    log('INFO', `健康检查: http://localhost:${PORT}/health`);
    log('INFO', `状态查询: http://localhost:${PORT}/api/status`);
    log('INFO', '='.repeat(60));
    log('INFO', `最大会话数: ${MAX_SESSIONS}`);
    log('INFO', `最大 WS 连接数: ${MAX_WS_CONNECTIONS}`);
    log('INFO', `会话超时: ${SESSION_TIMEOUT / 1000 / 60} 分钟`);
    log('INFO', '='.repeat(60));
  });

  // 定期心跳
  setInterval(() => {
    const stats = sessionManager.getStats();
    log('DEBUG', `心跳: ${stats.totalSessions} 个活跃会话, ${stats.wsConnections} 个 WebSocket 连接`);

    sessionManager.broadcastToClients({
      type: 'heartbeat',
      data: {
        timestamp: Date.now(),
        stats
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

  // 销毁所有会话
  const sessions = Array.from(sessionManager.sessions.keys());
  for (const userId of sessions) {
    await sessionManager.destroySession(userId);
  }

  // 关闭数据库连接
  closeDatabase();

  log('INFO', '所有会话已关闭');
  process.exit(0);
});

// 启动
startServer().catch(error => {
  log('ERROR', '启动失败:', error);
  process.exit(1);
});
