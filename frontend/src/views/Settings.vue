<template>
  <Layout>
  <div class="settings-container">
    <a-card title="账号设置" :bordered="false">
      <a-tabs>
        <a-tab-pane key="password" tab="修改密码">
          <div class="password-form">
            <a-form
              :model="passwordForm"
              :rules="passwordRules"
              :label-col="{ span: 6 }"
              :wrapper-col="{ span: 12 }"
              @finish="handleResetPassword"
            >
              <a-form-item label="当前密码" name="oldPassword">
                <a-input-password
                  v-model:value="passwordForm.oldPassword"
                  placeholder="请输入当前密码"
                />
              </a-form-item>

              <a-form-item label="新密码" name="newPassword">
                <a-input-password
                  v-model:value="passwordForm.newPassword"
                  placeholder="请输入新密码 (至少6位)"
                />
              </a-form-item>

              <a-form-item label="确认新密码" name="confirmPassword">
                <a-input-password
                  v-model:value="passwordForm.confirmPassword"
                  placeholder="请再次输入新密码"
                />
              </a-form-item>

              <a-form-item :wrapper-col="{ offset: 6, span: 12 }">
                <a-space>
                  <a-button type="primary" html-type="submit" :loading="loading">
                    <template #icon><SaveOutlined /></template>
                    保存修改
                  </a-button>
                  <a-button @click="resetForm">重置</a-button>
                </a-space>
              </a-form-item>
            </a-form>

            <a-alert
              message="密码安全提示"
              description="为了您的账号安全，建议定期修改密码。新密码长度至少6位，建议包含大小写字母、数字和特殊字符。"
              type="info"
              show-icon
              style="margin-top: 24px"
            />
          </div>
        </a-tab-pane>

        <a-tab-pane key="info" tab="账号信息">
          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="用户名">
              {{ username }}
            </a-descriptions-item>
            <a-descriptions-item label="角色">
              管理员
            </a-descriptions-item>
            <a-descriptions-item label="登录时间">
              {{ loginTime }}
            </a-descriptions-item>
            <a-descriptions-item label="Token 有效期">
              24 小时
            </a-descriptions-item>
          </a-descriptions>
        </a-tab-pane>
      </a-tabs>
    </a-card>
  </div>
  </Layout>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { useRouter } from 'vue-router'
import { message, Modal } from 'ant-design-vue'
import Layout from '../components/Layout.vue'
import { SaveOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import api from '../utils/api'

const router = useRouter()
const loading = ref(false)
const username = ref(localStorage.getItem('admin_username') || 'admin')
const loginTime = ref(dayjs().format('YYYY-MM-DD HH:mm:ss'))

const passwordForm = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const validateConfirmPassword = async (_rule, value) => {
  if (value === '') {
    return Promise.reject('请再次输入新密码')
  } else if (value !== passwordForm.newPassword) {
    return Promise.reject('两次输入的密码不一致')
  } else {
    return Promise.resolve()
  }
}

const passwordRules = {
  oldPassword: [
    { required: true, message: '请输入当前密码', trigger: 'blur' }
  ],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' }
  ]
}

const handleResetPassword = async () => {
  loading.value = true
  try {
    const response = await api.resetPassword(
      passwordForm.oldPassword,
      passwordForm.newPassword
    )

    if (response.success) {
      Modal.success({
        title: '密码修改成功',
        content: '您的密码已成功修改，请使用新密码重新登录。',
        onOk: () => {
          // 清除登录信息
          localStorage.removeItem('admin_token')
          localStorage.removeItem('admin_username')
          // 跳转到登录页
          router.push('/login')
        }
      })
    }
  } catch (error) {
    console.error('密码修改失败:', error)
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  passwordForm.oldPassword = ''
  passwordForm.newPassword = ''
  passwordForm.confirmPassword = ''
}
</script>

<style scoped>
.settings-container {
  padding: 24px;
  background: #f0f2f5;
  min-height: calc(100vh - 64px);
}

.password-form {
  max-width: 800px;
  margin: 0 auto;
  padding: 24px 0;
}
</style>
