// DOM元素
const newFolderBtn = document.getElementById('new-folder-btn');
const newFileBtn = document.getElementById('new-file-btn');
const handbookEditor = document.getElementById('handbook-editor');

// 当前选中的元素
let selectedElement = null;
let isDragging = false;
let offsetX, offsetY;
let currentAction = null; // 'resize' 或 'move'
let resizeDirection = null; // 'se', 'ne', 'sw', 'nw'

// 当前编辑的手账ID
let currentEditingId = null;

// 修改：使用数据库存储而不是本地数组
let handbooks = []; // 从API加载的手账数据
// 修改：为标签分配不同的颜色
let tags = ['日常', '工作', '学习']; // 初始标签
const tagColors = [
    '#8B7D6B', // 浅棕色
    '#9C8473', // 暖棕色
    '#7A8471', // 橄榄绿
    '#8B7B6B', // 米棕色
    '#7B8B73', // 淡绿色
    '#8B8B7B', // 灰褐色
    '#9B8B6B', // 金棕色
    '#7B9B8B', // 青灰色
    '#8B9B7B', // 浅橄榄
    '#6B8B8B'  // 灰青色
];

// 获取手账列表容器
const handbookList = document.getElementById('handbook-list');

// 图片压缩函数
function compressImage(base64Data, callback, quality = 0.6) {
    const img = new Image();
    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // 计算压缩后的尺寸
        let { width, height } = img;
        const maxWidth = 800;  // 最大宽度
        const maxHeight = 600; // 最大高度
        
        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }
        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        // 绘制并压缩
        ctx.drawImage(img, 0, 0, width, height);
        const compressedData = canvas.toDataURL('image/jpeg', quality);
        
        console.log('[DEBUG] 图片压缩: 原始大小', base64Data.length, '压缩后大小', compressedData.length);
        callback(compressedData);
    };
    img.src = base64Data;
}

// 全局解析函数 - 增强版本，处理数据库截断问题
function parseHandbookContent(contentString) {
    let contentData = { tag: '未分类', elements: [] };
    
    try {
        // 如果内容为空或null，直接返回默认值
        if (!contentString || contentString.trim() === '') {
            console.log('[DEBUG] 手账内容为空，使用默认值');
            return contentData;
        }
        
        // 输出原始内容信息用于调试
        console.log('[DEBUG] 开始解析手账内容，长度:', contentString.length);
        console.log('[DEBUG] 内容类型:', typeof contentString);
        console.log('[DEBUG] 内容预览:', contentString.substring(0, 100) + '...');
        
        // 检查是否被截断（数据库限制导致）
        if (contentString.length >= 65535 && !contentString.endsWith('}')) {
            console.warn('[WARNING] 检测到内容可能被截断，尝试恢复基本信息');
            
            // 尝试从截断的内容中提取标签信息
            const tagMatch = contentString.match(/"tag"\s*:\s*"([^"]+)"/);
            if (tagMatch) {
                contentData.tag = tagMatch[1];
                console.log('[DEBUG] 从截断内容中恢复标签:', contentData.tag);
            }
            
            // 提示用户内容已损坏
            showToast('手账内容因过大被截断，建议重新编辑并使用更小的图片', 'error');
            return contentData;
        }
        
        // 尝试解析JSON
        let parsed;
        try {
            parsed = JSON.parse(contentString);
            console.log('[DEBUG] JSON解析成功，解析结果:', parsed);
        } catch (jsonError) {
            console.warn('[ERROR] JSON解析失败:', jsonError.message);
            console.log('[DEBUG] 失败的内容:', contentString.substring(0, 200) + '...');
            
            // 尝试修复常见的JSON问题
            let fixedContent = contentString.trim();
            
            // 检查是否是被转义的JSON字符串
            if (fixedContent.startsWith('"') && fixedContent.endsWith('"')) {
                try {
                    fixedContent = JSON.parse(fixedContent);
                    parsed = JSON.parse(fixedContent);
                    console.log('[DEBUG] 修复转义后解析成功:', parsed);
                } catch (retryError) {
                    console.warn('[ERROR] 修复转义后仍然失败:', retryError.message);
                    
                    // 尝试从损坏的JSON中提取标签信息
                    const tagMatch = contentString.match(/"tag"\s*:\s*"([^"]+)"/);
                    if (tagMatch) {
                        contentData.tag = tagMatch[1];
                        console.log('[DEBUG] 从损坏JSON中恢复标签:', contentData.tag);
                    }
                    return contentData;
                }
            } else {
                // 尝试从损坏的JSON中提取标签信息
                const tagMatch = contentString.match(/"tag"\s*:\s*"([^"]+)"/);
                if (tagMatch) {
                    contentData.tag = tagMatch[1];
                    console.log('[DEBUG] 从损坏JSON中恢复标签:', contentData.tag);
                }
                return contentData;
            }
        }
        
        // 验证解析后的数据
        if (parsed && typeof parsed === 'object') {
            console.log('[DEBUG] 解析的数据结构有效');
            
            // 处理标签
            if (typeof parsed.tag === 'string' && parsed.tag.trim()) {
                contentData.tag = parsed.tag.trim();
                console.log('[DEBUG] 提取标签:', contentData.tag);
            } else {
                console.log('[DEBUG] 标签无效或为空，使用默认标签');
            }
            
            // 处理元素数组
            if (Array.isArray(parsed.elements)) {
                contentData.elements = parsed.elements.filter(item => 
                    item && typeof item === 'object' && item.type
                );
                console.log('[DEBUG] 提取元素数组，共', contentData.elements.length, '个元素');
            } else {
                console.log('[DEBUG] 元素数组无效，使用空数组');
            }
        } else {
            console.warn('[DEBUG] 解析后的数据不是有效对象');
        }
        
    } catch (error) {
        console.error('[ERROR] 解析手账内容时发生未知错误:', error.message, error.stack);
    }
    
    console.log('[DEBUG] 最终解析结果:', contentData);
    return contentData;
}

// ===== 核心工具函数 - 放在最前面 =====

// 自定义提示函数
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = message;
        toast.className = 'fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-lg transform transition-all duration-500 z-50';
        
        if (type === 'error') {
            toast.classList.add('bg-red-600', 'text-white');
        } else if (type === 'success') {
            toast.classList.add('bg-green-600', 'text-white');
        } else {
            toast.classList.add('bg-primary', 'text-white');
        }
        
        toast.style.transform = 'translateY(0)';
        toast.style.opacity = '1';
        
        setTimeout(() => {
            toast.style.transform = 'translateY(4rem)';
            toast.style.opacity = '0';
        }, 3000);
    }
}

// 自定义确认对话框
function showConfirm(title, message, okCallback, cancelCallback = null) {
    const modal = document.getElementById('confirm-modal');
    const titleElement = document.getElementById('confirm-title');
    const messageElement = document.getElementById('confirm-message');
    const okBtn = document.getElementById('confirm-ok-btn');
    const cancelBtn = document.getElementById('confirm-cancel-btn');
    
    if (!modal || !titleElement || !messageElement || !okBtn || !cancelBtn) return;
    
    titleElement.textContent = title;
    messageElement.textContent = message;
    
    // 移除之前的事件监听器
    const newOkBtn = okBtn.cloneNode(true);
    const newCancelBtn = cancelBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newOkBtn, okBtn);
    cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
    
    // 添加新的事件监听器
    newOkBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (okCallback) okCallback();
    });
    
    newCancelBtn.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (cancelCallback) cancelCallback();
    });
    
    // 显示模态框
    modal.classList.remove('hidden');
}

// ===== 初始化和数据加载 =====

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    // 绑定事件处理函数
    bindEvents();
    
    // 返回按钮事件绑定
    const backBtn = document.getElementById('back-btn');
    if (backBtn) {
        backBtn.addEventListener('click', function() {
            window.location.href = 'main.html';        });    }
    
    // 修改：初始化时从localStorage加载标签，然后从数据库加载手账
    loadTagsFromAPI().then(() => {
        loadHandbooksFromAPI();
    });
});

