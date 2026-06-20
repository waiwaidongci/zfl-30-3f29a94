# 水下考古潜水记录

## 使用说明

直接打开 `index.html` 使用。点击沉船平面图添加标记，管理潜次档案，支持筛选、编辑、删除、时间线查看、导出和导入JSON。

### 模块切换

右侧面板分为两个标签页：

- **标记管理**：管理水下考古标记的添加、编辑、删除
- **潜次档案**：管理每次下潜的档案信息，查看统计摘要

### 基本操作

#### 标记管理

- **添加标记**：点击地图任意位置，填写右侧表单信息后点击「保存标记」
- **编辑标记**：点击地图上的标记点或右侧列表中的标记项，修改信息后保存
- **删除标记**：选中标记后点击「删除」按钮
- **筛选标记**：使用地图上方下拉菜单按类型或潜次筛选，或切换「标记列表」/「潜次时间线」视图
- **关联潜次**：添加或编辑标记时，从下拉菜单选择所属潜次

#### 潜次档案

- **添加潜次**：在「潜次档案」标签页填写表单，点击「保存潜次」
- **编辑潜次**：点击潜次列表中的「编辑」按钮，修改后保存
- **删除潜次**：点击「删除」按钮。若该潜次有关联标记，系统会提示并自动清空关联标记的潜次字段
- **查看详情**：点击潜次列表中的「详情」按钮或直接点击列表项，查看潜次完整信息和关联标记
- **统计摘要**：潜次档案顶部显示统计数据，包括潜次总数、标记总数、平均每潜次标记数、类型数

### 标记与潜次的关联

- 所有标记通过 `dive` 字段与潜次档案自动关联
- 首次使用时，系统会根据现有标记的 `dive` 字段自动创建对应的潜次档案
- 修改潜次编号时，所有关联标记的 `dive` 字段会自动同步更新
- 删除潜次时，关联标记的 `dive` 字段会被清空，但标记本身不会被删除

### 导出JSON

点击右上角「导出JSON」按钮，当前所有潜次档案和标记将以完整格式 `dive-records.json` 文件名下载。

导出文件包含完整数据结构：

```json
{
  "version": "2.0",
  "exportDate": "2025-06-20T08:00:00.000Z",
  "dives": [...],
  "marks": [...]
}
```

### 导入JSON

点击右上角「导入JSON」按钮，选择导出的文件进行合并导入。

系统支持两种格式：

1. **完整数据格式（v2.0）**：包含 `dives` 和 `marks` 字段的对象格式（推荐）
2. **传统标记数组格式**：仅包含标记数组（兼容旧版本导出文件）

#### 导入预览

导入前会显示预览摘要，包括潜次档案和标记数据的：

1. **新增项**（绿色）：本地不存在的新项目，将被直接添加
2. **冲突项**（黄色）：与本地编号相同的项，可选择处理方式
3. **格式错误**（红色）：数据格式有误的项，将被跳过

#### 冲突处理

对于同编号冲突的项，可针对每一项单独选择处理方式，或使用批量操作：

- **保留本地**：保留当前本地数据，忽略导入数据
- **覆盖本地**：用导入数据覆盖本地数据
- **另存为新编号**：将导入数据以新编号保存

### 数据格式

#### 潜次档案格式

```json
{
  "id": "uuid",
  "code": "DIVE-01",
  "date": "2025-06-15",
  "leader": "张教授",
  "weather": "sunny",
  "current": "weak",
  "visibility": "5-8米",
  "objective": "勘查船艉区域，采集陶瓷标本"
}
```

潜次必填字段：`code`、`date`、`leader`、`visibility`、`objective`

潜次可选字段：`weather`、`current`

天气有效值：`sunny`（晴）、`cloudy`（多云）、`rainy`（雨）、`windy`（大风）、`foggy`（雾）

水流有效值：`calm`（无流）、`weak`（弱流）、`moderate`（中流）、`strong`（强流）

#### 标记格式

```json
{
  "code": "A-017",
  "type": "ceramic",
  "dive": "DIVE-01",
  "depth": "17.8m",
  "x": 42,
  "y": 46,
  "orientation": "东",
  "condition": "边缘残缺",
  "note": "靠近船肋"
}
```

标记必填字段：`code`、`type`、`dive`、`depth`

标记可选字段：`orientation`、`condition`、`note`、`x`、`y`（坐标范围 0-100）

类型有效值：`ceramic`（陶片）、`wood`（木构件）、`metal`（金属件）、`unknown`（未知物）

### 本地持久化

所有数据自动保存在浏览器的 localStorage 中，刷新页面不会丢失。

- 标记数据存储键：`zfl30Marks`
- 潜次数据存储键：`zfl30Dives`

## 文件结构

```
zfl-30/
├── index.html          # 主页面
├── css/
│   └── styles.css      # 样式文件
├── js/
│   ├── dataIO.js       # 数据读写模块（localStorage、导入导出）
│   ├── validation.js   # 数据校验与冲突处理模块
│   ├── ui.js           # 界面渲染与交互模块
│   └── app.js          # 主应用逻辑
└── README.md           # 本文件
```

## 模块说明

### dataIO.js - 数据读写模块

负责所有数据的持久化和文件操作：
- `loadMarks()` / `saveMarks()` - 标记数据的本地存储读写
- `loadDives()` / `saveDives()` - 潜次档案的本地存储读写
- `exportFullData()` - 导出完整数据（包含潜次和标记）
- `exportMarksOnly()` - 仅导出标记数据（兼容旧版）
- `triggerFileInput()` / `readFileAsText()` / `parseJSON()` - 文件导入相关
- `isFullDataFormat()` - 检测导入文件格式

### validation.js - 数据校验模块

负责数据校验和冲突处理：
- `validateMark()` / `validateDive()` - 单项数据校验
- `validateMarkArray()` / `validateDiveArray()` - 数组校验
- `compareMarks()` / `compareDives()` - 比较本地与导入数据，识别冲突
- `resolveMarkConflicts()` / `resolveDiveConflicts()` - 解决冲突
- `addNewMarks()` / `addNewDives()` - 添加新数据
- `generateNewCode()` - 生成唯一编号

### ui.js - 界面渲染模块

负责所有界面元素的渲染和用户交互：
- `render()` - 渲染地图标记和标记列表
- `renderDives()` - 渲染潜次列表和统计摘要
- `showDiveDetail()` - 显示潜次详情面板
- `showImportPreview()` - 显示导入预览对话框
- `showToast()` - 显示提示消息
- `switchTab()` - 切换标签页

### app.js - 主应用逻辑

负责应用初始化和业务流程控制：
- `init()` - 应用初始化，加载数据，自动创建潜次档案
- `handleSaveMark()` / `handleDeleteMark()` - 标记的增删改
- `handleSaveDive()` / `handleDeleteDive()` - 潜次的增删改
- `handleExport()` / `handleImport()` - 数据的导入导出
- `autoCreateDivesFromMarks()` - 根据已有标记自动创建潜次档案
- `applyImport()` - 应用导入结果
