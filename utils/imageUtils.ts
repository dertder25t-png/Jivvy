/**
 * Image utility functions for client-side image processing
 */

/**
 * Resize an image if it exceeds the maximum size
 * @param file - The image file to resize
 * @param maxSize - Maximum width or height in pixels (default 2000)
 * @returns Promise<Blob> - The resized image as a blob
 */
export async function resizeImage(file: File, maxSize: number = 2000): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            const { width, height } = img;

            // If image is already small enough, return original
            if (width <= maxSize && height <= maxSize) {
                resolve(file);
                return;
            }

            // Calculate new dimensions
            let newWidth = width;
            let newHeight = height;

            if (width > height) {
                newWidth = maxSize;
                newHeight = (height / width) * maxSize;
            } else {
                newHeight = maxSize;
                newWidth = (width / height) * maxSize;
            }

            // Create canvas and resize
            const canvas = document.createElement('canvas');
            canvas.width = newWidth;
            canvas.height = newHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Use high quality image smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.drawImage(img, 0, 0, newWidth, newHeight);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to convert canvas to blob'));
                    }
                },
                file.type || 'image/jpeg',
                0.9 // Quality for JPEG
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}

/**
 * Convert a file to a data URL
 */
export function fileToDataUrl(file: File | Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
    });
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
}

/**
 * Get image dimensions from a file
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.width, height: img.height });
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
        };

        img.src = url;
    });
}
