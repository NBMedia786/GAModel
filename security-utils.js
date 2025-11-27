import path from 'path';

/**
 * Sanitize filename to prevent path traversal attacks
 * @param {string} filename - The filename to sanitize
 * @returns {string} - Sanitized filename
 */
export function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') {
        throw new Error('Invalid filename');
    }

    // Remove any path separators and parent directory references
    let sanitized = filename
        .replace(/\.\./g, '') // Remove ..
        .replace(/[/\\]/g, '') // Remove / and \
        .replace(/^\.+/, '') // Remove leading dots
        .trim();

    // Remove any null bytes
    sanitized = sanitized.replace(/\0/g, '');

    // Ensure filename is not empty after sanitization
    if (!sanitized || sanitized.length === 0) {
        throw new Error('Invalid filename after sanitization');
    }

    // Limit filename length
    if (sanitized.length > 255) {
        sanitized = sanitized.substring(0, 255);
    }

    return sanitized;
}

/**
 * Sanitize project name
 * @param {string} projectName - The project name to sanitize
 * @returns {string} - Sanitized project name
 */
export function sanitizeProjectName(projectName) {
    if (!projectName || typeof projectName !== 'string') {
        throw new Error('Invalid project name');
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    let sanitized = projectName
        .replace(/[^a-zA-Z0-9\s\-_]/g, '')
        .trim();

    if (!sanitized || sanitized.length === 0) {
        throw new Error('Project name must contain at least one valid character');
    }

    if (sanitized.length > 100) {
        sanitized = sanitized.substring(0, 100);
    }

    return sanitized;
}

/**
 * Validate that a path is within a base directory (prevent path traversal)
 * @param {string} basePath - The base directory path
 * @param {string} targetPath - The target path to validate
 * @returns {boolean} - True if path is safe
 */
export function isPathSafe(basePath, targetPath) {
    const resolvedBase = path.resolve(basePath);
    const resolvedTarget = path.resolve(targetPath);

    // Check if the resolved target path starts with the base path
    return resolvedTarget.startsWith(resolvedBase);
}

/**
 * Validate video file type
 * @param {string} mimetype - The MIME type to validate
 * @returns {boolean} - True if valid video type
 */
export function isValidVideoType(mimetype) {
    const validTypes = [
        'video/mp4',
        'video/mpeg',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-matroska',
        'video/webm'
    ];
    return validTypes.includes(mimetype);
}

/**
 * Validate file size
 * @param {number} size - File size in bytes
 * @param {number} maxSize - Maximum allowed size in bytes (default 2GB)
 * @returns {boolean} - True if size is valid
 */
export function isValidFileSize(size, maxSize = 2 * 1024 * 1024 * 1024) {
    return size > 0 && size <= maxSize;
}

/**
 * Safe JSON parse with error handling
 * @param {string} jsonString - JSON string to parse
 * @param {*} defaultValue - Default value if parsing fails
 * @returns {*} - Parsed object or default value
 */
export function safeJsonParse(jsonString, defaultValue = null) {
    try {
        return JSON.parse(jsonString);
    } catch (e) {
        return defaultValue;
    }
}