// 修改：从API加载手账数据
async function loadHandbooksFromAPI() {
    try {
        console.log('[DEBUG] 开始加载手账数据...');
        const response = await apiRequest('/api/handbooks');        if (response && response.ok) {
            const data = await response.json();
            console.log('[DEBUG] 手账数据加载成功:', data);
            if (data.code === 0) {
                handbooks = data.data.handbooks || [];
                console.log('[DEBUG] 原始手账数据样例:', handbooks.length > 0 ? handbooks[0] : '无数据');
                renderHandbookList();
                console.log('[DEBUG] 手账列表渲染完成, 共', handbooks.length, '个手账');
            } else {
                console.error('[ERROR] 手账数据加载失败:', data.msg);
                showToast('加载手账数据失败: ' + data.msg, 'error');
            }
        } else {
            console.error('[ERROR] 手账API请求失败');
            showToast('加载手账数据失败', 'error');
        }
    } catch (error) {
        console.error('[ERROR] 加载手账数据异常:', error);
        showToast('加载手账数据失败: ' + error.message, 'error');
    }
}

// 从API加载标签数据
async function loadTagsFromAPI() {
    try {
        console.log('[DEBUG] 开始加载标签数据...');
        
        const response = await fetch('http://localhost:5000/api/user/tags', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });

        if (response.ok) {
            const result = await response.json();
            if (result.code === 0) {
                // 从API获取用户标签
                tags = result.data.map(tag => tag.tag_name);
                console.log('[DEBUG] 从API加载标签成功:', tags);
                
                // 如果用户没有任何标签，为其创建默认标签
                if (tags.length === 0) {
                    console.log('[DEBUG] 用户无标签，创建默认标签...');
                    await initializeDefaultTags();
                    // 重新加载标签
                    const retryResponse = await fetch('http://localhost:5000/api/user/tags', {
                        method: 'GET',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('token')}`
                        }
                    });
                    if (retryResponse.ok) {
                        const retryResult = await retryResponse.json();
                        if (retryResult.code === 0) {
                            tags = retryResult.data.map(tag => tag.tag_name);
                        }
                    }
                }
            } else {
                console.warn('[WARN] API返回错误:', result.msg);
                tags = ['日常', '工作', '学习']; // 默认标签
            }
        } else {
            console.warn('[WARN] API请求失败，使用默认标签');
            tags = ['日常', '工作', '学习']; // 默认标签
        }
        
        renderSidebarTags();
        renderTagOptions();
        console.log('[DEBUG] 标签列表渲染完成, 共', tags.length, '个标签');
    } catch (error) {
        console.error('[ERROR] 加载标签数据异常:', error);
        // 使用默认标签
        tags = ['日常', '工作', '学习'];
        renderSidebarTags();
        renderTagOptions();
    }
}

// 为用户初始化默认标签
async function initializeDefaultTags() {
    const defaultTags = [
        { tag_name: "学习", color: "#4CAF50" },
        { tag_name: "工作", color: "#2196F3" },
        { tag_name: "日常", color: "#FF9800" }
    ];
    
    try {
        for (const tag of defaultTags) {
            const response = await fetch('http://localhost:5000/api/user/tags', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(tag)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.code === 0) {
                    console.log(`[DEBUG] 创建默认标签成功: ${tag.tag_name}`);
                } else {
                    console.warn(`[WARN] 创建默认标签失败: ${tag.tag_name}, ${result.msg}`);
                }
            }
        }
    } catch (error) {
        console.error('[ERROR] 初始化默认标签失败:', error);
    }
}

// ===== 事件绑定 =====

// 绑定所有事件处理函数
function bindEvents() {
    // 侧边栏按钮事件 - 添加安全检查
    if (newFolderBtn) {
        newFolderBtn.addEventListener('click', openNewFolderModal);
    }
    if (newFileBtn) {
        newFileBtn.addEventListener('click', openNewFileModal);
    }
    
    // 文件夹模态框事件 - 添加安全检查
    const closeFolderModal = document.getElementById('close-folder-modal');
    const cancelFolderBtn = document.getElementById('cancel-folder-btn');
    const confirmFolderBtn = document.getElementById('confirm-folder-btn');
    
    if (closeFolderModal) {
        closeFolderModal.addEventListener('click', closeNewFolderModal);
    }
    if (cancelFolderBtn) {
        cancelFolderBtn.addEventListener('click', closeNewFolderModal);
    }
    if (confirmFolderBtn) {
        confirmFolderBtn.addEventListener('click', createNewFolder);
    }
    
    // 文件模态框事件 - 添加安全检查
    const closeFileModal = document.getElementById('close-file-modal');
    const cancelFileBtn = document.getElementById('cancel-file-btn');
    const confirmFileBtn = document.getElementById('confirm-file-btn');
    
    if (closeFileModal) {
        closeFileModal.addEventListener('click', closeNewFileModal);
    }
    if (cancelFileBtn) {
        cancelFileBtn.addEventListener('click', closeNewFileModal);
    }
    if (confirmFileBtn) {
        confirmFileBtn.addEventListener('click', createNewFile);
    }
      // 编辑器工具栏事件 - 添加安全检查
    const addImageBtn = document.getElementById('add-image-btn');
    const addTextBtn = document.getElementById('add-text-btn');
    const stickerSelect = document.getElementById('sticker-select');
    
    if (addImageBtn) {
        addImageBtn.addEventListener('click', openImageUploadModal);
    }
    if (addTextBtn) {
        addTextBtn.addEventListener('click', addTextBox);
    }
    if (stickerSelect) {
        stickerSelect.addEventListener('change', function() {
            if (this.value) {
                addSticker(this.value);
                this.value = '';
            }
        });
    }
    
    // 图片上传模态框事件 - 添加安全检查
    const closeImageModal = document.getElementById('close-image-modal');
    const cancelImageBtn = document.getElementById('cancel-image-btn');
    const confirmImageBtn = document.getElementById('confirm-image-btn');
    const browseImageBtn = document.getElementById('browse-image-btn');
    const imageUploadInput = document.getElementById('image-upload-input');
    
    if (closeImageModal) {
        closeImageModal.addEventListener('click', closeImageUploadModal);
    }
    if (cancelImageBtn) {
        cancelImageBtn.addEventListener('click', closeImageUploadModal);
    }
    if (confirmImageBtn) {
        confirmImageBtn.addEventListener('click', insertImage);
    }
    if (browseImageBtn) {
        browseImageBtn.addEventListener('click', function() {
            if (imageUploadInput) {
                imageUploadInput.click();
            }
        });
    }
    
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                // 检查文件大小（限制为5MB）
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSize) {
                    showToast('图片文件过大，请选择小于5MB的图片', 'error');
                    this.value = ''; // 清空选择
                    return;
                }
                
                // 检查文件类型
                const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
                if (!allowedTypes.includes(file.type)) {
                    showToast('不支持的图片格式，请选择JPG、PNG、GIF或WebP格式', 'error');
                    this.value = ''; // 清空选择
                    return;
                }
                
                const reader = new FileReader();
                reader.onload = function(event) {
                    const imagePreview = document.getElementById('image-preview');
                    const imagePreviewContainer = document.getElementById('image-preview-container');                    if (imagePreview && imagePreviewContainer && confirmImageBtn) {
                        const base64Data = event.target.result;
                        console.log('[DEBUG] 原始图片大小:', base64Data.length);
                        
                        // 自动压缩图片
                        compressImage(base64Data, (compressedData) => {
                            console.log('[DEBUG] 压缩后图片大小:', compressedData.length);
                            
                            // 检查压缩后的大小
                            if (compressedData.length > 300000) {
                                // 如果还是太大，进一步压缩
                                compressImage(base64Data, (moreCompressedData) => {
                                    if (moreCompressedData.length > 300000) {
                                        showToast('图片压缩后仍然过大，请选择更小的图片', 'error');
                                        return;
                                    }
                                    imagePreview.src = moreCompressedData;
                                    imagePreviewContainer.classList.remove('hidden');
                                    confirmImageBtn.disabled = false;
                                    showToast('图片已自动压缩以适应存储限制', 'success');
                                }, 0.3); // 更高压缩率
                            } else {
                                imagePreview.src = compressedData;
                                imagePreviewContainer.classList.remove('hidden');
                                confirmImageBtn.disabled = false;
                                if (compressedData.length < base64Data.length) {
                                    showToast('图片已自动压缩以适应存储限制', 'success');
                                }
                            }
                        }, 0.7); // 默认压缩质量
                    }
                }
                reader.onerror = function() {
                    showToast('图片读取失败，请重试', 'error');
                }
                reader.readAsDataURL(file);
            }
        });
    }
    
    // 编辑器交互事件
    if (handbookEditor) {
        handbookEditor.addEventListener('mousedown', handleEditorMouseDown);
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    
    // 标签选择事件处理
    const tagSelect = document.getElementById('file-tag-select');
    const newTagInput = document.getElementById('new-tag-input');

    if (tagSelect) {
        tagSelect.addEventListener('change', function() {
            if (tagSelect.value === 'new') {
                if (newTagInput) {
                    newTagInput.classList.remove('hidden');
                    newTagInput.value = '';
                    newTagInput.focus();
                }
            } else {
                if (newTagInput) {
                    newTagInput.classList.add('hidden');
                }
            }
        });
    }    if (newTagInput) {
        newTagInput.addEventListener('keydown', async function(e) {
            if (e.key === 'Enter') {
                const newTag = newTagInput.value.trim();
                if (newTag && !tags.includes(newTag)) {
                    try {
                        // 调用后端API创建标签
                        const response = await fetch('/api/user/tags', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('token')}`
                            },
                            body: JSON.stringify({
                                tag_name: newTag,
                                color: '#007bff'
                            })
                        });

                        const result = await response.json();
                        if (result.code === 0) {
                            // 成功创建后更新前端
                            tags.push(newTag);
                            renderTagOptions(newTag);
                            renderSidebarTags();
                            newTagInput.classList.add('hidden');
                            if (tagSelect) {
                                tagSelect.value = newTag;
                            }
                            showToast('新标签创建成功', 'success');
                        } else {
                            showToast('创建标签失败: ' + result.msg, 'error');
                        }
                    } catch (error) {
                        console.error('创建标签失败:', error);
                        showToast('创建标签失败: ' + error.message, 'error');
                    }
                } else if (!newTag) {
                    showToast('请输入标签名称', 'error');
                } else {
                    showToast('标签已存在', 'error');
                }
            }
        });
    }
    
    // 预览模态框关闭事件
    const closePreviewModal = document.getElementById('close-preview-modal');
    if (closePreviewModal) {
        closePreviewModal.addEventListener('click', () => {
            document.getElementById('preview-modal').classList.add('hidden');
        });
    }
    
    // 标签管理模态框事件
    const manageFolderBtn = document.getElementById('new-folder-btn');
    const tagModal = document.getElementById('tag-management-modal');
    const closeTagModal = document.getElementById('close-tag-modal');
    const newTagNameInput = document.getElementById('new-tag-name-input');
    const confirmAddTag = document.getElementById('confirm-add-tag');
    
    if (manageFolderBtn) {
        manageFolderBtn.addEventListener('click', openTagManagementModal);
    }
    
    if (closeTagModal) {
        closeTagModal.addEventListener('click', closeTagManagementModal);
    }
    
    if (confirmAddTag) {
        confirmAddTag.addEventListener('click', addNewTagFromModal);
    }
    
    if (newTagNameInput) {
        newTagNameInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addNewTagFromModal();
            }
        });
    }
    
    // 添加键盘事件监听器用于删除选中的元素
    document.addEventListener('keydown', function(e) {
        // 检查是否按下了Delete或Backspace键
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElement) {
            // 确保不是在文本框中编辑
            if (!selectedElement.classList.contains('text-box') || !selectedElement.matches(':focus')) {
                e.preventDefault();
                deleteSelectedElement();
            }
        }
    });
}

