/**
 * Dada Dashboard — 项目配置
 *
 * 新增 / 修改项目只需要编辑本文件：
 *
 * group:
 *   id      唯一标识
 *   title   分组标题
 *   items   项目列表
 *
 * item:
 *   id           唯一标识
 *   name         项目名称
 *   description  一句话描述
 *   icon         Lucide 图标名（任意 Lucide 图标，如 "Send" / "Database"，
 *                未匹配时显示通用图标；全部图标见 https://lucide.dev/icons）
 *   logo         可选。真实网站 logo（像 BLNF 那样的贴图）：
 *                  - 图片 URL 或本地路径，如 "https://cdn.simpleicons.org/github"
 *                    或 "/logos/github.svg"（图片放 public/logos/ 下）
 *                  - "auto"：按 url 的域名自动抓取 favicon（用下面的 FAVICON_API）
 *                  - 不填：显示 icon 字段的 Lucide 图标
 *                logo 加载失败会自动回退到 icon 图标
 *   accent       图标底色：blue | purple | cyan | teal | green | orange | pink | indigo | slate
 *   tags         标签数组（搜索与分组内 Tag 筛选都基于它）
 *   url          默认地址
 *   internalUrl  内网地址（内网模式优先使用）
 *   externalUrl  外网地址（外网模式优先使用）
 *   status       online | development | experimental | offline
 *   enabled      设为 false 可临时隐藏该项目
 */

/** logo: "auto" 时的 favicon 图源，{domain} 会被替换成项目 url 的域名。
 *  国内网络可换成：https://api.iowen.cn/favicon/{domain}.png */
export const FAVICON_API = 'https://favicon.im/{domain}?larger=true'

export const groups = [
  {
    id: 'tools',
    title: '常用工具',
    items: [
      {
        id: 'file-transfer',
        name: '文件传输',
        description: '跨设备快速发送文件',
        icon: 'Send',
        accent: 'blue',
        tags: ['文件', '传输'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'timer',
        name: '计时器',
        description: '番茄钟与工作计时',
        icon: 'Timer',
        accent: 'orange',
        tags: ['效率', '工具'],
        url: '/timer',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'attendance',
        name: '上下班打卡',
        description: '考勤记录与管理',
        icon: 'CalendarCheck',
        accent: 'green',
        tags: ['工作', '考勤'],
        url: '/checkin',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'video-downloader',
        name: '视频下载',
        description: '解析并下载在线视频',
        icon: 'Download',
        accent: 'purple',
        tags: ['工具', '媒体'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'development',
        enabled: true,
      },
    ],
  },
  {
    id: 'webapps',
    title: 'Web Apps',
    items: [
      {
        id: 'erp',
        name: '进销存',
        description: '小型业务的进销存管理',
        icon: 'Boxes',
        accent: 'indigo',
        tags: ['业务', 'Vue'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'development',
        enabled: true,
      },
      {
        id: 'github-drive',
        name: 'GitHub Drive',
        description: '基于仓库的文件存储',
        icon: 'FolderGit2',
        logo: 'https://cdn.simpleicons.org/github',
        accent: 'slate',
        tags: ['开发', 'GitHub'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'file-center',
        name: '文件中心',
        description: '个人文件的统一管理',
        icon: 'FolderOpen',
        accent: 'cyan',
        tags: ['文件', '存储'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
    ],
  },
  {
    id: 'ai',
    title: 'AI / 实验',
    items: [
      {
        id: 'ai-pet',
        name: 'AI Pet',
        description: '会成长的桌面 AI 宠物',
        icon: 'Cat',
        accent: 'pink',
        tags: ['AI', '实验'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'experimental',
        enabled: true,
      },
      {
        id: 'fly-brain',
        name: 'Fly Brain',
        description: '果蝇神经连接组可视化',
        icon: 'Brain',
        accent: 'purple',
        tags: ['AI', '实验'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'experimental',
        enabled: true,
      },
      {
        id: 'adas',
        name: 'ADAS',
        description: '辅助驾驶感知实验',
        icon: 'Car',
        accent: 'orange',
        tags: ['AI', '硬件'],
        url: '#',
        internalUrl: '',
        externalUrl: '',
        status: 'experimental',
        enabled: true,
      },
    ],
  },
  {
    id: 'dev',
    title: '开发',
    items: [
      {
        id: 'servicenow-lab',
        name: 'ServiceNow Lab',
        description: 'ServiceNow 二次开发实验',
        icon: 'CloudCog',
        logo: 'https://favicon.im/servicenow.com?larger=true',
        accent: 'teal',
        tags: ['ServiceNow', 'Cloudflare'],
        url: 'https://developer.servicenow.com/',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'aws-serverless',
        name: 'AWS Serverless',
        description: 'Lambda 与无服务架构练习',
        icon: 'Server',
        logo: 'https://favicon.im/aws.amazon.com?larger=true',
        accent: 'orange',
        tags: ['AWS', '开发'],
        url: 'https://console.aws.amazon.com/lambda/home',
        internalUrl: '',
        externalUrl: '',
        status: 'online',
        enabled: true,
      },
      {
        id: 'supabase-lab',
        name: 'Supabase Lab',
        description: 'Supabase 数据库与认证实验',
        icon: 'Database',
        logo: 'https://cdn.simpleicons.org/supabase',
        accent: 'green',
        tags: ['Supabase', '开发'],
        url: 'https://supabase.com/dashboard/project/btlewthrlimzeylxaqim',
        internalUrl: '',
        externalUrl: '',
        status: 'development',
        enabled: true,
      },
    ],
  },
]
