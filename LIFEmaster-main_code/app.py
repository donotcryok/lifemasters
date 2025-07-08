from flask import Flask, request, jsonify, send_from_directory
from flask_jwt_extended import ( # type: ignore
    JWTManager, create_access_token, jwt_required, get_jwt_identity,
    get_jwt, set_access_cookies, unset_jwt_cookies
)
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import uuid
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, date
import os
from dotenv import load_dotenv
import collections
from sqlalchemy import case
import traceback

if not hasattr(collections, 'Iterable'):
    collections.Iterable = collections.abc.Iterable

# 加载环境变量
load_dotenv()

app = Flask(__name__)
CORS(app,
     resources={r"/api/*": {"origins": "*"}},
     supports_credentials=True,
     methods=["GET","POST","PUT","DELETE","OPTIONS"],
     allow_headers=["Content-Type", "Authorization"]
)

# 全局添加 CORS 响应头，确保预检也能通过
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
    return response

# 数据库配置 - 支持云部署
app.config['SQLALCHEMY_DATABASE_URI'] = (
    os.getenv('DATABASE_URL') or  # 优先使用云数据库URL
    f"mysql+pymysql://{os.getenv('DB_USER', 'root')}:{os.getenv('DB_PASSWORD', 'password')}"
    f"@{os.getenv('DB_HOST', 'localhost')}:{os.getenv('DB_PORT', '3306')}/{os.getenv('DB_NAME', 'lifemaster')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SQLALCHEMY_POOL_RECYCLE'] = 280  # 添加连接池回收时间，防止连接被数据库关闭
app.config['SQLALCHEMY_POOL_PRE_PING'] = True  # 每次连接前ping一下，确保连接有效

# 配置 JWT
app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'your-secret-key-here-12345')  # 生产环境中应该使用更安全的密钥
# 配置 JWT 黑名单
app.config['JWT_BLACKLIST_ENABLED'] = True
app.config['JWT_BLACKLIST_TOKEN_CHECKS'] = ['access']  # 黑名单检查访问令牌

# 初始化扩展
db = SQLAlchemy(app)
migrate = Migrate(app, db)
jwt = JWTManager(app)

# 黑名单
blacklist = set()

# 静态文件路由支持
import sys
from flask import send_from_directory, send_file

@app.route('/前端/<path:filename>')
def serve_frontend(filename):
    """服务前端静态文件"""
    try:
        # 确定前端文件目录
        if getattr(sys, 'frozen', False):
            # 打包环境
            frontend_dir = os.path.join(sys._MEIPASS, '前端')
        else:
            # 开发环境
            frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), '前端')
        
        return send_from_directory(frontend_dir, filename)
    except Exception as e:
        print(f"Error serving {filename}: {e}")
        return f"File not found: {filename}", 404

@app.route('/')
def index():
    """根路由重定向到前端"""
    return f'<script>window.location.href="/前端/sign_in.html";</script>'

# 数据库模型
class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # 关系
    tasks = db.relationship('Task', backref='user', lazy=True, cascade='all, delete-orphan')
    accounting_records = db.relationship('AccountingRecord', backref='user', lazy=True, cascade='all, delete-orphan')
    accounting_categories = db.relationship('AccountingCategory', backref='user', lazy=True, cascade='all, delete-orphan')
    handbooks = db.relationship('Handbook', backref='user', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'created_at': self.created_at.isoformat()
        }

class Task(db.Model):
    __tablename__ = 'tasks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    text = db.Column(db.String(200), nullable=False)
    deadline = db.Column(db.DateTime, nullable=True)
    completed = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'text': self.text,
            'deadline': self.deadline.isoformat() if self.deadline else None,
            'completed': self.completed,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class AccountingCategory(db.Model):
    __tablename__ = 'accounting_categories'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    type = db.Column(db.Enum('income', 'expense'), nullable=False)
    color = db.Column(db.String(20), nullable=False, default='#cccccc')
    is_default = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 关系
    records = db.relationship('AccountingRecord', backref='category', lazy=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'type': self.type,
            'color': self.color,
            'is_default': self.is_default
        }