// 打开新建文件夹模态框
function openNewFolderModal() {
    openTagManagementModal();
}

// 关闭新建文件夹模态框
function closeNewFolderModal() {
    const newFolderModal = document.getElementById('new-folder-modal');
    const folderNameInput = document.getElementById('folder-name-input');
    if (newFolderModal) {
        newFolderModal.classList.add('hidden');
    }
    if (folderNameInput) {
        folderNameInput.value = '';
    }
}

// 创建新文件夹
function createNewFolder() {
    addNewTagFromModal();
}

// 打开新建文件模态框
function openNewFileModal() {
    const newFileModal = document.getElementById('new-file-modal');
    const fileTitleInput = document.getElementById('file-title-input');
    if (newFileModal && fileTitleInput) {
        newFileModal.classList.remove('hidden');
        fileTitleInput.focus();
        // 清空编辑器
        if (handbookEditor) {
            handbookEditor.innerHTML = `
                <div class="text-center text-gray-400 mt-10">
                    <p>拖放图片、贴纸或文本框到这里</p>
                    <p class="text-sm mt-2">使用工具栏添加元素</p>
                </div>
            `;
        }
    }
}

// 关闭新建文件模态框
function closeNewFileModal() {
    const newFileModal = document.getElementById('new-file-modal');
    const fileTitleInput = document.getElementById('file-title-input');
    
    if (newFileModal) {
        newFileModal.classList.add('hidden');
    }
    if (fileTitleInput) {
        fileTitleInput.value = '';
    }
    
    currentEditingId = null;
    // 重置标签选择
    const tagSelect = document.getElementById('file-tag-select');
    const newTagInput = document.getElementById('new-tag-input');
    if (tagSelect) {
        tagSelect.value = '';
    }
    if (newTagInput) {
        newTagInput.classList.add('hidden');
        newTagInput.value = '';
    }
}

// 渲染标签下拉框（用于新建/编辑手账）
function renderTagOptions(selectedTag = '') {
    const tagSelect = document.getElementById('file-tag-select');
    if (!tagSelect) return;

    // 记录当前选中值（如果未传入则用当前下拉框的值）
    const currentValue = selectedTag || tagSelect.value;

    // 清空现有选项，保留第一个"请选择标签"
    tagSelect.innerHTML = '<option value="">请选择标签</option>';

    // 只渲染已有标签，不添加“+ 新建标签”
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    // 恢复之前的选中状态
    if (currentValue) {
        tagSelect.value = currentValue;
    }
}

// 渲染左侧标签栏 - 修复"所有手账"文字显示问题
function renderSidebarTags(activeTag = 'all') {
    const menuList = document.querySelector('.menu');
    if (!menuList) return;
    
    menuList.innerHTML = '';
    
    // "所有手账"选项 - 修复文字显示问题
    const allLi = document.createElement('li');
    allLi.className = `cursor-pointer py-3 px-4 rounded-xl transition-all duration-300 flex items-center gap-3 ${
        activeTag === 'all' 
            ? 'bg-primary text-white shadow-md' 
            : 'text-gray-600 hover:bg-primary/10 hover:text-primary'
    }`;
    allLi.innerHTML = `
        <div class="w-3 h-3 rounded-full ${activeTag === 'all' ? 'bg-white/30' : 'bg-primary/20'}"></div>
        <span class="font-medium">所有手账</span>
    `;
    allLi.onclick = () => {
        renderHandbookList();
        renderSidebarTags('all');
    };
    menuList.appendChild(allLi);

    // 其它标签 - 使用更柔和的颜色
    tags.forEach((tag, index) => {
        const li = document.createElement('li');
        const tagColor = tagColors[index % tagColors.length];
        const isActive = activeTag === tag;
        
        li.className = `cursor-pointer py-3 px-4 rounded-xl transition-all duration-300 flex items-center gap-3`;
        
        if (isActive) {
            // 激活状态：使用标签颜色作为背景，白色文字
            li.style.backgroundColor = tagColor;
            li.style.color = 'white';
            li.classList.add('shadow-md');
        } else {
            // 非激活状态：透明背景，灰色文字
            li.style.backgroundColor = 'transparent';
            li.style.color = '#4B5563'; // gray-600
            li.addEventListener('mouseenter', () => {
                if (activeTag !== tag) {
                    li.style.backgroundColor = `${tagColor}20`; // 20% 透明度
                    li.style.color = tagColor;
                }
            });
            li.addEventListener('mouseleave', () => {
                if (activeTag !== tag) {
                    li.style.backgroundColor = 'transparent';
                    li.style.color = '#4B5563';
                }
            });
        }
        
        li.innerHTML = `
            <div class="w-3 h-3 rounded-full" style="background-color: ${isActive ? 'rgba(255,255,255,0.3)' : tagColor}"></div>
            <span class="font-medium">${tag}</span>
        `;
        
        li.onclick = () => {
            renderHandbookList(tag);
            renderSidebarTags(tag);
        };
        menuList.appendChild(li);
    });
}

