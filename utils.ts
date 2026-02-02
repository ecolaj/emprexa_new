
export const isImageDark = (imageSrc: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(false); return; }
        
        ctx.drawImage(img, 0, 0, 1, 1);
        
        const p = ctx.getImageData(0, 0, 1, 1).data;
        const brightness = Math.sqrt(
          0.299 * (p[0] * p[0]) +
          0.587 * (p[1] * p[1]) +
          0.114 * (p[2] * p[2])
        );
        
        resolve(brightness < 130);
      } catch (e) {
        resolve(false);
      }
    };
    
    img.onerror = () => resolve(false);
  });
};

// Database Date Formatter
export const timeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  // Check if valid date
  if (isNaN(date.getTime())) return dateString; // Return original if not a valid date (handles "2h ago" legacy mocks)

  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  let interval = seconds / 31536000;
  if (interval > 1) return Math.floor(interval) + " a";
  
  interval = seconds / 2592000;
  if (interval > 1) return Math.floor(interval) + " mes";
  
  interval = seconds / 86400;
  if (interval > 1) return Math.floor(interval) + " d";
  
  interval = seconds / 3600;
  if (interval > 1) return Math.floor(interval) + " h";
  
  interval = seconds / 60;
  if (interval > 1) return Math.floor(interval) + " min";
  
  return "Ahora";
};
