import axios from 'axios'
import { message } from 'ant-design-vue'
import smCrypto from 'sm-crypto'

const sm2 = smCrypto.sm2

// SM2 公钥 (前端使用公钥加密)
const SM2_PUBLIC_KEY = '04fa45b30265e9bf0deef6412463ba1fa6abcb8c385793593e0894d146a266a1053d3a2eae9bfb7bea68fa4c9c5decbe32612e797f65cf2f31132b7aba4931c96c'

// SM2 加密模式：1 - C1C3C2，0 - C1C2C3
const SM2_CIPHER_MODE = 1

const api = axios.create({
  baseURL: import.meta.env.DEV ? '' : 'http://47.95.169.74:8080',
  timeout: 10000
})

// 请求拦截器
api.interceptors.request.use(
  config => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
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
  error => {
    if (error.response) {
      const status = error.response.status
      if (status === 401) {
        localStorage.removeItem('admin_token')
        window.location.href = '/login'
        message.error('登录已过期,请重新登录')
      } else if (status === 403) {
        message.error('没有权限访问')
      } else {
        message.error(error.response.data?.message || '请求失败')
      }
    } else {
      message.error('网络错误,请检查连接')
    }
    return Promise.reject(error)
  }
)

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