// 修改：保存手账到数据库
async function createNewFile() {
    const fileTitleInput = document.getElementById('file-title-input');
    const tagSelect = document.getElementById('file-tag-select');
    const newTagInput = document.getElementById('new-tag-input');
    
    if (!fileTitleInput || !tagSelect) return;
    
    const title = fileTitleInput.value.trim();
    let selectedTag = tagSelect.value;    // 处理新标签
    if (selectedTag === 'new') {
        const newTag = newTagInput ? newTagInput.value.trim() : '';
        if (newTag && !tags.includes(newTag)) {
            // 先创建新标签
            try {
                const response = await fetch('/api/user/tags', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('token')}`
                    },
                    body: JSON.stringify({
                        tag_name: newTag,
                        color: '#007bff'
                    })
                });

                const result = await response.json();
                if (result.code === 0) {
                    tags.push(newTag);
                    renderTagOptions(newTag);
                    renderSidebarTags();
                    selectedTag = newTag;
                } else {
                    showToast('创建标签失败: ' + result.msg, 'error');
                    return;
                }
            } catch (error) {
                showToast('创建标签失败: ' + error.message, 'error');
                return;
            }
        } else if (!newTag) {
            showToast('请输入新标签名', 'error');
            return;
        } else {
            showToast('标签已存在', 'error');
            return;
        }
    }

    // 验证必填字段
    if (!title) {
        showToast('请输入手账标题', 'error');
        return;
    }
    
    if (!selectedTag || selectedTag === '' || selectedTag === 'new') {
        showToast('请选择或创建标签', 'error');
        return;
    }

    // 获取编辑器内容 - 转换为JSON字符串存储
    const elements = handbookEditor ? handbookEditor.querySelectorAll('.image-container, .sticker, .text-box') : [];
    const content = [];
    let totalContentSize = 0;
    
    elements.forEach(element => {
        const elementData = {
            type: element.classList.contains('image-container') ? 'image' : 
                  element.classList.contains('sticker') ? 'sticker' : 'text',
            top: element.style.top,
            left: element.style.left,
            width: element.style.width || element.offsetWidth + 'px',
            height: element.style.height || element.offsetHeight + 'px'
        };
          if (elementData.type === 'image') {
            const img = element.querySelector('img');
            if (img && img.src) {
                // 检查图片数据大小 - 严格限制为300KB的base64数据
                if (img.src.length > 400000) {
                    showToast('检测到过大的图片数据，请使用更小的图片', 'error');
                    return;
                }
                elementData.src = img.src;
                totalContentSize += img.src.length;
            }
        } else if (elementData.type === 'sticker') {
            elementData.content = element.textContent;
        } else if (elementData.type === 'text') {
            elementData.content = element.textContent;
        }
        content.push(elementData);
    });
    
    // 检查总内容大小
    const contentObj = {
        tag: selectedTag,
        elements: content
    };
    
    let contentString;    try {
        contentString = JSON.stringify(contentObj);
        
        // 检查JSON字符串大小（严格限制为60KB以避免数据库截断）
        if (contentString.length > 60000) {
            showToast('手账内容过大，请减少图片数量或使用更小的图片', 'error');
            console.error('内容过大，长度:', contentString.length);
            return;
        }
        
        console.log('[DEBUG] 准备保存的内容长度:', contentString.length);
        
    } catch (stringifyError) {
        console.error('JSON序列化失败:', stringifyError);
        showToast('手账内容序列化失败，请检查图片格式', 'error');
        return;
    }

    try {        // 修改：调用API保存手账
        if (currentEditingId) {
            // 编辑模式：更新现有手账
            const response = await apiRequest(`/api/handbooks/${currentEditingId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    title: title,
                    content: contentString,
                    tags: [selectedTag] // 传递标签数组
                })
            });
            
            if (response && response.ok) {
                const result = await response.json();
                if (result.code === 0) {
                    showToast('手账更新成功', 'success');
                } else {
                    showToast('更新失败: ' + result.msg, 'error');
                    return;
                }
            } else {
                showToast('更新手账失败', 'error');
                return;
            }
            currentEditingId = null;
        } else {
            // 新建模式：创建新手账
            const response = await apiRequest('/api/handbooks', {
                method: 'POST',
                body: JSON.stringify({
                    title: title,
                    content: contentString,
                    tags: [selectedTag] // 传递标签数组
                })
            });
            
            if (response && response.ok) {
                const result = await response.json();
                if (result.code === 0) {
                    showToast('手账创建成功', 'success');
                } else {
                    showToast('创建失败: ' + result.msg, 'error');
                    return;
                }
            } else {
                showToast('创建手账失败', 'error');
                return;
            }
        }
        
        // 重新加载手账列表
        await loadHandbooksFromAPI();
        renderSidebarTags();
        closeNewFileModal();
        
    } catch (error) {
        console.error('[ERROR] 保存手账失败:', error);
        showToast('保存手账失败: ' + error.message, 'error');
    }
}

// ===== 渲染函数 =====

function renderHandbookList(filterTag = null) {
    if (!handbookList) return;
    
    handbookList.innerHTML = '';
    let list = handbooks;
      if (filterTag && filterTag !== 'all') {
        list = handbooks.filter(hb => {
            // 使用后端返回的标签数据，如果没有标签则按"未分类"处理
            const handbookTags = hb.tags && hb.tags.length > 0 ? hb.tags : ['未分类'];
            return handbookTags.includes(filterTag);
        });
    }
    
    if (list.length === 0) {
        handbookList.innerHTML = `
            <div class="col-span-full text-center py-12">
                <div class="w-20 h-20 bg-gradient-to-br from-primary/10 to-primary/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i class="fa-solid fa-book text-3xl text-primary/60"></i>
                </div>
                <p class="text-lg text-gray-500 font-medium">暂无手账</p>
                <p class="text-gray-400 mt-1">点击"新建手账"开始创作吧</p>
            </div>
        `;
        return;
    }
      list.forEach((hb, index) => {
        // 使用后端返回的标签数据，如果没有标签则显示"未分类"
        const handbookTags = hb.tags && hb.tags.length > 0 ? hb.tags : [];
        const displayTag = handbookTags.length > 0 ? handbookTags[0] : '未分类';
        
        // 尝试解析content以获取元素数量（保持向后兼容）
        let elementCount = 0;
        try {
            const contentData = parseHandbookContent(hb.content);
            elementCount = contentData.elements ? contentData.elements.length : 0;
        } catch (error) {
            console.warn('解析手账内容失败:', error);
            elementCount = 0;
        }
        
        // 为每个标签分配协调的颜色
        const tagIndex = tags.indexOf(displayTag);
        const colorIndex = tagIndex >= 0 ? tagIndex : tags.length;
        const tagColor = tagColors[colorIndex % tagColors.length];
        
        const card = document.createElement('div');
        // 完全使用白色背景，不要任何彩色装饰
        card.className = 'card card-hover bg-white backdrop-blur-sm cursor-pointer shadow-lg rounded-2xl flex flex-col justify-between items-stretch book-card p-6 m-auto border border-gray-200 transition-all duration-300 hover:shadow-xl hover:-translate-y-1';
        card.innerHTML = `
            <div class="flex justify-between items-start mb-4">
                <span class="font-bold text-xl text-primary flex-1 pr-3">${hb.title}</span>
                <div class="flex gap-2">
                    <button class="edit-handbook-btn text-primary/70 hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-all duration-300" data-id="${hb.id}" title="编辑">
                        <i class="fa-solid fa-edit text-base"></i>
                    </button>
                    <button class="delete-handbook-btn text-red-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all duration-300" data-id="${hb.id}" title="删除">
                        <i class="fa-solid fa-trash text-base"></i>
                    </button>
                </div>
            </div>
            <div class="flex justify-between items-center mb-4">
                <span class="text-sm text-white px-3 py-1.5 rounded-full font-medium" style="background-color: ${tagColor}">${displayTag}</span>
                <span class="text-gray-500 text-sm bg-gray-100 px-3 py-1 rounded-full">${elementCount}个元素</span>
            </div>
            <div class="text-center">
                <button class="preview-btn w-full py-3 bg-primary text-white rounded-xl font-medium transition-all duration-300 hover:shadow-lg hover:scale-[1.02] hover:bg-accent" data-id="${hb.id}">
                    <i class="fa-solid fa-eye mr-2"></i>预览手账
                </button>
            </div>
        `;
        
        // 绑定预览按钮事件
        card.querySelector('.preview-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            previewHandbook(hb.id);
        });
        
        // 绑定编辑按钮事件
        card.querySelector('.edit-handbook-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            openEditHandbook(hb.id);
        });
        
        // 绑定删除按钮事件
        card.querySelector('.delete-handbook-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteHandbook(hb.id);
        });
        
        handbookList.appendChild(card);
    });
}