class AccountingRecord(db.Model):
    __tablename__ = 'accounting_records'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey('accounting_categories.id'), nullable=False)
    type = db.Column(db.Enum('income', 'expense'), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    date = db.Column(db.Date, nullable=False)
    note = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'category_id': self.category_id,  # 确保包含category_id
            'type': self.type,
            'amount': float(self.amount),
            'date': self.date.isoformat(),
            'note': self.note or '',
            'created_at': self.created_at.isoformat(),
            'category': self.category.to_dict() if self.category else None
        }

class Handbook(db.Model):
    __tablename__ = 'handbooks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(100), nullable=False)
    content = db.Column(db.Text, nullable=True)
    tags = db.Column(db.String(255), nullable=True, default='')  # 存储逗号分隔的标签
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'tags': self.tags.split(',') if self.tags else [],
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }


# 用户标签模型
class UserTag(db.Model):
    __tablename__ = 'user_tags'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String(36), db.ForeignKey('users.id'), nullable=False)
    tag_name = db.Column(db.String(50), nullable=False)
    color = db.Column(db.String(7), nullable=True, default='#007bff')  # 十六进制颜色值
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 组合唯一约束，确保同一用户不能有重复标签
    __table_args__ = (db.UniqueConstraint('user_id', 'tag_name', name='unique_user_tag'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'tag_name': self.tag_name,
            'color': self.color,
            'created_at': self.created_at.isoformat()
        }

# 移除可能引发问题的元数据刷新逻辑
# with app.app_context():
#    db.metadata.reflect(bind=db.engine, only=['handbooks'], extend_existing=True)


@jwt.token_in_blocklist_loader
def check_if_token_in_blacklist(jwt_header, jwt_payload):
    jti = jwt_payload['jti']
    return jti in blacklist

# 路由
@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        # 验证输入
        if not data or 'username' not in data or 'password' not in data or 'email' not in data:
            return jsonify({"code": -1, "msg": "用户名、邮箱和密码不能为空"}), 400
        
        username = data['username']
        email = data['email']
        password = data['password']
        
        # 检查用户名是否已存在
        existing_user = User.query.filter_by(username=username).first()
        if existing_user:
            return jsonify({"code": -1, "msg": "用户名已存在"}), 400
            
        # 检查邮箱是否已存在
        existing_email = User.query.filter_by(email=email).first()
        if existing_email:
            return jsonify({"code": -1, "msg": "邮箱已存在"}), 400
        
        # 创建用户
        hashed_password = generate_password_hash(password)
        
        new_user = User(
            username=username,
            email=email,
            password_hash=hashed_password
        )
        
        db.session.add(new_user)
        db.session.flush()  # 获取新用户ID
        
        # 为新用户创建默认记账分类 - 使用完全不同的颜色
        default_income_categories = [
            AccountingCategory(name="工资", type="income", color="#1976D2", is_default=True, user_id=new_user.id),      # 蓝色
            AccountingCategory(name="奖金", type="income", color="#F57C00", is_default=True, user_id=new_user.id),      # 橙色  
            AccountingCategory(name="投资", type="income", color="#7B1FA2", is_default=True, user_id=new_user.id),      # 紫色
            AccountingCategory(name="其他收入", type="income", color="#00796B", is_default=True, user_id=new_user.id)   # 青色
        ]
        
        default_expense_categories = [
            AccountingCategory(name="餐饮", type="expense", color="#D32F2F", is_default=True, user_id=new_user.id),     # 深红色
            AccountingCategory(name="交通", type="expense", color="#388E3C", is_default=True, user_id=new_user.id),     # 绿色
            AccountingCategory(name="购物", type="expense", color="#303F9F", is_default=True, user_id=new_user.id),     # 深蓝色
            AccountingCategory(name="住房", type="expense", color="#FF6F00", is_default=True, user_id=new_user.id),     # 深橙色
            AccountingCategory(name="娱乐", type="expense", color="#C2185B", is_default=True, user_id=new_user.id),     # 粉红色
            AccountingCategory(name="医疗", type="expense", color="#00838F", is_default=True, user_id=new_user.id),     # 深青色
            AccountingCategory(name="教育", type="expense", color="#5D4037", is_default=True, user_id=new_user.id),     # 棕色
            AccountingCategory(name="其他支出", type="expense", color="#455A64", is_default=True, user_id=new_user.id)  # 蓝灰色
        ]
        
        db.session.add_all(default_income_categories)
        db.session.add_all(default_expense_categories)
        
        # 为新用户创建默认手账标签
        default_tags = [
            UserTag(user_id=new_user.id, tag_name="学习", color="#4CAF50"),      # 绿色
            UserTag(user_id=new_user.id, tag_name="工作", color="#2196F3"),      # 蓝色  
            UserTag(user_id=new_user.id, tag_name="日常", color="#FF9800")       # 橙色
        ]
        
        db.session.add_all(default_tags)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "注册成功",
            "data": {
                "userId": new_user.id
            }
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"code": -1, "msg": f"注册失败：{str(e)}"}), 500

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
def login():
    if request.method == 'OPTIONS':
        return '', 200
        
    try:
        data = request.get_json()
        print(f"登录请求数据: {data}")  # 添加调试信息
        
        if not data or 'email' not in data or 'password' not in data:
            return jsonify({"code": -1, "msg": "邮箱和密码不能为空"}), 400
        
        email = data['email']
        password = data['password']
        print(f"尝试登录邮箱: {email}")  # 添加调试信息
        
        # 查找用户
        user = User.query.filter_by(email=email).first()
        print(f"查找到用户: {user}")  # 添加调试信息
        
        if not user or not check_password_hash(user.password_hash, password):
            return jsonify({"code": -1, "msg": "无效的邮箱或密码"}), 401
        
        # 创建JWT token
        access_token = create_access_token(identity=user.id)
        print(f"创建token成功: {access_token[:20]}...")  # 添加调试信息
        
        return jsonify({
            "code": 0,
            "msg": "登录成功",
            "data": {
                "token": access_token,
                "user": user.to_dict()
            }
        })
        
    except Exception as e:
        print(f"登录错误: {str(e)}")  # 添加调试信息
        import traceback
        traceback.print_exc()  # 打印完整错误堆栈
        return jsonify({"code": -1, "msg": f"登录失败：{str(e)}"}), 500


