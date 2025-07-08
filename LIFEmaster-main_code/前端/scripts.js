// API基础配置 - 使用本地地址
const API_BASE_URL = 'http://localhost:5000';

// 提示消息显示函数
function showToast(message, type = 'info', duration = 3000) {
    const toast = document.getElementById('toast');
    if (toast) {
        // 清除之前的样式
        toast.className = 'toast';
        toast.textContent = message;
        
        // 添加类型样式
        toast.classList.add(type, 'show');
        
        // 自动隐藏
        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    }
}

// 显示加载提示
function showLoading(message = '处理中...') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.className = 'toast info show';
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                ${message}
            </div>
        `;
    }
}

// 隐藏加载提示
function hideLoading() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.classList.remove('show');
    }
}

// 获取认证头
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// 处理页面加载完成事件
document.addEventListener('DOMContentLoaded', function() {
    // 获取模态框元素
    const registerModal = document.getElementById('register-modal');
    const loginModal = document.getElementById('login-modal');
    const registerBtn = document.querySelector('.register-btn');
    const loginBtn = document.querySelector('.login-btn');
    const closeBtns = document.querySelectorAll('.close-btn, .close-btn2');
    
    const registerForm = document.getElementById('register-form');
    const loginForm = document.getElementById('login-form');
    
    // 处理注册表单提交
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const errorDiv = document.getElementById('register-error');
            
            // 清除之前的错误提示
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';
            }
            
            // 验证输入
            if (!username || !email || !password) {
                const errorMessage = '请填写完整信息';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                return;
            }

            // 验证用户名长度
            if (username.length < 3) {
                const errorMessage = '用户名至少需要3个字符';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                return;
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                const errorMessage = '请输入有效的邮箱地址';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                return;
            }
            
            if (password !== confirmPassword) {
                const errorMessage = '两次输入的密码不一致';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                // 清空密码输入框
                document.getElementById('reg-password').value = '';
                document.getElementById('confirm-password').value = '';
                document.getElementById('reg-password').focus();
                return;
            }
            
            if (password.length < 6) {
                const errorMessage = '密码长度至少6位';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                document.getElementById('reg-password').focus();
                return;
            }

            // 密码强度验证
            const hasNumber = /\d/.test(password);
            const hasLetter = /[a-zA-Z]/.test(password);
            if (!hasNumber || !hasLetter) {
                const errorMessage = '密码必须包含字母和数字';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'warning');
                return;
            }

            // 显示加载状态
            showLoading('正在注册...');
            
            try {
                const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        username: username,
                        email: email,
                        password: password
                    })
                });
                
                const data = await response.json();
                hideLoading(); // 隐藏加载状态
                
                if (data.code === 0) {
                    showToast('注册成功！正在跳转到登录页面...', 'success', 2000);
                    registerModal.classList.remove('show');
                    registerForm.reset();
                    // 清除错误提示
                    if (errorDiv) {
                        errorDiv.style.display = 'none';
                    }
                    // 自动打开登录弹窗
                    setTimeout(() => {
                        loginModal.classList.add('show');
                        // 自动填入邮箱
                        document.getElementById('login-email').value = email;
                        document.getElementById('login-password').focus();
                    }, 1000);
                } else {
                    let errorMessage = data.msg || '注册失败';
                    
                    // 根据不同错误类型显示不同提示
                    if (errorMessage.includes('邮箱') || errorMessage.includes('email')) {
                        errorMessage = '该邮箱已被注册，请使用其他邮箱或直接登录';
                        document.getElementById('reg-email').focus();
                    } else if (errorMessage.includes('用户名') || errorMessage.includes('username')) {
                        errorMessage = '该用户名已被占用，请更换用户名';
                        document.getElementById('reg-username').focus();
                    }
                    
                    if (errorDiv) {
                        errorDiv.textContent = errorMessage;
                        errorDiv.style.display = 'block';
                    }
                    showToast(errorMessage, 'error');
                }
            } catch (error) {
                hideLoading(); // 隐藏加载状态
                console.error('注册错误:', error);
                let errorMessage;
                
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorMessage = '无法连接到服务器，请检查网络连接或联系管理员';
                } else {
                    errorMessage = '网络错误，请稍后重试';
                }
                
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
            }
        });
    }
    
    // 处理登录表单提交
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('login-email').value.trim();
            const password = document.getElementById('login-password').value;
            const errorDiv = document.getElementById('login-error');
            
            // 清除之前的错误提示
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.textContent = '';
            }
            
            if (!email || !password) {
                const errorMessage = '请填写邮箱和密码';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                
                // 聚焦到第一个空的输入框
                if (!email) {
                    document.getElementById('login-email').focus();
                } else {
                    document.getElementById('login-password').focus();
                }
                return;
            }

            // 验证邮箱格式
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                const errorMessage = '请输入有效的邮箱地址';
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
                document.getElementById('login-email').focus();
                return;
            }

            // 显示加载状态
            showLoading('正在登录...');
            
            try {
                console.log(`尝试登录: ${email}`);
                const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        email: email,
                        password: password
                    })
                });
                
                const data = await response.json();
                hideLoading(); // 隐藏加载状态
                
                if (data.code === 0) {
                    // 保存token和用户信息到本地存储
                    localStorage.setItem('token', data.data.token);
                    localStorage.setItem('user', JSON.stringify(data.data.user));
                    
                    showToast(`欢迎回来，${data.data.user.username}！`, 'success', 2000);
                    loginModal.classList.remove('show');
                    
                    // 清除错误提示
                    if (errorDiv) {
                        errorDiv.style.display = 'none';
                    }
                    
                    // 跳转到主页面
                    setTimeout(() => {
                        window.location.href = 'main.html';
                    }, 1000);
                } else {
                    // 显示具体的错误信息
                    let errorMessage = data.msg || '登录失败';
                    
                    // 根据不同错误类型显示不同提示和处理
                    if (errorMessage.includes('密码') || errorMessage.includes('password')) {
                        errorMessage = '密码错误，请重新输入';
                        document.getElementById('login-password').value = '';
                        document.getElementById('login-password').focus();
                        showToast(errorMessage, 'error');
                    } else if (errorMessage.includes('邮箱') || errorMessage.includes('email') || errorMessage.includes('用户不存在')) {
                        errorMessage = '该邮箱尚未注册，请先注册账号';
                        document.getElementById('login-email').focus();
                        showToast(errorMessage, 'warning');
                        
                        // 提示用户注册
                        setTimeout(() => {
                            if (confirm('该邮箱尚未注册，是否前往注册页面？')) {
                                loginModal.classList.remove('show');
                                setTimeout(() => {
                                    registerModal.classList.add('show');
                                    document.getElementById('reg-email').value = email;
                                    document.getElementById('reg-username').focus();
                                }, 300);
                            }
                        }, 1500);
                    } else if (errorMessage.includes('账号被锁定') || errorMessage.includes('disabled')) {
                        errorMessage = '账号已被锁定，请联系管理员';
                        showToast(errorMessage, 'error');
                    } else {
                        showToast(errorMessage, 'error');
                    }
                    
                    if (errorDiv) {
                        errorDiv.textContent = errorMessage;
                        errorDiv.style.display = 'block';
                    }
                }
            } catch (error) {
                hideLoading(); // 隐藏加载状态
                console.error('登录错误:', error);
                let errorMessage;
                
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    errorMessage = '无法连接到服务器，请检查网络连接';
                } else {
                    errorMessage = '网络错误，请稍后重试';
                }
                
                if (errorDiv) {
                    errorDiv.textContent = errorMessage;
                    errorDiv.style.display = 'block';
                }
                showToast(errorMessage, 'error');
            }
        });
    }

    // 显示注册弹窗
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            registerModal.classList.add('show');
        });
    }

    // 显示登录弹窗
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            loginModal.classList.add('show');
        });
    }

    // 关闭弹窗
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.target.closest('.modal').classList.remove('show');
        });
    });

    // 点击弹窗外部关闭
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.classList.remove('show');
        }
    });
});