// 颜色调整辅助函数
function adjustColor(color, amount) {
    const usePound = color[0] === '#';
    const col = usePound ? color.slice(1) : color;
    const num = parseInt(col, 16);
    let r = (num >> 16) + amount;
    let g = (num >> 8 & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;
    r = r > 255 ? 255 : r < 0 ? 0 : r;
    g = g > 255 ? 255 : g < 0 ? 0 : g;
    b = b > 255 ? 255 : b < 0 ? 0 : b;
    return (usePound ? '#' : '') + (r << 16 | g << 8 | b).toString(16).padStart(6, '0');
}

// 修改：预览手账功能，解析数据库内容
function previewHandbook(id) {
    const hb = handbooks.find(h => h.id === id);
    if (!hb) return;
    
    const previewModal = document.getElementById('preview-modal');
    const previewTitle = document.getElementById('preview-title');
    const previewContent = document.getElementById('preview-content');
    const editBtn = document.getElementById('edit-handbook-btn');
    const deleteBtn = document.getElementById('delete-handbook-btn');
    
    if (!previewModal || !previewTitle || !previewContent) return;    previewTitle.textContent = hb.title;
    previewContent.innerHTML = '';
    
    const contentData = parseHandbookContent(hb.content);
    const elements = contentData.elements;
    
    if (elements.length === 0) {
        previewContent.innerHTML = `
            <div class="text-center py-8 text-gray-500">
                <i class="fa-solid fa-book-open text-4xl mb-3 opacity-50"></i>
                <p>这个手账还没有添加任何内容</p>
            </div>
        `;
    } else {
        // 渲染手账内容（只读模式）
        elements.forEach(item => {
            try {
                if (item.type === 'image' && item.src) {
                    const imgContainer = document.createElement('div');
                    imgContainer.style.position = 'absolute';
                    imgContainer.style.top = item.top || '0px';
                    imgContainer.style.left = item.left || '0px';
                    imgContainer.style.width = item.width || 'auto';
                    imgContainer.style.height = item.height || 'auto';
                    
                    const img = document.createElement('img');
                    img.src = item.src;
                    img.style.maxWidth = '100%';
                    img.style.height = 'auto';
                    img.style.borderRadius = '8px';
                    img.onerror = function() {
                        this.parentElement.innerHTML = '<div class="p-2 bg-red-100 text-red-600 rounded">图片加载失败</div>';
                    };
                    
                    imgContainer.appendChild(img);
                    previewContent.appendChild(imgContainer);
                } else if (item.type === 'sticker' && item.content) {
                    const sticker = document.createElement('div');
                    sticker.style.position = 'absolute';
                    sticker.style.top = item.top || '0px';
                    sticker.style.left = item.left || '0px';
                    sticker.style.fontSize = '2rem';
                    sticker.textContent = item.content;
                    previewContent.appendChild(sticker);
                } else if (item.type === 'text' && item.content) {
                    const textBox = document.createElement('div');
                    textBox.style.position = 'absolute';
                    textBox.style.top = item.top || '0px';
                    textBox.style.left = item.left || '0px';
                    textBox.style.backgroundColor = 'rgba(255,255,255,0.9)';
                    textBox.style.borderRadius = '8px';
                    textBox.style.padding = '0.5rem';
                    textBox.style.minWidth = '150px';
                    textBox.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    textBox.textContent = item.content;
                    previewContent.appendChild(textBox);
                }
            } catch (elementError) {
                console.error('渲染元素失败:', elementError, item);
            }
        });
    }
    
    // 绑定编辑和删除按钮
    if (editBtn) {
        editBtn.onclick = () => {
            previewModal.classList.add('hidden');
            openEditHandbook(id);
        };
    }
    
    if (deleteBtn) {
        deleteBtn.onclick = () => {
            previewModal.classList.add('hidden');
            deleteHandbook(id);
        };
    }
    
    previewModal.classList.remove('hidden');
}

// 修改：删除手账功能，调用API
async function deleteHandbook(id) {
    const hb = handbooks.find(h => h.id === id);
    if (!hb) return;
    
    showConfirm(
        '删除手账',
        `确定要删除手账"${hb.title}"吗？此操作不可恢复。`,
        async () => {
            try {
                const response = await apiRequest(`/api/handbooks/${id}`, {
                    method: 'DELETE'
                });
                
                if (response && response.ok) {
                    const result = await response.json();
                    if (result.code === 0) {
                        showToast('手账删除成功', 'success');
                        await loadHandbooksFromAPI(); // 重新加载列表
                        renderSidebarTags();
                    } else {
                        showToast('删除失败: ' + result.msg, 'error');
                    }
                } else {
                    showToast('删除手账失败', 'error');
                }
            } catch (error) {
                console.error('[ERROR] 删除手账失败:', error);
                showToast('删除手账失败: ' + error.message, 'error');
            }
        }
    );
}

// 修改：编辑手账功能，解析数据库内容
function openEditHandbook(id) {
    const hb = handbooks.find(h => h.id === id);
    if (!hb) return;
    
    currentEditingId = id;
    
    // 打开模态框
    const newFileModal = document.getElementById('new-file-modal');
    const fileTitleInput = document.getElementById('file-title-input');
    
    if (newFileModal && fileTitleInput) {
        newFileModal.classList.remove('hidden');
        fileTitleInput.value = hb.title;
        
        // 设置标签
        renderTagOptions();        const tagSelect = document.getElementById('file-tag-select');
        const newTagInput = document.getElementById('new-tag-input');
        
        const contentData = parseHandbookContent(hb.content);
        const tag = contentData.tag;
        
        if (tagSelect) {
            tagSelect.value = tags.includes(tag) ? tag : '';
        }
        if (newTagInput) {
            newTagInput.classList.add('hidden');
        }
        
        // 清空并回填内容
        if (handbookEditor) {
            handbookEditor.innerHTML = '';
            const elements = contentData.elements;
            
            elements.forEach(item => {
                try {
                    if (item.type === 'image' && item.src) {
                        const imgContainer = document.createElement('div');
                        imgContainer.className = 'image-container';
                        imgContainer.style.position = 'absolute';
                        imgContainer.style.top = item.top || '50px';
                        imgContainer.style.left = item.left || '50px';
                        imgContainer.style.width = item.width || 'auto';
                        imgContainer.style.height = item.height || 'auto';
                        
                        const img = document.createElement('img');
                        img.src = item.src;
                        img.style.maxWidth = '200px';
                        img.style.height = 'auto';
                        img.onerror = function() {
                            showToast('图片加载失败', 'error');
                            imgContainer.remove();
                        };
                        
                        imgContainer.appendChild(img);
                        
                        // 添加调整大小手柄
                        ['se','ne','sw','nw'].forEach(dir => {
                            const handle = document.createElement('div');
                            handle.className = 'resize-handle resize-handle-' + dir;
                            imgContainer.appendChild(handle);
                        });
                        
                        handbookEditor.appendChild(imgContainer);
                        bindElementEvents(imgContainer);
                    } else if (item.type === 'sticker' && item.content) {
                        const sticker = document.createElement('div');
                        sticker.className = 'sticker';
                        sticker.style.position = 'absolute';
                        sticker.style.top = item.top || '50px';
                        sticker.style.left = item.left || '50px';
                        sticker.style.fontSize = '2rem';
                        sticker.textContent = item.content;
                        const resizeSE = document.createElement('div');
                        resizeSE.className = 'resize-handle resize-handle-se';
                        sticker.appendChild(resizeSE);
                        handbookEditor.appendChild(sticker);
                        bindElementEvents(sticker);
                    } else if (item.type === 'text' && item.content) {
                        const textBox = document.createElement('div');
                        textBox.className = 'text-box';
                        textBox.style.position = 'absolute';
                        textBox.style.top = item.top || '50px';
                        textBox.style.left = item.left || '50px';
                        textBox.style.backgroundColor = 'rgba(255,255,255,0.7)';
                        textBox.style.borderRadius = '5px';
                        textBox.style.padding = '0.5rem';
                        textBox.style.minWidth = '150px';
                        textBox.setAttribute('contenteditable', 'true');
                        textBox.textContent = item.content;
                        const resizeSE = document.createElement('div');
                        resizeSE.className = 'resize-handle resize-handle-se';
                        textBox.appendChild(resizeSE);
                        handbookEditor.appendChild(textBox);
                        bindElementEvents(textBox);
                    }
                } catch (elementError) {
                    console.error('恢复元素失败:', elementError, item);
                }
            });
            
            // 如果没有任何元素，显示提示
            if (handbookEditor.children.length === 0) {
                handbookEditor.innerHTML = `
                    <div class="text-center text-gray-400 mt-10">
                        <p>手账内容恢复失败或为空</p>
                        <p class="text-sm mt-2">可以重新添加内容</p>
                    </div>
                `;
            }
        }
    }
}

// 图片上传相关函数
function openImageUploadModal() {
    const imageUploadModal = document.getElementById('image-upload-modal');
    const imageUploadInput = document.getElementById('image-upload-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const confirmImageBtn = document.getElementById('confirm-image-btn');
    
    if (imageUploadModal) {
        imageUploadModal.classList.remove('hidden');
    }
    if (imageUploadInput) {
        imageUploadInput.value = '';
    }
    if (imagePreviewContainer) {
        imagePreviewContainer.classList.add('hidden');
    }
    if (confirmImageBtn) {
        confirmImageBtn.disabled = true;
    }
}

function closeImageUploadModal() {
    const imageUploadModal = document.getElementById('image-upload-modal');
    if (imageUploadModal) {
        imageUploadModal.classList.add('hidden');
    }
}

function insertImage() {
    const imagePreview = document.getElementById('image-preview');
    if (imagePreview && imagePreview.src && handbookEditor) {
        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';
        imgContainer.style.position = 'absolute';
        imgContainer.style.top = '50px';
        imgContainer.style.left = '50px';
        
        const img = document.createElement('img');
        img.src = imagePreview.src;
        img.style.maxWidth = '200px';
        img.style.height = 'auto';
        
        // 添加调整大小手柄
        const resizeSE = document.createElement('div');
        resizeSE.className = 'resize-handle resize-handle-se';
        
        const resizeNE = document.createElement('div');
        resizeNE.className = 'resize-handle resize-handle-ne';
        
        const resizeSW = document.createElement('div');
        resizeSW.className = 'resize-handle resize-handle-sw';
        
        const resizeNW = document.createElement('div');
        resizeNW.className = 'resize-handle resize-handle-nw';
        
        imgContainer.appendChild(img);
        imgContainer.appendChild(resizeSE);
        imgContainer.appendChild(resizeNE);
        imgContainer.appendChild(resizeSW);
        imgContainer.appendChild(resizeNW);
        
        // 清空编辑器提示文本
        if (handbookEditor.querySelector('.text-center')) {
            handbookEditor.innerHTML = '';
        }
        
        handbookEditor.appendChild(imgContainer);
        
        // 绑定事件
        bindElementEvents(imgContainer);
        
        closeImageUploadModal();
    }
}

// 添加贴纸
function addSticker(stickerType = 'heart') {
    if (!handbookEditor) return;
    
    const stickers = {
        heart: '❤️',
        star: '⭐',
        smile: '😊',
        flower: '🌸',
        sun: '☀️'
    };
    
    const sticker = document.createElement('div');
    sticker.className = 'sticker';
    sticker.style.position = 'absolute';
    sticker.style.top = '50px';
    sticker.style.left = '50px';
    sticker.style.fontSize = '2rem';
    sticker.textContent = stickers[stickerType] || stickers.heart;
    
    // 添加调整大小手柄
    const resizeSE = document.createElement('div');
    resizeSE.className = 'resize-handle resize-handle-se';
    
    sticker.appendChild(resizeSE);
    
    // 清空编辑器提示文本
    if (handbookEditor.querySelector('.text-center')) {
        handbookEditor.innerHTML = '';
    }
    
    handbookEditor.appendChild(sticker);
    
    // 绑定事件
    bindElementEvents(sticker);
}

// 修改：优化文本框添加功能，确保光标在左上角
function addTextBox() {
    if (!handbookEditor) return;
    
    const textBox = document.createElement('div');
    textBox.className = 'text-box';
    textBox.style.position = 'absolute';
    textBox.style.top = '50px';
    textBox.style.left = '50px';
    textBox.style.backgroundColor = 'rgba(255, 255, 255, 0.9)';
    textBox.style.borderRadius = '8px';
    textBox.style.padding = '12px';
    textBox.style.minWidth = '200px';
    textBox.style.minHeight = '60px';
    textBox.style.border = '2px dashed #d1d5db';
    textBox.style.fontSize = '14px';
    textBox.style.lineHeight = '1.5';
    
    // 确保文本从左上角开始
    textBox.style.textAlign = 'left';
    textBox.style.verticalAlign = 'top';
    textBox.style.display = 'inline-block';
    textBox.style.direction = 'ltr';
    textBox.style.writingMode = 'horizontal-tb';
      textBox.setAttribute('contenteditable', 'true');
    textBox.setAttribute('data-placeholder', '点击这里输入文本...');
    textBox.setAttribute('title', '点击中心区域编辑文本，点击边框区域拖拽移动');
    
    // 设置占位符样式
    textBox.innerHTML = '<span class="placeholder-text" style="color: #9ca3af; pointer-events: none;">点击这里输入文本...</span>';
    
    // 添加调整大小手柄 - 位置设置为右下角
    const resizeSE = document.createElement('div');
    resizeSE.className = 'resize-handle resize-handle-se';
    resizeSE.style.position = 'absolute';
    resizeSE.style.bottom = '-8px';
    resizeSE.style.right = '-8px';
    resizeSE.style.width = '16px';
    resizeSE.style.height = '16px';
    resizeSE.style.background = 'linear-gradient(135deg, #8B7355, #A0956B)';
    resizeSE.style.borderRadius = '50%';
    resizeSE.style.border = '2px solid white';
    resizeSE.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
    resizeSE.style.cursor = 'se-resize';
    resizeSE.style.zIndex = '10';
    
    textBox.appendChild(resizeSE);
    
    // 清空编辑器提示文本
    if (handbookEditor.querySelector('.text-center')) {
        handbookEditor.innerHTML = '';
    }
      handbookEditor.appendChild(textBox);
    
    // 绑定事件
    bindElementEvents(textBox);
      // 优化焦点和占位符处理
    textBox.addEventListener('focus', function() {
        const placeholder = this.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.remove();
        }
        this.style.border = '2px solid #8B7355';
        this.style.boxShadow = '0 0 0 4px rgba(139, 115, 85, 0.1)';
        
        // 只有在文本框为空或只有占位符时才设置光标到开始位置
        setTimeout(() => {
            const hasRealContent = this.textContent.trim() !== '';
            
            if (!hasRealContent) {
                // 文本框为空时，设置光标到开始位置
                const range = document.createRange();
                const selection = window.getSelection();
                
                // 确保有可编辑内容
                if (this.childNodes.length === 0 || 
                    (this.childNodes.length === 1 && this.childNodes[0].classList && this.childNodes[0].classList.contains('resize-handle'))) {
                    this.textContent = '';
                }
                
                range.selectNodeContents(this);
                range.collapse(true);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            // 如果有内容，不做任何处理，让浏览器自然处理光标位置
        }, 10);
    });
    
    textBox.addEventListener('blur', function() {
        this.style.border = '2px dashed #d1d5db';
        this.style.boxShadow = 'none';
        
        // 如果内容为空，重新显示占位符
        if (this.textContent.trim() === '') {
            this.innerHTML = '<span class="placeholder-text" style="color: #9ca3af; pointer-events: none;">点击这里输入文本...</span>';
        }
    });
      textBox.addEventListener('input', function() {
        // 移除占位符
        const placeholder = this.querySelector('.placeholder-text');
        if (placeholder) {
            placeholder.remove();
        }
    });

    // 添加鼠标移动事件，动态改变光标样式
    textBox.addEventListener('mousemove', function(e) {
        const rect = this.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const borderWidth = 20;
        
        const isNearBorder = x < borderWidth || 
                           x > rect.width - borderWidth || 
                           y < borderWidth || 
                           y > rect.height - borderWidth;
        
        if (isNearBorder) {
            this.style.cursor = 'move';
            this.title = '拖拽移动文本框';
        } else {
            this.style.cursor = 'text';
            this.title = '点击编辑文本内容';
        }
    });
    
    textBox.addEventListener('mouseleave', function() {
        this.style.cursor = 'text';
        this.title = '点击中心区域编辑文本，点击边框区域拖拽移动';
    });

    // 立即聚焦新创建的文本框
    setTimeout(() => {
        textBox.focus();
    }, 100);
}

// 绑定元素事件
function bindElementEvents(element) {
    // 检查是否已经绑定过事件，避免重复绑定
    if (element.hasAttribute('data-events-bound')) {
        return;
    }
    
    element.addEventListener('mousedown', function(e) {
        // 如果点击的是调整大小手柄
        if (e.target.classList.contains('resize-handle')) {
            currentAction = 'resize';
            
            if (e.target.classList.contains('resize-handle-se')) {
                resizeDirection = 'se';
            } else if (e.target.classList.contains('resize-handle-ne')) {
                resizeDirection = 'ne';
            } else if (e.target.classList.contains('resize-handle-sw')) {
                resizeDirection = 'sw';
            } else if (e.target.classList.contains('resize-handle-nw')) {
                resizeDirection = 'nw';
            }
            
            selectedElement = element;
            isDragging = true;
            
            // 防止选中其他文本
            e.preventDefault();
        }        // 如果点击的是元素本身
        else if (e.target === element || element.contains(e.target)) {
            // 对于文本框的特殊处理
            if (element.classList.contains('text-box')) {
                // 取消之前选中的元素
                if (selectedElement) {
                    selectedElement.classList.remove('element-selected');
                }
                
                // 设置当前选中元素
                selectedElement = element;
                element.classList.add('element-selected');
                
                // 判断点击位置：如果点击在边框附近，启用拖拽；如果点击在中心区域，允许编辑
                const rect = element.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const borderWidth = 20; // 边框区域宽度
                
                const isNearBorder = clickX < borderWidth || 
                                   clickX > rect.width - borderWidth || 
                                   clickY < borderWidth || 
                                   clickY > rect.height - borderWidth;
                
                if (isNearBorder) {
                    // 点击在边框附近，启用拖拽
                    offsetX = clickX;
                    offsetY = clickY;
                    currentAction = 'move';
                    isDragging = true;
                    e.preventDefault();
                } else {
                    // 点击在中心区域，允许编辑，不启用拖拽
                    return;
                }
            } else {
                // 非文本框元素的正常处理
                // 取消之前选中的元素
                if (selectedElement) {
                    selectedElement.classList.remove('element-selected');
                }
                
                // 设置当前选中元素
                selectedElement = element;
                element.classList.add('element-selected');
                
                // 计算鼠标相对元素的偏移量
                const rect = element.getBoundingClientRect();
                offsetX = e.clientX - rect.left;
                offsetY = e.clientY - rect.top;
                
                currentAction = 'move';
                isDragging = true;
                e.preventDefault();
            }
        }
    });
      // 添加右键菜单支持
    element.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        
        // 选中当前元素
        if (selectedElement) {
            selectedElement.classList.remove('element-selected');
        }
        selectedElement = element;
        element.classList.add('element-selected');
        
        // 显示删除确认
        const elementType = element.classList.contains('sticker') ? '贴纸' : 
                           element.classList.contains('text-box') ? '文本框' : 
                           element.classList.contains('image-container') ? '图片' : '元素';
        
        showConfirm(
            '删除确认',
            `确定要删除这个${elementType}吗？`,
            () => {
                // 直接删除元素，不再调用deleteSelectedElement()避免重复弹窗
                if (selectedElement) {
                    selectedElement.remove();
                    selectedElement = null;
                    showToast(`${elementType}已删除`, 'success');
                }            }
        );
    });
    
    // 标记已绑定事件
    element.setAttribute('data-events-bound', 'true');
}