@app.route('/api/auth/logout', methods=['POST'])
@jwt_required()
def logout():
    jti = get_jwt()['jti']
    blacklist.add(jti)
    return jsonify({
        "code": 0,
        "msg": "退出成功"
    })


@app.route('/api/user/profile', methods=['GET'])
@jwt_required()
def get_profile():
    try:
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({"code": -1, "msg": "用户不存在"}), 404
        
        return jsonify({
            "code": 0,
            "data": user.to_dict()
        })
        
    except Exception as e:
        return jsonify({"code": -1, "msg": f"获取用户信息失败：{str(e)}"}), 500

# 待办事项API
@app.route('/api/tasks', methods=['GET'])
@jwt_required()
def get_tasks():
    try:
        current_user_id = get_jwt_identity()
        
        # 支持查询参数
        completed = request.args.get('completed')
        limit = request.args.get('limit', type=int)
        
        query = Task.query.filter_by(user_id=current_user_id)
        
        if completed is not None:
            query = query.filter_by(completed=completed.lower() == 'true')
        
        # 让NULL的deadline排在最后，兼容MySQL
        query = query.order_by(
            case((Task.deadline == None, 1), else_=0),  # 先排非空，再排空
            Task.deadline.asc(),
            Task.created_at.desc()
        )
        
        if limit:
            query = query.limit(limit)
        
        tasks = query.all()
        
        return jsonify({
            "code": 0,
            "data": {
                "tasks": [task.to_dict() for task in tasks],
                "total": len(tasks)
            }
        })
        
    except Exception as e:
        app.logger.error(f"获取任务失败: {str(e)}")
        return jsonify({"code": -1, "msg": "获取任务失败"}), 500

