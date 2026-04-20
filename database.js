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
    const overview = getReportOverviewStats({
      presetRange: 'today',
      granularity: 'hour'
    });

    return {
      success: true,
      data: {
        onlineUsers: overview.onlineUsers,
        todayMessages: overview.todayMessages,
        errorRate: overview.errorRate,
        avgResponseTime: overview.avgResponseTime,
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
    const rangePresetMap = {
      day: { presetRange: 'today', granularity: 'hour', interval: '1小时' },
      week: { presetRange: 'last7days', granularity: 'hour', interval: '1小时' },
      month: { presetRange: 'last30days', granularity: 'day', interval: '1天' },
      year: { presetRange: 'thisMonth', granularity: 'week', interval: '1周' }
    };
    const config = rangePresetMap[range] || rangePresetMap.day;
    const trend = getReportTrendPoints(config, 'messageCount').map(item => ({
      time: item.time,
      count: item.value,
      timestamp: item.extra.timestamp
    }));

    return {
      success: true,
      data: {
        trend,
        range,
        interval: config.interval
      }
    };
  } catch (error) {
    console.error('[数据库] 获取流量趋势失败:', error);
    return { success: false, message: '获取趋势失败' };
  }
}

function toTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function getPresetRangeWindow(presetRange = 'today') {
  const now = Date.now();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  switch (presetRange) {
    case 'realtime':
      return {
        startTime: now - (60 * 60 * 1000),
        endTime: now
      };
    case 'last7days':
      return {
        startTime: now - (7 * 24 * 60 * 60 * 1000),
        endTime: now
      };
    case 'last30days':
      return {
        startTime: now - (30 * 24 * 60 * 60 * 1000),
        endTime: now
      };
    case 'thisMonth': {
      const monthStart = new Date();
      monthStart.setDate(1);
      monthStart.setHours(0, 0, 0, 0);
      return {
        startTime: monthStart.getTime(),
        endTime: now
      };
    }
    case 'today':
    default:
      return {
        startTime: todayStart.getTime(),
        endTime: now
      };
  }
}

function resolveReportWindow(query = {}) {
  const customStart = toTimestamp(query.startTime);
  const customEnd = toTimestamp(query.endTime);

  if (customStart && customEnd && customEnd >= customStart) {
    return {
      startTime: customStart,
      endTime: customEnd
    };
  }

  return getPresetRangeWindow(query.presetRange);
}

function buildCommandWhereClause(query = {}) {
  const { startTime, endTime } = resolveReportWindow(query);
  const clauses = ['created_at >= ?', 'created_at <= ?'];
  const params = [startTime, endTime];

  if (query.userId) {
    clauses.push('user_id = ?');
    params.push(query.userId);
  }

  const commandType = query.commandType && query.commandType !== 'all' ? query.commandType : null;
  if (commandType) {
    clauses.push('command_id = ?');
    params.push(commandType);
  }

  const commandStatus = query.commandStatus && query.commandStatus !== 'all' ? query.commandStatus : null;
  if (commandStatus) {
    clauses.push('status = ?');
    params.push(commandStatus);
  }

  if (query.latencyMin > 0) {
    clauses.push('response_time >= ?');
    params.push(query.latencyMin);
  }

  if (query.latencyMax > 0) {
    clauses.push('response_time <= ?');
    params.push(query.latencyMax);
  }

  return {
    startTime,
    endTime,
    whereClause: clauses.join(' AND '),
    params
  };
}

function buildConnectionWhereClause(query = {}) {
  const { startTime, endTime } = resolveReportWindow(query);
  const clauses = ['created_at >= ?', 'created_at <= ?'];
  const params = [startTime, endTime];

  if (query.userId) {
    clauses.push('user_id = ?');
    params.push(query.userId);
  }

  return {
    startTime,
    endTime,
    whereClause: clauses.join(' AND '),
    params
  };
}

function getPercentile(values, percentile) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1);
  return sorted[index];
}

