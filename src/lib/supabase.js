import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const SUPABASE_BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || 'memoirs';
export const SUPABASE_TABLE = import.meta.env.VITE_SUPABASE_TABLE || 'memoir_projects';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabaseConfigMessage = isSupabaseConfigured
  ? ''
  : '请先在 .env.local 中配置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。';

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

const getPublicOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return import.meta.env.VITE_PUBLIC_APP_URL || '';
};

export const buildShareUrl = (shareId) => {
  const origin = getPublicOrigin();
  if (!origin || !shareId) return '';
  return `${origin}/share/${shareId}`;
};

export const createShareId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 16);
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
};

export const saveMemoirProject = async ({
  shareId,
  videoBlob,
  videoExt,
  metadata
}) => {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(supabaseConfigMessage);
  }

  if (!videoBlob) {
    throw new Error('缺少待上传的视频文件。');
  }

  const fileExt = videoExt || 'mp4';
  const filePath = `${shareId}/memoir.${fileExt}`;

  const uploadResult = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(filePath, videoBlob, {
      cacheControl: '3600',
      upsert: true,
      contentType: videoBlob.type || `video/${fileExt}`
    });

  if (uploadResult.error) {
    throw new Error(uploadResult.error.message || '上传视频到 Supabase Storage 失败。');
  }

  const publicUrlResult = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(filePath);

  const videoUrl = publicUrlResult.data?.publicUrl;
  if (!videoUrl) {
    throw new Error('未能生成公开视频地址，请确认存储桶已设为 public。');
  }

  const payload = {
    share_id: shareId,
    video_path: filePath,
    video_url: videoUrl,
    ...metadata
  };

  const insertResult = await supabase
    .from(SUPABASE_TABLE)
    .insert(payload)
    .select()
    .single();

  if (insertResult.error) {
    throw new Error(insertResult.error.message || '写入作品记录失败。');
  }

  return insertResult.data;
};

export const fetchMemoirProject = async (shareId) => {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(supabaseConfigMessage);
  }

  const result = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .eq('share_id', shareId)
    .single();

  if (result.error) {
    throw new Error(result.error.message || '加载分享作品失败。');
  }

  return result.data;
};

export const fetchMemoirProjects = async ({ limit = 6 } = {}) => {
  if (!supabase || !isSupabaseConfigured) {
    throw new Error(supabaseConfigMessage);
  }

  const result = await supabase
    .from(SUPABASE_TABLE)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (result.error) {
    throw new Error(result.error.message || '加载作品列表失败。');
  }

  return result.data ?? [];
};