@app.route('/api/tasks', methods=['POST'])
@jwt_required()
def create_task():
    try:
        print("收到创建任务请求:", request.data)
        current_user_id = get_jwt_identity()
        print("当前用户ID:", current_user_id)
        data = request.get_json()
        print("解析后的请求数据:", data)
        
        if not data or 'text' not in data:
            return jsonify({"code": -1, "msg": "任务内容不能为空"}), 400
        
        deadline = None
        if 'deadline' in data and data['deadline']:
            try:
                # 修复：支持完整的datetime格式，不只是日期
                deadline_str = str(data['deadline'])
                if 'T' in deadline_str:
                    # 完整的datetime格式：YYYY-MM-DDTHH:MM 或 YYYY-MM-DDTHH:MM:SS
                    if len(deadline_str) == 16:  # YYYY-MM-DDTHH:MM
                        deadline = datetime.strptime(deadline_str, '%Y-%m-%dT%H:%M')
                    else:  # 可能包含秒
                        deadline = datetime.fromisoformat(deadline_str.replace('Z', ''))
                else:
                    # 只有日期：YYYY-MM-DD，默认设为当天 00:00
                    deadline = datetime.strptime(deadline_str[:10], '%Y-%m-%d')
                print(f"解析后的deadline: {deadline}")
            except Exception as e:
                print(f"日期解析错误: {e}")
                return jsonify({"code": -1, "msg": "日期格式错误"}), 400
        
        new_task = Task(
            user_id=current_user_id,
            text=data['text'],
            deadline=deadline,
            completed=data.get('completed', False)
        )
        
        db.session.add(new_task)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "任务创建成功",
            "data": new_task.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"创建任务失败: {str(e)}")
        import traceback
        traceback.print_exc()  # 输出完整堆栈
        return jsonify({"code": -1, "msg": "创建任务失败"}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
@jwt_required()
def update_task(task_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        task = Task.query.filter_by(id=task_id, user_id=current_user_id).first()
        if not task:
            return jsonify({"code": -1, "msg": "任务不存在或无权限"}), 404
        
        if 'text' in data:
            task.text = data['text']
        
        if 'deadline' in data:
            task.deadline = datetime.fromisoformat(data['deadline'].replace('Z', '+00:00')) if data['deadline'] else None
        
        if 'completed' in data:
            task.completed = data['completed']
        
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "任务更新成功",
            "data": task.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"更新任务失败: {str(e)}")
        return jsonify({"code": -1, "msg": "更新任务失败"}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
@jwt_required()
def delete_task(task_id):
    try:
        current_user_id = get_jwt_identity()
        
        task = Task.query.filter_by(id=task_id, user_id=current_user_id).first()
        if not task:
            return jsonify({"code": -1, "msg": "任务不存在或无权限"}), 404
        
        db.session.delete(task)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "任务删除成功"
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"删除任务失败: {str(e)}")
        return jsonify({"code": -1, "msg": "删除任务失败"}), 500

# 记账API
@app.route('/api/accounting/categories', methods=['GET'])
@jwt_required()
def get_categories():
    try:
        current_user_id = get_jwt_identity()
        
        # 获取所有分类，按创建时间排序
        categories = AccountingCategory.query.filter_by(user_id=current_user_id)\
            .order_by(AccountingCategory.created_at.asc()).all()
        
        categories_data = {
            "income": [],
            "expense": []
        }
        
        for category in categories:
            category_data = category.to_dict()
            categories_data[category.type].append(category_data)
        
        # 在后端确保"其他"类别排在最后
        def sort_categories(cat_list):
            return sorted(cat_list, key=lambda x: (
                1 if '其他' in x['name'] else 0,  # "其他"类别排在最后
                x['id']  # 其他按ID排序
            ))
        
        categories_data["income"] = sort_categories(categories_data["income"])
        categories_data["expense"] = sort_categories(categories_data["expense"])
        
        return jsonify({
            "code": 0,
            "data": categories_data
        })
        
    except Exception as e:
        app.logger.error(f"获取分类失败: {str(e)}")
        return jsonify({"code": -1, "msg": "获取分类失败"}), 500

@app.route('/api/accounting/categories', methods=['POST'])
@jwt_required()
def create_category():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'name' not in data or 'type' not in data:
            return jsonify({"code": -1, "msg": "名称和类型不能为空"}), 400
        
        if data['type'] not in ['income', 'expense']:
            return jsonify({"code": -1, "msg": "类型必须是income或expense"}), 400
        
        new_category = AccountingCategory(
            user_id=current_user_id,
            name=data['name'],
            type=data['type'],
            color=data.get('color', '#cccccc'),
            is_default=False
        )
        
        db.session.add(new_category)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "分类创建成功",
            "data": new_category.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"创建分类失败: {str(e)}")
        return jsonify({"code": -1, "msg": "创建分类失败"}), 500

