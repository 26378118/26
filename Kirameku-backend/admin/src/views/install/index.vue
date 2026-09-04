<script setup lang="ts">
import { ref, reactive, onMounted } from "vue";
import { useRouter } from "vue-router";
import { message } from "@/utils/message";
import type { FormInstance, FormRules } from "element-plus";
import { getInstallStatus, postInstallInit } from "@/api/install";

defineOptions({
  name: "Install"
});

const router = useRouter();
const loading = ref(false);
const checking = ref(true);
const ruleFormRef = ref<FormInstance>();

const ruleForm = reactive({
  username: "",
  nickname: "",
  password: "",
  confirmPassword: ""
});

const validateConfirm = (_rule, value, callback) => {
  if (value !== ruleForm.password) {
    callback(new Error("两次输入的密码不一致"));
  } else {
    callback();
  }
};

const rules = reactive<FormRules>({
  username: [
    { required: true, message: "请输入用户名", trigger: "blur" },
    { min: 3, max: 50, message: "用户名长度需在 3-50 之间", trigger: "blur" }
  ],
  password: [
    { required: true, message: "请输入密码", trigger: "blur" },
    { min: 6, message: "密码长度至少 6 位", trigger: "blur" }
  ],
  confirmPassword: [
    { required: true, message: "请再次输入密码", trigger: "blur" },
    { validator: validateConfirm, trigger: "blur" }
  ]
});

/** 页面加载时确认系统状态：已初始化则不让进入安装页 */
onMounted(() => {
  getInstallStatus()
    .then(res => {
      if (res?.data?.installed) {
        message("系统已完成初始化，请直接登录", { type: "warning" });
        router.replace("/");
      }
    })
    .catch(() => {
      // 状态接口失败（如后端未启动），仍展示表单，提交时会再次报错
    })
    .finally(() => {
      checking.value = false;
    });
});

const onInstall = async (formEl: FormInstance | undefined) => {
  if (!formEl) return;
  await formEl.validate(valid => {
    if (!valid) return;
    loading.value = true;
    postInstallInit({
      username: ruleForm.username.trim(),
      nickname: ruleForm.nickname.trim(),
      password: ruleForm.password
    })
      .then(res => {
        message(res?.message || "初始化成功", { type: "success" });
        router.replace({
          path: "/login",
          query: { username: res?.data?.username || ruleForm.username.trim() }
        });
      })
      .catch(err => {
        message(
          (err as any)?.response?.data?.detail || "初始化失败，请检查后重试",
          { type: "error" }
        );
      })
      .finally(() => {
        loading.value = false;
      });
  });
};
</script>

<template>
  <div class="install-container">
    <div v-loading="checking" class="install-card">
      <div class="install-head">
        <h2 class="install-title">Kirameku 初始化</h2>
        <p class="install-subtitle">系统尚未初始化，请创建初始管理员账号</p>
      </div>

      <el-form
        ref="ruleFormRef"
        :model="ruleForm"
        :rules="rules"
        size="large"
        @keyup.enter="onInstall(ruleFormRef)"
      >
        <el-form-item prop="username">
          <el-input
            v-model="ruleForm.username"
            placeholder="用户名（登录账号）"
            clearable
          />
        </el-form-item>
        <el-form-item prop="nickname">
          <el-input
            v-model="ruleForm.nickname"
            placeholder="昵称（选填，默认同用户名）"
            clearable
          />
        </el-form-item>
        <el-form-item prop="password">
          <el-input
            v-model="ruleForm.password"
            type="password"
            placeholder="密码（至少 6 位）"
            show-password
            clearable
          />
        </el-form-item>
        <el-form-item prop="confirmPassword">
          <el-input
            v-model="ruleForm.confirmPassword"
            type="password"
            placeholder="确认密码"
            show-password
            clearable
          />
        </el-form-item>
        <el-button
          class="install-submit"
          type="primary"
          :loading="loading"
          @click="onInstall(ruleFormRef)"
        >
          创建管理员并完成安装
        </el-button>
      </el-form>
    </div>
  </div>
</template>

<style scoped lang="scss">
.install-container {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  background: linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%);
}

.install-card {
  width: 420px;
  max-width: 100%;
  padding: 40px 36px 32px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgb(0 0 0 / 0.3);
}

.install-head {
  margin-bottom: 28px;
  text-align: center;
}

.install-title {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: #1f2329;
}

.install-subtitle {
  margin: 10px 0 0;
  font-size: 13px;
  color: #86909c;
}

.install-submit {
  width: 100%;
  margin-top: 6px;
}
</style>
