# LifeMaster - 一站式生活管理应用

![LifeMaster](img/SYSULogo.png)

LifeMaster 是一款集手账记录、任务管理、财务管理、小组协作及社区分享等功能于一体的综合性生活管理应用。在快节奏的现代生活中，我们致力于帮助用户高效规划生活、学习和工作，满足多样化的生活管理需求。

## 📝 项目简介

LifeMaster 旨在解决现代人面临的多重生活管理难题：

- **整合性不足**：避免使用多个不同应用导致的操作繁琐问题
- **资料分散**：统一管理学习和工作资料，提高协作效率
- **功能单一**：提供多元化功能，满足用户在记录、管理、分享等方面的全面需求

### 目标用户群体

- 🎓 **学生群体**：需要记录学习笔记、错题整理，与学习小组共享资料
- 💼 **职场人士**：面临工作任务繁多，需要高效的任务管理和时间规划工具
- 🏠 **自由职业者**：注重个人时间管理和财务管理
- 🎨 **生活爱好者**：喜欢记录生活中的美好瞬间，进行社区互动

## ✨ 主要功能及亮点

### 📔 智能手账系统

- **丰富的编辑功能**
  - 支持多种文字格式设置（字体、字号、颜色、加粗、倾斜等）
  - 图片添加与编辑（缩放、裁剪、旋转、滤镜）
  - 精美贴纸库，支持自由拖拽和调整
- **学习资料管理**
  - 题目与错题记录，支持多种格式
  - 智能分类整理（文件夹分类、标签功能）
  - 快速检索功能
- **协作与分享**
  - 小组共享功能，支持在线查看、评论、点赞
  - 社区分享平台，促进用户互动交流

### ✅ 高效任务管理

- **全面的任务功能**
  - 任务创建、编辑，支持详细描述和优先级设置
  - 多维度分类排序（类型、优先级、截止时间）
  - 智能状态管理（待办、进行中、已完成）
- **智能提醒系统**
  - 自定义提醒时间和方式
  - 消息通知和铃声提醒
- **数据分析**
  - 任务完成率统计
  - 图表化展示，帮助分析管理效率

### 💰 智能财务管理

- **便捷记账功能**
  - 快速记录收入支出，支持批量导入
  - 自定义收支分类和图标
  - 详细备注和时间记录
- **智能分析报表**
  - 自动生成收支明细和月度汇总
  - 可视化财务报告（饼状图、趋势图）
  - 消费习惯分析
- **预算管理**
  - 月度、年度预算设置
  - 实时预算使用情况显示
  - 超预算预警提醒

### 🔥 特色扩展功能

- **番茄钟专注助手**：自定义专注时长，提高工作学习效率
- **小组协作平台**：支持小组创建、成员管理、内容共享
- **社区互动中心**：内容发布、浏览搜索、互动交流

## 🚀 后续发展计划

### 短期规划（3-6个月）

- 🔧 **性能优化**：提升响应速度，优化数据库查询效率
- 📱 **移动端适配**：开发响应式设计，提升移动设备使用体验
- 🔐 **安全加固**：完善用户数据加密，增强系统安全性

### 中期规划（6-12个月）

- 🤖 **AI智能助手**：集成智能推荐算法，个性化内容推送
- 🌐 **多平台同步**：实现跨设备数据同步功能
- 📊 **高级分析**：提供更详细的数据分析和可视化报表

### 长期规划（1年以上）

- 🔌 **第三方集成**：支持与其他常用应用的数据互通
- 🌍 **国际化支持**：多语言版本，拓展海外市场
- 🎯 **企业版本**：针对团队和企业用户的专业版功能

## � 环境要求

### 系统要求

- **操作系统**：Windows 10+, Linux, macOS
- **浏览器**：Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **网络**：稳定的互联网连接

### 开发环境

- **Python**：3.8+
- **Node.js**：14.0+ (可选，用于前端构建)
- **数据库**：MySQL 5.7+ 或 8.0+
- **Web服务器**：支持WSGI的服务器（如Gunicorn、uWSGI）

### 硬件要求

- **内存**：最低2GB RAM，推荐4GB+
- **存储**：至少1GB可用空间
- **处理器**：现代多核处理器

## 📦 安装使用方法

### 快速体验（推荐）

1. **克隆项目仓库**

```bash
git clone https://github.com/cornhub919/LIFEmaster.git
cd LIFEmaster
```

2. **安装Python依赖**

```bash
pip install flask flask-sqlalchemy flask-jwt-extended flask-cors pymysql python-dotenv
```

3. **配置环境变量**
   创建 `.env` 文件：

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=lifemaster
JWT_SECRET_KEY=your-secret-key-123
```

### 数据库配置

1. **启动MySQL服务**

```bash
# Windows
net start mysql

# Linux/macOS
sudo systemctl start mysql
```

2. **创建数据库**

```sql
mysql -u root -p
CREATE DATABASE lifemaster CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
exit;
```

3. **初始化数据表**

```bash
python -c "from app import app, db; app.app_context().push(); db.create_all(); print('Database initialized!')"
```

### 启动应用

1. **启动后端服务**

```bash
python app.py
```

后端服务将在 `http://localhost:5000` 启动

2. **启动前端服务**

```bash
cd frontend
python -m http.server 8080
```

前端页面访问地址：`http://localhost:8080/sign_in.html`

### 测试账户

- **用户名**: admin
- **邮箱**: admin@lifemaster.com
- **密码**: admin123

### API测试

```bash
# 测试登录接口
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lifemaster.com","password":"admin123"}'
```

## 📚 使用指南

1. **首次使用**：访问登录页面，使用测试账户或注册新账户
2. **创建手账**：点击"新建手账"，使用富文本编辑器记录内容
3. **管理任务**：在任务管理模块创建待办事项，设置提醒时间
4. **记录财务**：在财务管理模块记录收支，查看统计报表
5. **小组协作**：创建或加入小组，与成员共享内容

## 🛠️ 技术架构

- **前端**: HTML5 + CSS3 + JavaScript + Tailwind CSS
- **后端**: Python Flask + SQLAlchemy
- **数据库**: MySQL 5.7+
- **架构模式**: 前后端分离的三层架构

## 📊 项目结构

```
LIFEmaster/
├── app.py                 # Flask主应用
├── frontend/              # 前端代码
│   ├── sign_in.html      # 登录页面
│   └── ...               # 其他页面
├── img/                   # 图片资源
├── .env                   # 环境配置
├── database.md            # 数据库文档
└── README.md             # 项目说明
```

## 🔗 相关链接

- **项目仓库**: [GitHub - LifeMaster](https://github.com/cornhub919/LIFEmaster.git)
- **API文档**: [在线API文档](https://kdocs.cn/l/ce088HbETBdM)
- **技术文档**: 详见项目根目录的 `lifemasters.pdf`

## 👥 开发团队

**中山大学计算机学院 - 第一小组**

- 前端开发：彭怡萱、刘昊
- 后端开发：刘贤彬、刘明宇
- 数据库设计：马福泉、林炜东

## 📄 许可证

本项目遵循开源协议。

---

⭐ 如果这个项目对您有帮助，请考虑给我们一个 Star！
