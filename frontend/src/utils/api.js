import axios from 'axios'
import { message, Modal } from 'ant-design-vue'
import smCrypto from 'sm-crypto'

const sm2 = smCrypto.sm2

// SM2 公钥 (前端使用公钥加密)
const SM2_PUBLIC_KEY = '04fa45b30265e9bf0deef6412463ba1fa6abcb8c385793593e0894d146a266a1053d3a2eae9bfb7bea68fa4c9c5decbe32612e797f65cf2f31132b7aba4931c96c'

// SM2 加密模式：1 - C1C3C2，0 - C1C2C3
const SM2_CIPHER_MODE = 1

// Token过期时间（24小时，与后端保持一致）
const TOKEN_EXPIRES_IN = 24 * 60 * 60 * 1000

// Token即将过期提醒时间（提前1小时）
const TOKEN_WARNING_TIME = 60 * 60 * 1000

// 是否已显示过期提醒
let hasShownExpiryWarning = false

// 是否正在处理登出
let isLoggingOut = false

// 网络状态
let isOnline = navigator.onLine

// 监听网络状态变化
window.addEventListener('online', () => {
  isOnline = true
  message.success('网络连接已恢复')
})

window.addEventListener('offline', () => {
  isOnline = false
  message.error('网络连接已断开，请检查网络设置')
})

// 请求重试配置
const MAX_RETRY_COUNT = 3
const RETRY_DELAY = 1000 // 1秒

/**
 * 延迟函数
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

const api = axios.create({
  baseURL: import.meta.env.DEV ? '' : 'http://47.95.169.74:8080',
  timeout: 10000
})

/**
 * 检查token是否即将过期
 */
function checkTokenExpiry() {
  const token = localStorage.getItem('admin_token')
  const loginTime = localStorage.getItem('admin_login_time')

  if (!token || !loginTime) {
    return
  }

  const now = Date.now()
  const elapsed = now - parseInt(loginTime)
  const remaining = TOKEN_EXPIRES_IN - elapsed

  // 如果剩余时间小于1小时且未提醒过，显示提醒
  if (remaining < TOKEN_WARNING_TIME && remaining > 0 && !hasShownExpiryWarning) {
    hasShownExpiryWarning = true
    const minutes = Math.floor(remaining / 60000)
    message.warning(`您的登录状态将在 ${minutes} 分钟后过期，请注意保存工作`, 10)
  }

  // 如果已过期，自动登出
  if (remaining <= 0) {
    handleTokenExpired()
  }
}

/**
 * 处理token过期
 */
function handleTokenExpired() {
  if (isLoggingOut) return
  isLoggingOut = true

  localStorage.removeItem('admin_token')
  localStorage.removeItem('admin_login_time')
  hasShownExpiryWarning = false

  Modal.warning({
    title: '登录已过期',
    content: '您的登录状态已过期，请重新登录',
    okText: '重新登录',
    onOk: () => {
      isLoggingOut = false
      window.location.href = '/login'
    }
  })
}

// 每分钟检查一次token过期状态
setInterval(checkTokenExpiry, 60000)

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
      // 每次请求时检查token是否即将过期
      checkTokenExpiry()
    }
    return config
  },
  error => {
    return Promise.reject(error)
  }
)

// 响应拦截器
api.interceptors.response.use(
  response => {
    return response.data
  },
  async error => {
    const config = error.config

    // 如果没有配置或已经重试过最大次数，直接返回错误
    if (!config || config.__retryCount >= MAX_RETRY_COUNT) {
      handleResponseError(error)
      return Promise.reject(error)
    }

    // 初始化重试计数
    config.__retryCount = config.__retryCount || 0

    // 检查是否应该重试
    const shouldRetry = shouldRetryRequest(error)

    if (shouldRetry) {
      config.__retryCount += 1
      console.log(`请求失败，正在进行第 ${config.__retryCount} 次重试...`)

      // 等待一段时间后重试
      await delay(RETRY_DELAY * config.__retryCount)

      // 重新发起请求
      return api(config)
    }

    handleResponseError(error)
    return Promise.reject(error)
  }
)