@app.route('/api/accounting/records', methods=['GET'])
@jwt_required()
def get_records():
    try:
        current_user_id = get_jwt_identity()
        
        # 支持筛选和分页
        record_type = request.args.get('type')  # income, expense, all
        start_date = request.args.get('start_date')
        end_date = request.args.get('end_date')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        query = AccountingRecord.query.filter_by(user_id=current_user_id)
        
        if record_type and record_type != 'all':
            query = query.filter_by(type=record_type)
        
        if start_date:
            query = query.filter(AccountingRecord.date >= datetime.strptime(start_date, '%Y-%m-%d').date())
        
        if end_date:
            query = query.filter(AccountingRecord.date <= datetime.strptime(end_date, '%Y-%m-%d').date())
        
        # 按日期降序排序
        query = query.order_by(AccountingRecord.date.desc(), AccountingRecord.id.desc())
        
        # 分页
        records_pagination = query.paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            "code": 0,
            "data": {
                "records": [record.to_dict() for record in records_pagination.items],
                "pagination": {
                    "current_page": page,
                    "per_page": per_page,
                    "total_pages": records_pagination.pages,
                    "total_records": records_pagination.total,
                    "has_next": records_pagination.has_next,
                    "has_prev": records_pagination.has_prev
                }
            }
        })
        
    except Exception as e:
        app.logger.error(f"获取记账记录失败: {str(e)}")
        return jsonify({"code": -1, "msg": "获取记账记录失败"}), 500

@app.route('/api/accounting/records', methods=['POST'])
@jwt_required()
def create_record():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        required_fields = ['type', 'category_id', 'amount', 'date']
        for field in required_fields:
            if field not in data:
                return jsonify({"code": -1, "msg": f"{field}不能为空"}), 400
        
        if data['type'] not in ['income', 'expense']:
            return jsonify({"code": -1, "msg": "类型必须是income或expense"}), 400
        
        # 验证分类是否存在且属于当前用户
        category = AccountingCategory.query.filter_by(
            id=data['category_id'], 
            user_id=current_user_id,
            type=data['type']
        ).first()
        
        if not category:
            return jsonify({"code": -1, "msg": "分类不存在或类型不匹配"}), 400
        
        record_date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        
        new_record = AccountingRecord(
            user_id=current_user_id,
            type=data['type'],
            category_id=data['category_id'],
            amount=float(data['amount']),
            date=record_date,
            note=data.get('note', '')
        )
        
        db.session.add(new_record)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "记账记录创建成功",
            "data": new_record.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"创建记账记录失败: {str(e)}")
        return jsonify({"code": -1, "msg": "创建记账记录失败"}), 500

@app.route('/api/accounting/records/<int:record_id>', methods=['PUT', 'OPTIONS'])
@jwt_required()
def update_record(record_id):
    if request.method == 'OPTIONS':
        return '', 200
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json() or {}
        rec = AccountingRecord.query.filter_by(id=record_id, user_id=current_user_id).first()
        if not rec:
            return jsonify({"code": -1, "msg": "记录不存在或无权限"}), 404
        # 支持修改字段
        if 'category_id' in data:
            rec.category_id = data['category_id']
        if 'amount' in data:
            rec.amount = float(data['amount'])
        if 'date' in data:
            rec.date = datetime.strptime(data['date'], '%Y-%m-%d').date()
        if 'note' in data:
            rec.note = data['note']
        db.session.commit()
        return jsonify({"code": 0, "msg": "记录更新成功", "data": rec.to_dict()})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"更新记账记录失败: {e}")
        return jsonify({"code": -1, "msg": "更新记账记录失败"}), 500

@app.route('/api/accounting/records/<int:record_id>', methods=['DELETE', 'OPTIONS'])
@jwt_required()
def delete_record(record_id):
    if request.method == 'OPTIONS':
        return '', 200
    try:
        current_user_id = get_jwt_identity()
        rec = AccountingRecord.query.filter_by(id=record_id, user_id=current_user_id).first()
        if not rec:
            return jsonify({"code": -1, "msg": "记录不存在或无权限"}), 404
        db.session.delete(rec)
        db.session.commit()
        return jsonify({"code": 0, "msg": "记录删除成功"})
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"删除记账记录失败: {e}")
        return jsonify({"code": -1, "msg": "删除记账记录失败"}), 500

