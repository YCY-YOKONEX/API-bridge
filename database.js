import Database from 'better-sqlite3';
import pkg from 'sm-crypto';
const { sm2 } = pkg;
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import os from 'os';
import checkDiskSpace from 'check-disk-space';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// SM2 密钥配置
// 公钥用于加密（前端使用）
const SM2_PUBLIC_KEY = process.env.SM2_PUBLIC_KEY || '04fa45b30265e9bf0deef6412463ba1fa6abcb8c385793593e0894d146a266a1053d3a2eae9bfb7bea68fa4c9c5decbe32612e797f65cf2f31132b7aba4931c96c';
// 私钥用于解密（后端使用）
const SM2_PRIVATE_KEY = process.env.SM2_PRIVATE_KEY || 'd86fdbbee6a245da65ab1fa57739b2cca57e5985949cb50cb240cf9e38f877e5';

// SM2 解密模式：1 - C1C3C2，0 - C1C2C3 (必须与前端一致)
const SM2_CIPHER_MODE = 1;

// 创建数据库连接
const db = new Database(join(__dirname, 'im-service.db'));

// 启用 WAL 模式以提高并发性能
db.pragma('journal_mode = WAL');

/**
 * 初始化数据库表
 */
export function initDatabase() {
  // 创建管理员表
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  // 创建连接日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS connection_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      uid TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      ip_address TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  // 创建指令日志表
  db.exec(`
    CREATE TABLE IF NOT EXISTS command_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      command_id TEXT NOT NULL,
      status TEXT NOT NULL,
      message TEXT,
      response_time INTEGER,
      created_at INTEGER NOT NULL
    )
  `);

  // 创建索引
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_connection_logs_user_id ON connection_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_connection_logs_created_at ON connection_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_command_logs_user_id ON command_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_command_logs_created_at ON command_logs(created_at);
  `);

  // 如果表已存在，添加response_time字段（兼容旧数据库）
  try {
    db.exec(`ALTER TABLE command_logs ADD COLUMN response_time INTEGER`);
    console.log('[数据库] 已添加response_time字段到command_logs表');
  } catch (error) {
    // 字段已存在，忽略错误
  }

  // 检查是否存在默认管理员
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get('admin');

  if (!admin) {
    // 创建默认管理员 (密码: Admin@123)
    // 使用SM2公钥加密（前端用公钥加密，后端用私钥解密）
    const encryptedPassword = sm2.doEncrypt('Admin@123', SM2_PUBLIC_KEY, SM2_CIPHER_MODE);
    const now = Date.now();

    db.prepare(`
      INSERT INTO admins (username, password, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run('admin', encryptedPassword, now, now);

    console.log('[数据库] 已创建默认管理员账号: admin / Admin@123');
  }

  console.log('[数据库] 数据库初始化完成');
}

/**
 * 验证管理员登录
 */
export function verifyAdmin(username, password) {
  try {
    const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);

    if (!admin) {
      return { success: false, message: '用户名不存在' };
    }

    // 使用私钥解密前端传来的加密密码
    const decryptedPassword = sm2.doDecrypt(password, SM2_PRIVATE_KEY, SM2_CIPHER_MODE);

    // 解密数据库中的密码（数据库中存储的也是SM2加密后的密码）
    const decryptedDbPassword = sm2.doDecrypt(admin.password, SM2_PRIVATE_KEY, SM2_CIPHER_MODE);

    if (decryptedPassword === decryptedDbPassword) {
      return {
        success: true,
        data: {
          id: admin.id,
          username: admin.username
        }
      };
    } else {
      return { success: false, message: '密码错误' };
    }
  } catch (error) {
    console.error('[数据库] 验证管理员失败:', error);
    return { success: false, message: '验证失败' };
  }
}

/**
 * 重置管理员密码
 */
export function resetAdminPassword(username, oldPassword, newPassword) {
  try {
    // 先验证旧密码
    const verifyResult = verifyAdmin(username, oldPassword);
    if (!verifyResult.success) {
      return { success: false, message: '原密码错误' };
    }

    // 新密码已经由前端使用SM2公钥加密，直接存储即可
    const now = Date.now();

    const result = db.prepare(`
      UPDATE admins
      SET password = ?, updated_at = ?
      WHERE username = ?
    `).run(newPassword, now, username);

    if (result.changes > 0) {
      return { success: true, message: '密码重置成功' };
    } else {
      return { success: false, message: '密码重置失败' };
    }
  } catch (error) {
    console.error('[数据库] 重置密码失败:', error);
    return { success: false, message: '重置失败' };
  }
}

/**
 * 记录连接日志
 */