// 处理编辑器鼠标按下事件
function handleEditorMouseDown(e) {
    // 如果点击的是编辑器空白处，取消选中
    if (e.target === handbookEditor) {
        if (selectedElement) {
            selectedElement.classList.remove('element-selected');
            selectedElement = null;
        }
    }
}

// 处理鼠标移动事件
function handleMouseMove(e) {
    if (!isDragging || !handbookEditor) return;
    
    if (currentAction === 'move' && selectedElement) {
        // 移动元素
        const editorRect = handbookEditor.getBoundingClientRect();
        const newX = e.clientX - editorRect.left - offsetX;
        const newY = e.clientY - editorRect.top - offsetY;
        
        // 确保元素不超出编辑器边界
        const elementWidth = selectedElement.offsetWidth;
        const elementHeight = selectedElement.offsetHeight;
        
        const maxX = editorRect.width - elementWidth;
        const maxY = editorRect.height - elementHeight;
        
        selectedElement.style.left = Math.max(0, Math.min(newX, maxX)) + 'px';
        selectedElement.style.top = Math.max(0, Math.min(newY, maxY)) + 'px';
    } 
    else if (currentAction === 'resize' && selectedElement) {
        // 调整元素大小
        const editorRect = handbookEditor.getBoundingClientRect();
        const elementRect = selectedElement.getBoundingClientRect();
        
        let newWidth, newHeight;
        
        if (resizeDirection === 'se') {
            newWidth = e.clientX - elementRect.left;
            newHeight = e.clientY - elementRect.top;
        } else if (resizeDirection === 'ne') {
            newWidth = e.clientX - elementRect.left;
            newHeight = elementRect.top + elementRect.height - e.clientY;
            selectedElement.style.top = e.clientY - editorRect.top + 'px';
        } else if (resizeDirection === 'sw') {
            newWidth = elementRect.right - e.clientX;
            newHeight = e.clientY - elementRect.top;
            selectedElement.style.left = e.clientX - editorRect.left + 'px';
        } else if (resizeDirection === 'nw') {
            newWidth = elementRect.right - e.clientX;
            newHeight = elementRect.top + elementRect.height - e.clientY;
            selectedElement.style.left = e.clientX - editorRect.left + 'px';
            selectedElement.style.top = e.clientY - editorRect.top + 'px';
        }
        
        // 确保最小尺寸
        newWidth = Math.max(50, newWidth);
        newHeight = Math.max(50, newHeight);
        
        // 确保不超出编辑器边界
        if (elementRect.left + newWidth <= editorRect.width) {
            if (selectedElement.tagName === 'IMG') {
                selectedElement.style.width = newWidth + 'px';
            } else {
                selectedElement.style.width = newWidth + 'px';
            }
        }
        
        if (elementRect.top + newHeight <= editorRect.height) {
            if (selectedElement.classList.contains('sticker')) {
                // 对于贴纸，调整字体大小
                const fontSize = Math.max(12, newHeight / 2);
                selectedElement.style.fontSize = fontSize + 'px';
            } else if (selectedElement.tagName === 'IMG') {
                // 对于图片，保持比例
                const img = selectedElement.querySelector('img');
                if (img) {
                    img.style.width = newWidth + 'px';
                    img.style.height = 'auto';
                }
            } else {
                selectedElement.style.height = newHeight + 'px';
            }
        }
    }
}