# 手账API
@app.route('/api/handbooks', methods=['GET'])
@jwt_required()
def get_handbooks():
    try:
        current_user_id = get_jwt_identity()
        
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 10, type=int)
        
        handbooks_pagination = Handbook.query.filter_by(user_id=current_user_id)\
            .order_by(Handbook.updated_at.desc())\
            .paginate(page=page, per_page=per_page, error_out=False)
        
        return jsonify({
            "code": 0,
            "data": {
                "handbooks": [handbook.to_dict() for handbook in handbooks_pagination.items],
                "pagination": {
                    "current_page": page,
                    "per_page": per_page,
                    "total_pages": handbooks_pagination.pages,
                    "total_records": handbooks_pagination.total,
                    "has_next": handbooks_pagination.has_next,
                    "has_prev": handbooks_pagination.has_prev
                }
            }
        })
    except Exception as e:
        # 增强日志，打印完整堆栈
        app.logger.error(f"获取手账失败: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"code": -1, "msg": "获取手账失败"}), 500

@app.route('/api/handbooks', methods=['POST'])
@jwt_required()
def create_handbook():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or 'title' not in data:
            return jsonify({"code": -1, "msg": "标题不能为空"}), 400
        
        # 处理标签，确保是列表
        tags_list = data.get('tags', [])
        if not isinstance(tags_list, list):
            tags_list = []
        tags_str = ','.join(tags_list)
        
        new_handbook = Handbook(
            user_id=current_user_id,
            title=data['title'],
            content=data.get('content', ''),
            tags=tags_str
        )
        
        db.session.add(new_handbook)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "手账创建成功",
            "data": new_handbook.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"创建手账失败: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"code": -1, "msg": "创建手账失败"}), 500

@app.route('/api/handbooks/<int:handbook_id>', methods=['GET'])
@jwt_required()
def get_handbook(handbook_id):
    try:
        current_user_id = get_jwt_identity()
        
        handbook = Handbook.query.filter_by(id=handbook_id, user_id=current_user_id).first()
        if not handbook:
            return jsonify({"code": -1, "msg": "手账不存在或无权限"}), 404
        
        return jsonify({
            "code": 0,
            "data": handbook.to_dict()
        })
        
    except Exception as e:
        app.logger.error(f"获取手账详情失败: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"code": -1, "msg": "获取手账详情失败"}), 500

@app.route('/api/handbooks/<int:handbook_id>', methods=['PUT'])
@jwt_required()
def update_handbook(handbook_id):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        handbook = Handbook.query.filter_by(id=handbook_id, user_id=current_user_id).first()
        if not handbook:
            return jsonify({"code": -1, "msg": "手账不存在或无权限"}), 404
        
        if 'title' in data:
            handbook.title = data['title']
        
        if 'content' in data:
            handbook.content = data['content']
        
        if 'tags' in data:
            tags_list = data.get('tags', [])
            if not isinstance(tags_list, list):
                tags_list = []
            handbook.tags = ','.join(tags_list)

        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "手账更新成功",
            "data": handbook.to_dict()
        })
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"更新手账失败: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"code": -1, "msg": "更新手账失败"}), 500

@app.route('/api/handbooks/<int:handbook_id>', methods=['DELETE'])
@jwt_required()
def delete_handbook(handbook_id):
    try:
        current_user_id = get_jwt_identity()
        
        handbook = Handbook.query.filter_by(id=handbook_id, user_id=current_user_id).first()
        if not handbook:
            return jsonify({"code": -1, "msg": "手账不存在或无权限"}), 404
            
        db.session.delete(handbook)
        db.session.commit()
        
        return jsonify({"code": 0, "msg": "手账删除成功"})
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"删除手账失败: {str(e)}\n{traceback.format_exc()}")
        return jsonify({"code": -1, "msg": "删除手账失败"}), 500

# 获取用户自定义标签
@app.route('/api/user/tags', methods=['GET', 'POST'])
@jwt_required()
def user_tags():
    current_user_id = get_jwt_identity()
    
    if request.method == 'GET':
        # 获取用户所有标签
        tags = UserTag.query.filter_by(user_id=current_user_id).order_by(UserTag.created_at.asc()).all()
        return jsonify({
            "code": 0,
            "data": [tag.to_dict() for tag in tags]
        })
    
    elif request.method == 'POST':
        # 添加新标签
        data = request.get_json()
        if not data or 'tag_name' not in data:
            return jsonify({"code": -1, "msg": "标签名称不能为空"}), 400
        
        tag_name = data['tag_name'].strip()
        if not tag_name:
            return jsonify({"code": -1, "msg": "标签名称不能为空"}), 400

        # 检查标签是否已存在
        existing_tag = UserTag.query.filter_by(user_id=current_user_id, tag_name=tag_name).first()
        if existing_tag:
            return jsonify({"code": -1, "msg": "标签已存在"}), 409
        
        new_tag = UserTag(
            user_id=current_user_id,
            tag_name=tag_name,
            color=data.get('color', '#007bff')
        )
        
        db.session.add(new_tag)
        db.session.commit()
        
        return jsonify({
            "code": 0,
            "msg": "标签创建成功",
            "data": new_tag.to_dict()
        }), 201

