// 模拟照片和视频数据
export const mockMediaData = [
  {
    id: 1,
    type: 'photo',
    format: 'photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=family%20photo%20in%20park&image_size=square_hd',
    date: '2026-03-15',
    time: '10:30',
    location: '中央公园',
    people: ['张三', '李四', '王五'],
    personIds: [1, 2, 3],
    album: '相机胶卷',
    favorite: false,
    tags: ['家庭', '户外']
  },
  {
    id: 9,
    type: 'photo',
    format: 'photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=family%20photo%20similar%20in%20park&image_size=square_hd',
    date: '2026-03-15',
    time: '10:31',
    location: '中央公园',
    people: ['张三', '李四', '王五'],
    personIds: [1, 2, 3],
    album: '相机胶卷',
    favorite: false,
    tags: ['家庭', '户外']
  },
  {
    id: 2,
    type: 'photo',
    format: 'live_photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=couple%20photo%20on%20beach&image_size=square_hd',
    date: '2026-03-10',
    time: '16:45',
    location: '海滩',
    people: ['张三', '李四'],
    personIds: [1, 2],
    album: '精选',
    favorite: true,
    tags: ['情侣', '海滩']
  },
  {
    id: 3,
    type: 'video',
    format: 'video',
    url: 'https://example.com/video1.mp4',
    date: '2026-03-05',
    time: '14:20',
    location: '山顶',
    people: ['张三', '王五'],
    personIds: [1, 3],
    album: '旅行',
    favorite: false,
    tags: ['旅行', '户外'],
    duration: '00:45'
  },
  {
    id: 4,
    type: 'photo',
    format: 'photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=graduation%20photo%20ceremony&image_size=square_hd',
    date: '2026-02-28',
    time: '09:00',
    location: '大学',
    people: ['张三', '赵六'],
    personIds: [1, 4],
    album: '毕业',
    favorite: true,
    tags: ['毕业', '校园']
  },
  {
    id: 5,
    type: 'photo',
    format: 'screenshot',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=family%20dinner%20at%20home&image_size=square_hd',
    date: '2026-02-20',
    time: '18:30',
    location: '家中',
    people: ['张三', '李四', '王五'],
    personIds: [1, 2, 3],
    album: '相机胶卷',
    favorite: false,
    tags: ['家庭', '聚餐']
  },
  {
    id: 6,
    type: 'video',
    format: 'video',
    url: 'https://example.com/video2.mp4',
    date: '2026-02-15',
    time: '12:00',
    location: '餐厅',
    people: ['李四', '赵六'],
    personIds: [2, 4],
    album: '聚餐',
    favorite: false,
    tags: ['朋友', '聚餐'],
    duration: '01:20'
  },
  {
    id: 7,
    type: 'photo',
    format: 'photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=travel%20photo%20mountain&image_size=square_hd',
    date: '2026-02-10',
    time: '11:15',
    location: '黄山',
    people: ['张三', '王五'],
    personIds: [1, 3],
    album: '旅行',
    favorite: true,
    tags: ['旅行', '户外']
  },
  {
    id: 8,
    type: 'photo',
    format: 'photo',
    url: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=couple%20photo%20sunset&image_size=square_hd',
    date: '2026-01-30',
    time: '17:45',
    location: '湖边',
    people: ['张三', '李四'],
    personIds: [1, 2],
    album: '精选',
    favorite: true,
    tags: ['情侣', '日落']
  }
];

