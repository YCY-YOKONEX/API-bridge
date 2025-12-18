<template>
  <div class="login-container">
    <div class="login-box">
      <div class="login-header">
        <h1>YOKONEX-API-Bridge</h1>
        <p>请登录以继续</p>
      </div>

      <a-form
        ref="formRef"
        :model="formState"
        :rules="rules"
        layout="vertical"
      >
        <a-form-item label="用户名" name="username">
          <a-input
            v-model:value="formState.username"
            size="large"
            placeholder="请输入用户名"
          />
        </a-form-item>

        <a-form-item label="密码" name="password">
          <a-input-password
            v-model:value="formState.password"
            size="large"
            placeholder="请输入密码"
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            size="large"
            block
            :loading="loading"
            @click="handleLogin"
          >
            登录
          </a-button>
        </a-form-item>
      </a-form>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive, h } from 'vue'
import { useRouter } from 'vue-router'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'
import api from '../utils/api'

const router = useRouter()
const loading = ref(false)
const formRef = ref()

const formState = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' }
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  try {
    // 验证表单 - 使用 validateFields 避免 outOfDate 错误
    await formRef.value.validateFields()
    
    loading.value = true
    console.log('表单验证通过，开始登录请求...', { username: formState.username })

    const response = await api.adminLogin(formState.username, formState.password)
    console.log('登录响应:', response)

    if (response.success) {
      localStorage.setItem('admin_token', response.data.token)
      localStorage.setItem('admin_username', response.data.username)
      message.success('登录成功')
      router.push('/')
    } else {
      message.error(response.message || '登录失败')
    }
  } catch (error) {
    console.error('登录过程出错:', error)
    
    // 检查是否是表单验证错误
    if (error && error.errorFields && Array.isArray(error.errorFields) && error.errorFields.length > 0) {
      console.log('表单验证失败:', error.errorFields)
      message.warning('请填写完整的登录信息')
    } else if (error && error.message) {
      // 其他错误（如网络错误、后端返回的错误等）
      message.error(error.message)
    } else {
      message.error('登录失败，请稍后重试')
    }
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.login-box {
  width: 400px;
  padding: 40px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-header h1 {
  font-size: 24px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.login-header p {
  color: #666;
  font-size: 14px;
}

.login-footer {
  margin-top: 20px;
}
</style>