@app.route('/api/user/tags/<int:tag_id>', methods=['DELETE', 'OPTIONS'])
@jwt_required()
def delete_tag(tag_id):
    # 处理CORS预检请求，必须返回200和所有CORS头
    if request.method == 'OPTIONS':
        response = app.make_response(('OK', 200))
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type,Authorization'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        return response

    current_user_id = get_jwt_identity()
    tag = UserTag.query.filter_by(id=tag_id, user_id=current_user_id).first()

    if not tag:
        return jsonify({"code": -1, "msg": "标签不存在或无权限"}), 404

    db.session.delete(tag)
    db.session.commit()

    return jsonify({"code": 0, "msg": "标签删除成功"})


@app.route('/api/admin/init-db', methods=['GET', 'POST'])
def init_database():
    """初始化MySQL数据库（仅限首次部署使用）"""
    try:
        db.create_all()
        return jsonify({"code": 0, "msg": "MySQL数据库初始化成功"})
    except Exception as e:
        return jsonify({"code": -1, "msg": f"初始化失败: {str(e)}"}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({
        "code": 0,
        "msg": "服务运行正常",
        "data": {
            "status": "healthy",
            "timestamp": datetime.utcnow().isoformat()
        }
    })

@app.route('/api/admin/check-db', methods=['GET'])
def check_database():
    """检查当前数据库连接信息"""
    try:
        from sqlalchemy import text
        
        # 获取数据库URL（隐藏密码）
        db_url = app.config['SQLALCHEMY_DATABASE_URI']
        safe_url = db_url.split('@')[1] if '@' in db_url else db_url
        
        # 测试数据库连接
        try:
            # 使用 db.session.execute 而不是 db.engine.connect
            result = db.session.execute(text("SELECT @@hostname, @@port, DATABASE()"))
            row = result.fetchone()
            
            # 检查结果是否为空
            if row is None:
                return jsonify({
                    "code": -1,
                    "msg": "数据库连接成功但查询结果为空"
                }), 500
            
            return jsonify({
                "code": 0,
                "msg": "数据库连接检查成功",
                "data": {
                    "database_host": safe_url,
                    "mysql_hostname": str(row[0]) if row[0] else "unknown",
                    "mysql_port": int(row[1]) if row[1] else 3306, 
                    "database_name": str(row[2]) if row[2] else "unknown",
                    "connection_type": "云端Sealos" if ("sealos" in safe_url or "svc" in safe_url) else "本地MySQL"
                }
            })
            
        except Exception as conn_error:
            return jsonify({
                "code": -1,
                "msg": f"数据库连接失败: {str(conn_error)}"
            }), 500
            
    except Exception as e:
        return jsonify({
            "code": -1,
            "msg": f"数据库连接检查失败: {str(e)}"
        }), 500

if __name__ == '__main__':
    print("=== LifeMaster 启动中 ===")
    print(f"数据库URL: {app.config['SQLALCHEMY_DATABASE_URI'][:50]}...")
    print(f"JWT密钥: {app.config['JWT_SECRET_KEY'][:20]}...")
    
    # 启动时测试数据库连接
    try:
        with app.app_context():
            from sqlalchemy import text
            result = db.session.execute(text("SELECT 1"))
            print("✅ 启动时数据库连接测试成功")
    except Exception as e:
        print(f"❌ 启动时数据库连接测试失败: {e}")
        print("请检查MySQL服务是否运行和数据库配置是否正确")
    
    port = int(os.environ.get('PORT', 5000))
    print(f"启动端口: {port}")
    print("=== 开始启动Flask服务 ===")
    
    # 修改为生产模式，禁用调试
    app.run(host='0.0.0.0', port=port, debug=False)