function formatTrendLabel(timestamp, granularity) {
  const time = new Date(timestamp);

  if (granularity === 'week') {
    return time.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  if (granularity === 'month') {
    return time.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit' });
  }

  if (granularity === 'day') {
    return time.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit' });
  }

  return `${time.getHours().toString().padStart(2, '0')}:00`;
}

function resolveTrendConfig(granularity = 'hour', windowStart, windowEnd) {
  const duration = Math.max(1, windowEnd - windowStart);

  if (granularity === 'month') {
    return {
      step: 30 * 24 * 60 * 60 * 1000,
      bucketCount: Math.max(1, Math.ceil(duration / (30 * 24 * 60 * 60 * 1000)))
    };
  }

  if (granularity === 'week') {
    return {
      step: 7 * 24 * 60 * 60 * 1000,
      bucketCount: Math.max(1, Math.ceil(duration / (7 * 24 * 60 * 60 * 1000)))
    };
  }

  if (granularity === 'day') {
    return {
      step: 24 * 60 * 60 * 1000,
      bucketCount: Math.max(1, Math.ceil(duration / (24 * 60 * 60 * 1000)))
    };
  }

  return {
    step: 60 * 60 * 1000,
    bucketCount: Math.max(1, Math.ceil(duration / (60 * 60 * 1000)))
  };
}

export function getReportOverviewStats(query = {}) {
  try {
    const commandFilter = buildCommandWhereClause(query);
    const connectionFilter = buildConnectionWhereClause(query);

    const onlineUsers = db.prepare(
      `SELECT COUNT(DISTINCT user_id) AS count
       FROM connection_logs
       WHERE ${connectionFilter.whereClause} AND action = ? AND status = ?`
    ).get(...connectionFilter.params, 'login', 'success');

    const activeUsers = db.prepare(
      `SELECT COUNT(DISTINCT user_id) AS count
       FROM command_logs
       WHERE ${commandFilter.whereClause}`
    ).get(...commandFilter.params);

    const totalCommands = db.prepare(
      `SELECT COUNT(*) AS count
       FROM command_logs
       WHERE ${commandFilter.whereClause}`
    ).get(...commandFilter.params);

    const successCommands = db.prepare(
      `SELECT COUNT(*) AS count
       FROM command_logs
       WHERE ${commandFilter.whereClause} AND status = ?`
    ).get(...commandFilter.params, 'success');

    const failedCommands = db.prepare(
      `SELECT COUNT(*) AS count
       FROM command_logs
       WHERE ${commandFilter.whereClause} AND status = ?`
    ).get(...commandFilter.params, 'failed');

    const avgResponseResult = db.prepare(
      `SELECT AVG(response_time) AS avg_time
       FROM command_logs
       WHERE ${commandFilter.whereClause} AND status = ? AND response_time IS NOT NULL`
    ).get(...commandFilter.params, 'success');

    const responseSamples = db.prepare(
      `SELECT response_time
       FROM command_logs
       WHERE ${commandFilter.whereClause} AND status = ? AND response_time IS NOT NULL
       ORDER BY response_time ASC`
    ).all(...commandFilter.params, 'success');

    const responseTimes = responseSamples
      .map(item => item.response_time)
      .filter(value => Number.isFinite(value));

    const total = totalCommands.count || 0;
    const successRate = total > 0 ? Number(((successCommands.count / total) * 100).toFixed(2)) : 0;
    const errorRate = total > 0 ? Number(((failedCommands.count / total) * 100).toFixed(2)) : 0;

    return {
      onlineUsers: onlineUsers.count || 0,
      activeUsers: activeUsers.count || 0,
      todayMessages: total,
      totalCommands: total,
      successRate,
      avgResponseTime: avgResponseResult.avg_time ? Number(avgResponseResult.avg_time.toFixed(2)) : 0,
      p50ResponseTime: getPercentile(responseTimes, 50),
      p95ResponseTime: getPercentile(responseTimes, 95),
      p99ResponseTime: getPercentile(responseTimes, 99),
      errorRate,
      windowStart: commandFilter.startTime,
      windowEnd: commandFilter.endTime
    };
  } catch (error) {
    console.error('[数据库] 获取报表总览失败:', error);
    return {
      onlineUsers: 0,
      activeUsers: 0,
      todayMessages: 0,
      totalCommands: 0,
      successRate: 0,
      avgResponseTime: 0,
      p50ResponseTime: 0,
      p95ResponseTime: 0,
      p99ResponseTime: 0,
      errorRate: 0,
      windowStart: 0,
      windowEnd: 0
    };
  }
}

export function getReportTrendPoints(query = {}, metric = 'messageCount') {
  try {
    const { startTime, endTime } = resolveReportWindow(query);
    const granularity = query.granularity || 'hour';
    const { step, bucketCount } = resolveTrendConfig(granularity, startTime, endTime);
    const points = [];

    for (let index = 0; index < bucketCount; index += 1) {
      const bucketStart = startTime + (index * step);
      const bucketEnd = Math.min(endTime, bucketStart + step);
      const label = formatTrendLabel(bucketStart, granularity);
      let value = 0;

      if (metric === 'activeUsers') {
        const row = db.prepare(
          `SELECT COUNT(DISTINCT user_id) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ?`
        ).get(bucketStart, bucketEnd);
        value = row.count || 0;
      } else if (metric === 'errorRate') {
        const total = db.prepare(
          `SELECT COUNT(*) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ?`
        ).get(bucketStart, bucketEnd);
        const failed = db.prepare(
          `SELECT COUNT(*) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ? AND status = ?`
        ).get(bucketStart, bucketEnd, 'failed');
        value = total.count > 0 ? Number(((failed.count / total.count) * 100).toFixed(2)) : 0;
      } else if (metric === 'successRate') {
        const total = db.prepare(
          `SELECT COUNT(*) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ?`
        ).get(bucketStart, bucketEnd);
        const success = db.prepare(
          `SELECT COUNT(*) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ? AND status = ?`
        ).get(bucketStart, bucketEnd, 'success');
        value = total.count > 0 ? Number(((success.count / total.count) * 100).toFixed(2)) : 0;
      } else if (metric === 'avgResponseTime') {
        const row = db.prepare(
          `SELECT AVG(response_time) AS avg_time
           FROM command_logs
           WHERE created_at >= ? AND created_at < ? AND status = ? AND response_time IS NOT NULL`
        ).get(bucketStart, bucketEnd, 'success');
        value = row.avg_time ? Number(row.avg_time.toFixed(2)) : 0;
      } else {
        const row = db.prepare(
          `SELECT COUNT(*) AS count
           FROM command_logs
           WHERE created_at >= ? AND created_at < ?`
        ).get(bucketStart, bucketEnd);
        value = row.count || 0;
      }

      points.push({
        time: label,
        value,
        extra: {
          timestamp: bucketStart
        }
      });
    }

    return points;
  } catch (error) {
    console.error('[数据库] 获取报表趋势失败:', error);
    return [];
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