// 处理鼠标释放事件
function handleMouseUp() {
    isDragging = false;
    currentAction = null;
    resizeDirection = null;
}

// 打开标签管理模态框
function openTagManagementModal() {
    const tagModal = document.getElementById('tag-management-modal');
    if (tagModal) {
        tagModal.classList.remove('hidden');
        renderTagManagementList();
        
        // 清空输入框
        const newTagNameInput = document.getElementById('new-tag-name-input');
        if (newTagNameInput) {
            newTagNameInput.value = '';
            newTagNameInput.focus();
        }
    }
}

// 关闭标签管理模态框
function closeTagManagementModal() {
    const tagModal = document.getElementById('tag-management-modal');
    if (tagModal) {
        tagModal.classList.add('hidden');
    }
}

// 从模态框添加新标签 - 修改为使用localStorage
async function addNewTagFromModal() {
    // 修正：使用正确的输入框ID 'new-tag-name-input'
    const newTagInput = document.getElementById('new-tag-name-input');
    if (!newTagInput) {
        console.error('[ERROR] 无法找到标签名称输入框: #new-tag-name-input');
        return;
    }

    const newTagName = newTagInput.value.trim();
    if (!newTagName) {
        showToast('标签名称不能为空', 'error');
        return;
    }

    console.log(`[DEBUG] 准备从模态框添加新标签: ${newTagName}`);

    try {
        // 修正：确保API请求发往后端的正确端口 5000
        const response = await fetch('http://localhost:5000/api/user/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                tag_name: newTagName,
                color: '#007bff'
            })
        });

        const result = await response.json();
        if (result.code === 0) {
            // 添加标签到本地数组
            tags.push(newTagName);
            
            renderSidebarTags();
            renderTagOptions();
            renderTagManagementList();
            
            // 清空输入框
            newTagInput.value = '';
            newTagInput.focus();
            
            showToast('标签添加成功', 'success');
        } else {
            showToast('添加标签失败: ' + result.msg, 'error');
        }
    } catch (error) {
        console.error('添加标签失败:', error);
        showToast('添加标签失败: ' + error.message, 'error');
    }
}