/**
 * 判断是否应该重试请求
 */
function shouldRetryRequest(error) {
  // 如果是网络错误或超时，应该重试
  if (!error.response) {
    return isOnline // 只有在在线状态下才重试
  }

  const status = error.response.status

  // 5xx 服务器错误应该重试
  if (status >= 500 && status < 600) {
    return true
  }

  // 408 请求超时应该重试
  if (status === 408) {
    return true
  }

  // 429 请求过多应该重试
  if (status === 429) {
    return true
  }

  // 其他情况不重试
  return false
}

/**
 * 处理响应错误
 */
function handleResponseError(error) {
  if (error.response) {
    const status = error.response.status
    const errorMessage = error.response.data?.message || '请求失败'

    if (status === 401) {
      // 401: 未认证或token无效
      handleTokenExpired()
    } else if (status === 403) {
      // 403: 权限不足或token过期
      if (errorMessage.includes('过期') || errorMessage.includes('无效')) {
        handleTokenExpired()
      } else {
        message.error('没有权限访问此资源')
      }
    } else if (status === 500) {
      message.error(`服务器错误: ${errorMessage}`)
      console.error('服务器错误详情:', error.response.data)
    } else if (status === 404) {
      message.error('请求的资源不存在')
    } else if (status === 429) {
      message.error('请求过于频繁，请稍后再试')
    } else {
      message.error(errorMessage)
    }
  } else if (error.code === 'ECONNABORTED') {
    message.error('请求超时，请检查网络连接')
  } else if (error.message === 'Network Error') {
    if (!isOnline) {
      message.error('网络连接已断开，请检查网络设置')
    } else {
      message.error('网络连接失败，请稍后重试')
    }
  } else {
    message.error('请求失败，请稍后重试')
  }
}

export default {
  // 管理员登录 (密码使用 SM2 公钥加密)
  adminLogin(username, password) {
    try {
      console.log('准备使用SM2公钥加密密码...')
      // 前端使用公钥加密密码
      const encryptedPassword = sm2.doEncrypt(password, SM2_PUBLIC_KEY, SM2_CIPHER_MODE)
      console.log('密码加密成功,发送登录请求到 /api/admin/login')
      return api.post('/api/admin/login', { username, password: encryptedPassword })
    } catch (error) {
      console.error('SM2 加密失败:', error)
      throw new Error('密码加密失败: ' + error.message)
    }
  },

  // 重置密码
  resetPassword(oldPassword, newPassword) {
    // 前端使用公钥加密密码
    const encryptedOldPassword = sm2.doEncrypt(oldPassword, SM2_PUBLIC_KEY, SM2_CIPHER_MODE)
    const encryptedNewPassword = sm2.doEncrypt(newPassword, SM2_PUBLIC_KEY, SM2_CIPHER_MODE)
    return api.post('/api/admin/reset-password', {
      oldPassword: encryptedOldPassword,
      newPassword: encryptedNewPassword
    })
  },

  // 获取健康状态
  getHealth() {
    return api.get('/health')
  },

  // 获取所有会话
  getSessions() {
    return api.get('/api/admin/sessions')
  },

  // 断开用户连接
  disconnectUser(userId) {
    return api.post('/api/logout', { userId })
  },

  // 获取会话详情
  getSessionDetail(userId) {
    return api.get(`/api/session/${userId}`)
  },

  // 获取连接日志
  getConnectionLogs(params = {}) {
    return api.get('/api/admin/logs/connections', { params })
  },

  // 获取指令日志
  getCommandLogs(params = {}) {
    return api.get('/api/admin/logs/commands', { params })
  },

  // 获取日志统计
  getLogStats() {
    return api.get('/api/admin/logs/stats')
  },

  // 获取实时统计数据
  getRealtimeStats() {
    return api.get('/api/admin/stats/realtime')
  },

  // 获取流量趋势数据
  getTrafficTrend(range = 'day') {
    return api.get('/api/admin/stats/traffic-trend', { params: { range } })
  },

  // 获取系统指标
  getSystemMetrics() {
    return api.get('/api/admin/stats/system-metrics')
  }
}
