const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'avi', 'mkv', 'webm']);

export function isVideoPath(path: string): boolean {
  const extension = path
    .split(/[\\/.]/)
    .pop()
    ?.toLowerCase();
  return extension !== undefined && VIDEO_EXTENSIONS.has(extension);
}