// 渲染标签管理列表
function renderTagManagementList() {
    const tagListContainer = document.getElementById('tag-list');
    if (!tagListContainer) return;
    
    tagListContainer.innerHTML = '';
    
    if (tags.length === 0) {
        tagListContainer.innerHTML = '<p class="text-gray-500 text-sm">暂无标签</p>';
        return;
    }
    
    tags.forEach((tag, index) => {
        const tagColor = tagColors[index % tagColors.length];        // 检查该标签是否有手账在使用
        const handbooksUsingTag = handbooks.filter(hb => {
            const contentData = parseHandbookContent(hb.content);
            return contentData.tag === tag;
        });
        
        const tagItem = document.createElement('div');
        tagItem.className = 'flex items-center justify-between p-3 bg-gray-50 rounded-lg';
        tagItem.innerHTML = `
            <div class="flex items-center">
                <div class="w-4 h-4 rounded-full mr-3" style="background-color: ${tagColor}"></div>
                <div>
                    <span class="font-medium text-gray-800">${tag}</span>
                    <span class="text-xs text-gray-500 ml-2">(${handbooksUsingTag.length} 个手账)</span>
                </div>
            </div>
            <button class="delete-tag-btn text-red-500 hover:text-red-700 p-1 rounded transition-colors" data-tag="${tag}" data-count="${handbooksUsingTag.length}" title="删除标签">
                <i class="fa-solid fa-trash text-sm"></i>
            </button>
        `;
        
        // 绑定删除按钮事件
        const deleteBtn = tagItem.querySelector('.delete-tag-btn');
        deleteBtn.addEventListener('click', () => {
            deleteTag(tag, handbooksUsingTag.length);
        });
        
        tagListContainer.appendChild(tagItem);
    });
}

// 删除标签功能
function deleteTag(tagName, handbookCount) {
    if (handbookCount > 0) {
        // 如果有手账使用此标签，询问用户是否确认删除
        showConfirm(
            '删除标签',
            `标签"${tagName}"下有 ${handbookCount} 个手账。删除标签后，这些手账将被归类为"未分类"。确定要删除吗？`,
            () => {
                executeDeleteTag(tagName);
            }
        );
    } else {
        // 如果没有手账使用此标签，直接删除
        showConfirm(
            '删除标签',
            `确定要删除标签"${tagName}"吗？`,
            () => {
                executeDeleteTag(tagName);
            }
        );
    }
}

// 执行删除标签操作 - 修改为使用localStorage
async function executeDeleteTag(tagName) {
    try {
        // 首先获取用户标签ID
        const userTagsResponse = await fetch('http://localhost:5000/api/user/tags', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            }
        });

        let tagId = null;
        if (userTagsResponse.ok) {
            const userTagsResult = await userTagsResponse.json();
            if (userTagsResult.code === 0) {
                const targetTag = userTagsResult.data.find(tag => tag.tag_name === tagName);
                if (targetTag) {
                    tagId = targetTag.id;
                }
            }
        }

        if (tagId) {
            // 调用API删除标签（后端会自动处理相关手账的标签更新）
            const response = await fetch(`http://localhost:5000/api/user/tags/${tagId}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            const result = await response.json();
            if (result.code === 0) {
                // 1. 从标签数组中移除
                const tagIndex = tags.indexOf(tagName);
                if (tagIndex > -1) {
                    tags.splice(tagIndex, 1);
                }
                
                showToast('标签删除成功', 'success');
           
            } else {
                showToast('删除标签失败: ' + result.msg, 'error');
                return;
            }
        } else {
            // 如果找不到标签ID，至少从本地移除
            const tagIndex = tags.indexOf(tagName);
            if (tagIndex > -1) {
                tags.splice(tagIndex, 1);
            }
            showToast('标签删除成功', 'success');        }
        
        // 3. 刷新界面
        renderSidebarTags();
        renderTagOptions();
        renderTagManagementList();
        await loadHandbooksFromAPI(); // 重新加载手账列表以反映标签变化
        
    } catch (error) {
        console.error('删除标签失败:', error);
        showToast('删除标签失败: ' + error.message, 'error');
    }
}

// 删除选中元素
function deleteSelectedElement() {
    if (!selectedElement) return;
    
    // 显示确认对话框
    const elementType = selectedElement.classList.contains('sticker') ? '贴纸' : 
                       selectedElement.classList.contains('text-box') ? '文本框' : 
                       selectedElement.classList.contains('image-container') ? '图片' : '元素';
    
    showConfirm(
        '删除确认',
        `确定要删除这个${elementType}吗？`,
        () => {
            // 确认删除
            if (selectedElement) {
                selectedElement.remove();
                selectedElement = null;
                showToast(`${elementType}已删除`, 'success');
            }
        }
    );
}

// 添加新标签
async function addNewTag() {
    const newTagInput = document.getElementById('new-tag-input');
    if (!newTagInput) return;

    const newTagName = newTagInput.value.trim();
    if (!newTagName) {
        showToast('标签名称不能为空', 'error');
        return;
    }

    console.log(`[DEBUG] 准备添加新标签: ${newTagName}`);

    try {
        const response = await fetch('http://localhost:5000/api/user/tags', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ tag_name: newTagName })
        });

        // 无论成功失败，都尝试解析响应
        let result;
        const responseText = await response.text(); // 先获取文本，避免json解析失败
        try {
            result = JSON.parse(responseText);
        } catch (e) {
            // 如果JSON解析失败，说明响应不是有效的JSON
            console.error('[ERROR] 添加标签响应JSON解析失败:', e);
            // 将原始响应文本作为错误消息显示
            showToast(`操作失败: ${responseText}`, 'error');
            return;
        }

        if (result.code === 0) {
            console.log('[DEBUG] 添加标签成功:', result);
            showToast('新标签添加成功', 'success');
            
            // 清空输入框并关闭模态框
            newTagInput.value = '';
            const newTagModal = document.getElementById('new-tag-modal');
            if (newTagModal) {
                newTagModal.classList.add('hidden');
            }
            
            // 重新加载标签列表
            await loadTagsFromAPI();
        } else {
            // API返回了业务错误，例如标签已存在
            console.warn('[WARN] 添加标签失败:', result.msg);
            showToast(result.msg || '添加标签失败', 'error');
        }

    } catch (error) {
        console.error('[ERROR] 添加新标签时发生网络或未知错误:', error);
        showToast('添加新标签失败，请检查网络连接', 'error');
    }
}