export function logConnection(userId, uid, action, status, message = null, ipAddress = null) {
  try {
    db.prepare(`
      INSERT INTO connection_logs (user_id, uid, action, status, message, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, uid, action, status, message, ipAddress, Date.now());
  } catch (error) {
    console.error('[数据库] 记录连接日志失败:', error);
  }
}

/**
 * 记录指令日志
 */
export function logCommand(userId, commandId, status, message = null, responseTime = null) {
  try {
    db.prepare(`
      INSERT INTO command_logs (user_id, command_id, status, message, response_time, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, commandId, status, message, responseTime, Date.now());
  } catch (error) {
    console.error('[数据库] 记录指令日志失败:', error);
  }
}

/**
 * 查询连接日志
 */
export function getConnectionLogs(options = {}) {
  try {
    const {
      userId = null,
      action = null,
      status = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = options;

    let query = 'SELECT * FROM connection_logs WHERE 1=1';
    const params = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (startTime) {
      query += ' AND created_at >= ?';
      params.push(startTime);
    }

    if (endTime) {
      query += ' AND created_at <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM connection_logs WHERE 1=1';
    const countParams = [];

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }

    if (action) {
      countQuery += ' AND action = ?';
      countParams.push(action);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (startTime) {
      countQuery += ' AND created_at >= ?';
      countParams.push(startTime);
    }

    if (endTime) {
      countQuery += ' AND created_at <= ?';
      countParams.push(endTime);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    return {
      success: true,
      data: {
        logs,
        total,
        limit,
        offset
      }
    };
  } catch (error) {
    console.error('[数据库] 查询连接日志失败:', error);
    return { success: false, message: '查询失败' };
  }
}

/**
 * 查询指令日志
 */
export function getCommandLogs(options = {}) {
  try {
    const {
      userId = null,
      status = null,
      startTime = null,
      endTime = null,
      limit = 100,
      offset = 0
    } = options;

    let query = 'SELECT * FROM command_logs WHERE 1=1';
    const params = [];

    if (userId) {
      query += ' AND user_id = ?';
      params.push(userId);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (startTime) {
      query += ' AND created_at >= ?';
      params.push(startTime);
    }

    if (endTime) {
      query += ' AND created_at <= ?';
      params.push(endTime);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const logs = db.prepare(query).all(...params);

    // 获取总数
    let countQuery = 'SELECT COUNT(*) as total FROM command_logs WHERE 1=1';
    const countParams = [];

    if (userId) {
      countQuery += ' AND user_id = ?';
      countParams.push(userId);
    }

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (startTime) {
      countQuery += ' AND created_at >= ?';
      countParams.push(startTime);
    }

    if (endTime) {
      countQuery += ' AND created_at <= ?';
      countParams.push(endTime);
    }

    const { total } = db.prepare(countQuery).get(...countParams);

    return {
      success: true,
      data: {
        logs,
        total,
        limit,
        offset
      }
    };
  } catch (error) {
    console.error('[数据库] 查询指令日志失败:', error);
    return { success: false, message: '查询失败' };
  }
}

/**
 * 获取日志统计
 */
export function getLogStats() {
  try {
    const connectionTotal = db.prepare('SELECT COUNT(*) as total FROM connection_logs').get();
    const commandTotal = db.prepare('SELECT COUNT(*) as total FROM command_logs').get();

    const connectionSuccess = db.prepare(
      'SELECT COUNT(*) as total FROM connection_logs WHERE status = ?'
    ).get('success');

    const connectionFailed = db.prepare(
      'SELECT COUNT(*) as total FROM connection_logs WHERE status = ?'
    ).get('failed');

    const commandSuccess = db.prepare(
      'SELECT COUNT(*) as total FROM command_logs WHERE status = ?'
    ).get('success');

    const commandFailed = db.prepare(
      'SELECT COUNT(*) as total FROM command_logs WHERE status = ?'
    ).get('failed');

    return {
      success: true,
      data: {
        connection: {
          total: connectionTotal.total,
          success: connectionSuccess.total,
          failed: connectionFailed.total
        },
        command: {
          total: commandTotal.total,
          success: commandSuccess.total,
          failed: commandFailed.total
        }
      }
    };
  } catch (error) {
    console.error('[数据库] 获取日志统计失败:', error);
    return { success: false, message: '获取统计失败' };
  }
}

/**
 * 获取实时统计数据（用于运营监控）
 */
export function getRealtimeStats() {
  try {
    const now = Date.now();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStartTime = todayStart.getTime();

    // 在线用户（活跃会话数）
    const onlineUsers = db.prepare(
      'SELECT COUNT(DISTINCT user_id) as count FROM connection_logs WHERE action = ? AND status = ? AND created_at >= ?'
    ).get('login', 'success', todayStartTime);

    // 今日消息量（指令日志总数）
    const todayMessages = db.prepare(
      'SELECT COUNT(*) as count FROM command_logs WHERE created_at >= ?'
    ).get(todayStartTime);

    // 错误率（今日失败指令占比）
    const failedCommands = db.prepare(
      'SELECT COUNT(*) as count FROM command_logs WHERE status = ? AND created_at >= ?'
    ).get('failed', todayStartTime);

    const totalCommandsToday = db.prepare(
      'SELECT COUNT(*) as count FROM command_logs WHERE created_at >= ?'
    ).get(todayStartTime);

    const errorRate = totalCommandsToday.count > 0
      ? Number(((failedCommands.count / totalCommandsToday.count) * 100).toFixed(2))
      : 0;

    // 平均响应时间（从今日成功的指令日志中计算）
    const avgResponseResult = db.prepare(
      'SELECT AVG(response_time) as avg_time FROM command_logs WHERE status = ? AND response_time IS NOT NULL AND created_at >= ?'
    ).get('success', todayStartTime);

    const avgResponseTime = avgResponseResult.avg_time ? Number(avgResponseResult.avg_time.toFixed(2)) : 0;

    return {
      success: true,
      data: {
        onlineUsers: onlineUsers.count,
        todayMessages: todayMessages.count,
        errorRate: errorRate,
        avgResponseTime: avgResponseTime,
        timestamp: now
      }
    };
  } catch (error) {
    console.error('[数据库] 获取实时统计失败:', error);
    return { success: false, message: '获取统计失败' };
  }
}

/**
 * 获取流量趋势数据（支持周、月、年）
 */
export function getTrafficTrend(range = 'day') {
  try {
    const now = Date.now();
    let startTime, interval, intervalCount, timeFormat;

    switch (range) {
      case 'week':
        startTime = now - (7 * 24 * 60 * 60 * 1000); // 7天
        interval = 4 * 60 * 60 * 1000; // 4小时间隔
        intervalCount = 42; // 7天 * 6个4小时区间
        timeFormat = 'MM-DD HH:mm';
        break;
      case 'month':
        startTime = now - (30 * 24 * 60 * 60 * 1000); // 30天
        interval = 24 * 60 * 60 * 1000; // 1天间隔
        intervalCount = 30;
        timeFormat = 'MM-DD';
        break;
      case 'year':
        startTime = now - (365 * 24 * 60 * 60 * 1000); // 365天
        interval = 7 * 24 * 60 * 60 * 1000; // 1周间隔
        intervalCount = 52;
        timeFormat = 'YYYY-MM';
        break;
      default: // day - 按小时统计，显示整点数据
        startTime = now - (24 * 60 * 60 * 1000); // 1天
        interval = 60 * 60 * 1000; // 1小时间隔
        intervalCount = 24; // 24小时
        timeFormat = 'HH:00';
        break;
    }

    const trend = [];

    // 按时间间隔分组统计指令日志
    for (let i = 0; i < intervalCount; i++) {
      const intervalStart = startTime + (i * interval);
      const intervalEnd = intervalStart + interval;

      const count = db.prepare(
        `SELECT COUNT(*) as count FROM command_logs 
         WHERE created_at >= ? AND created_at < ?`
      ).get(intervalStart, intervalEnd);

      const time = new Date(intervalStart);
      let timeStr;

      if (range === 'week') {
        timeStr = time.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      } else if (range === 'month') {
        timeStr = time.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' });
      } else if (range === 'year') {
        timeStr = time.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit' });
      } else {
        // day: 显示整点时间，如 00:00, 01:00, 02:00...
        timeStr = `${time.getHours().toString().padStart(2, '0')}:00`;
      }

      trend.push({
        time: timeStr,
        count: count.count,
        timestamp: intervalStart
      });
    }

    return {
      success: true,
      data: {
        trend,
        range,
        interval: range === 'day' ? '1小时' : range === 'week' ? '4小时' : range === 'month' ? '1天' : '1周'
      }
    };
  } catch (error) {
    console.error('[数据库] 获取流量趋势失败:', error);
    return { success: false, message: '获取趋势失败' };
  }
}

/**
 * 获取系统指标（CPU、内存、磁盘使用率）
 */
export async function getSystemMetrics() {
  try {
    // 获取CPU使用率
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });
    const cpuUsage = 100 - ~~(100 * totalIdle / totalTick);

    // 获取内存使用率
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Number(((totalMem - freeMem) / totalMem * 100).toFixed(1));

    // 获取磁盘使用率
    const diskInfo = await checkDiskSpace(__dirname);
    const diskUsage = Number(((diskInfo.size - diskInfo.free) / diskInfo.size * 100).toFixed(1));

    return {
      success: true,
      data: {
        cpu: cpuUsage,
        memory: memoryUsage,
        disk: diskUsage,
        timestamp: Date.now()
      }
    };
  } catch (error) {
    console.error('[数据库] 获取系统指标失败:', error);
    return { success: false, message: '获取指标失败' };
  }
}

/**
 * 关闭数据库连接
 */
export function closeDatabase() {
  db.close();
  console.log('[数据库] 数据库连接已关闭');
}

export default db;