// 模拟人物数据
export const mockPeople = [
  { id: 1, name: '张三', avatar: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=person%20avatar%20male&image_size=square' },
  { id: 2, name: '李四', avatar: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=person%20avatar%20female&image_size=square' },
  { id: 3, name: '王五', avatar: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=person%20avatar%20male&image_size=square' },
  { id: 4, name: '赵六', avatar: 'https://copilot-cn.bytedance.net/api/ide/v1/text_to_image?prompt=person%20avatar%20female&image_size=square' }
];

// 模拟风格数据
export const mockStyles = [
  {
    id: 'parent-child',
    name: '亲子治愈风',
    description: '温馨、温暖的风格，适合家庭照片',
    icon: '👨‍👩‍👧‍👦',
    color: '#FF9E9E',
    music: '温馨家庭音乐',
    category: 'free'
  },
  {
    id: 'couple',
    name: '情侣甜蜜风',
    description: '浪漫、甜蜜的风格，适合情侣照片',
    icon: '💑',
    color: '#FFB6C1',
    music: '浪漫爱情音乐',
    category: 'free'
  },
  {
    id: 'travel',
    name: '旅行记录风',
    description: '自由、活力的风格，适合旅行照片',
    icon: '✈️',
    color: '#87CEEB',
    music: '冒险旅行音乐',
    category: 'free'
  },
  {
    id: 'vintage',
    name: '岁月经典风',
    description: '青春、回忆的风格，适合成长回顾',
    icon: '📷',
    color: '#D2B48C',
    music: '怀旧音乐',
    category: 'free'
  },
  {
    id: 'festival',
    name: '节日限定风',
    description: '节日氛围的风格，适合节日照片',
    icon: '🎉',
    color: '#FFD700',
    music: '节日音乐',
    category: 'paid'
  },
  {
    id: '3d',
    name: '高级动态风',
    description: '3D效果、粒子特效的高级风格',
    icon: '✨',
    color: '#9370DB',
    music: '动感音乐',
    category: 'paid'
  }
];

// 筛选函数
export const filterMedia = (data, filters) => {
  return data.filter(item => {
    // 时间筛选
    if (filters.timeRange) {
      const itemDate = new Date(item.date);
      const now = new Date();
      let startDate;
      let endDateLimit;
      
      switch (filters.timeRange) {
        case 'week':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'quarter':
          startDate = new Date(now);
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case 'year':
          startDate = new Date(now);
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        case 'custom':
          if (!filters.customDate?.start) {
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          }

          startDate = new Date(filters.customDate.start);
          if (Number.isNaN(startDate.getTime())) {
            startDate = new Date(now);
            startDate.setMonth(startDate.getMonth() - 1);
            break;
          }

          endDateLimit = filters.customDate.end ? new Date(filters.customDate.end) : now;
          if (Number.isNaN(endDateLimit.getTime())) {
            endDateLimit = now;
          }

          if (endDateLimit < startDate) {
            const tmp = startDate;
            startDate = endDateLimit;
            endDateLimit = tmp;
          }
          break;
        case 'special':
          break;
      }
      
      if (startDate && itemDate < startDate) {
        return false;
      }
      if (endDateLimit && itemDate > endDateLimit) {
        return false;
      }
    }
    
    // 人物筛选
    if (filters.people && filters.people.length > 0) {
      const hasSelectedPeople = filters.people.some(personId => {
        if (Array.isArray(item.personIds)) {
          return item.personIds.includes(personId);
        }
        const person = mockPeople.find(p => p.id === personId);
        return person && Array.isArray(item.people) && item.people.includes(person.name);
      });
      if (!hasSelectedPeople) {
        return false;
      }
    }
    
    // 格式筛选
    if (filters.enableFormat) {
      const opts = filters.formatOptions ?? {};
      const format = item.format ?? (item.type === 'video' ? 'video' : 'photo');

      if (format === 'photo' && !opts.includePhotos) return false;
      if (format === 'video' && !opts.includeVideos) return false;
      if (format === 'live_photo' && !opts.includeLivePhoto) return false;
      if ((format === 'screenshot' || format === 'screen_recording') && !opts.includeScreenshots) return false;

      const anyEnabled = !!(opts.includePhotos || opts.includeVideos || opts.includeLivePhoto || opts.includeScreenshots);
      if (!anyEnabled) return false;
    }
    
    return true;
  });
};
