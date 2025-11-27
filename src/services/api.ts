/**
 * API Service for Video Analysis
 * Handles streaming analysis of video files
 */

interface StreamAnalysisOptions {
  onProgress?: (data: { pct: number; label: string; phase?: string }) => void;
  onTextChunk?: (text: string) => void;
  onComplete?: () => void;
  onError?: (error: string) => void;
}

/**
 * Stream analysis of a video file
 * Supports both local file upload and existing project video analysis
 */
export const streamAnalysis = (
  file: File | null,
  prompt: string,
  options: StreamAnalysisOptions & { projectId?: string; fileName?: string } = {}
): void => {
  const { onProgress, onTextChunk, onComplete, onError, projectId, fileName } = options;

  // If we have projectId and fileName, analyze existing video
  if (projectId && fileName) {
    analyzeExistingVideo(projectId, fileName, prompt, { onProgress, onTextChunk, onComplete, onError });
    return;
  }

  // Otherwise, upload and analyze new file
  if (!file) {
    onError?.('No video file provided');
    return;
  }

  const formData = new FormData();
  formData.append('video', file);
  formData.append('prompt', prompt);

  // Upload progress
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100);
      onProgress?.({ pct, label: `Uploading... ${pct}%`, phase: 'upload' });
    }
  });

  xhr.addEventListener('load', () => {
    if (xhr.status === 200) {
      // Parse streaming response
      parseStreamingResponse(xhr.responseText, { onProgress, onTextChunk, onComplete, onError });
    } else {
      onError?.(`Upload failed: ${xhr.statusText}`);
    }
  });

  xhr.addEventListener('progress', (e) => {
    if (e.lengthComputable && e.target) {
      const xhrTarget = e.target as XMLHttpRequest;
      if (xhrTarget.readyState === XMLHttpRequest.LOADING) {
        // Parse partial response for streaming
        const partialText = xhrTarget.responseText;
        parseStreamingResponsePartial(partialText, { onProgress, onTextChunk });
      }
    }
  });

  xhr.addEventListener('error', () => {
    onError?.('Upload failed');
  });

  xhr.open('POST', '/api/upload');
  xhr.send(formData);
};

/**
 * Analyze an existing video in a project
 */
function analyzeExistingVideo(
  projectId: string,
  fileName: string,
  prompt: string,
  options: StreamAnalysisOptions
): void {
  const { onProgress, onTextChunk, onComplete, onError } = options;

  const encodedFileName = encodeURIComponent(fileName);

  // Use fetch with streaming
  fetch(`/api/project/${projectId}/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt, fileName }),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          // Check for progress updates: [PROGRESS:{"pct":X,"label":"...","phase":"..."}]
          const progressMatch = line.match(/\[PROGRESS:(.+?)\]/);
          if (progressMatch) {
            try {
              const progressData = JSON.parse(progressMatch[1]);
              onProgress?.(progressData);

              if (progressData.phase === 'complete' || progressData.pct === 100) {
                onComplete?.();
                return;
              }
            } catch (e) {
              console.error('Error parsing progress:', e);
            }
            continue;
          }

          // Check for errors
          if (line.startsWith('[Error]')) {
            const errorMsg = line.replace('[Error]', '').trim();
            onError?.(errorMsg);
            return;
          }

          // Check for notices (skip but don't error)
          if (line.startsWith('[Notice]')) {
            continue;
          }

          // Regular text chunks (analysis results)
          // Only skip if it's EXACTLY a progress marker line, not just any line with brackets
          if (line.trim() && !line.match(/^\[PROGRESS:/)) {
            onTextChunk?.(line + '\n');
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim() && !buffer.match(/^\[PROGRESS:/)) {
        onTextChunk?.(buffer);
      }

      onComplete?.();
    })
    .catch((error) => {
      onError?.(error.message || 'Analysis request failed');
    });
}

let lastProcessedIndex = 0;

/**
 * Parse streaming response from server (partial for XHR progress)
 */
function parseStreamingResponsePartial(
  responseText: string,
  options: Pick<StreamAnalysisOptions, 'onProgress' | 'onTextChunk'>
): void {
  const { onProgress, onTextChunk } = options;

  // Only process new content
  const newContent = responseText.slice(lastProcessedIndex);
  lastProcessedIndex = responseText.length;

  const lines = newContent.split('\n');

  for (const line of lines) {
    // Check for progress updates: [PROGRESS:{"pct":X,"label":"...","phase":"..."}]
    const progressMatch = line.match(/\[PROGRESS:(.+?)\]/);
    if (progressMatch) {
      try {
        const progressData = JSON.parse(progressMatch[1]);
        onProgress?.(progressData);
      } catch (e) {
        console.error('Error parsing progress:', e);
      }
      continue;
    }

    // Check for notices (skip but don't error)
    if (line.startsWith('[Notice]')) {
      continue;
    }

    // Regular text chunks (analysis results)
    if (line.trim() && !line.match(/^\[PROGRESS:/)) {
      onTextChunk?.(line + '\n');
    }
  }
}

/**
 * Parse streaming response from server (complete)
 */
function parseStreamingResponse(
  responseText: string,
  options: StreamAnalysisOptions
): void {
  const { onProgress, onTextChunk, onComplete, onError } = options;

  const lines = responseText.split('\n');
  let currentText = '';
  let hasSeenComplete = false;

  for (const line of lines) {
    // Check for progress updates: [PROGRESS:{"pct":X,"label":"...","phase":"..."}]
    const progressMatch = line.match(/\[PROGRESS:(.+?)\]/);
    if (progressMatch) {
      try {
        const progressData = JSON.parse(progressMatch[1]);
        onProgress?.(progressData);

        // Check if this is completion
        if (progressData.phase === 'complete' || progressData.pct === 100) {
          hasSeenComplete = true;
        }
      } catch (e) {
        console.error('Error parsing progress:', e);
      }
      continue;
    }

    // Check for errors
    if (line.startsWith('[Error]')) {
      const errorMsg = line.replace('[Error]', '').trim();
      onError?.(errorMsg);
      return;
    }

    // Check for notices (skip but don't error)
    if (line.startsWith('[Notice]')) {
      continue;
    }

    // Regular text chunks (analysis results) - skip empty lines and progress markers
    if (line.trim() && !line.match(/^\[PROGRESS:/)) {
      currentText += line + '\n';
      onTextChunk?.(line + '\n');
    }
  }

  // Complete if we saw completion or have text
  if (hasSeenComplete || currentText.trim()) {
    onComplete?.();
  }

  // Reset for next analysis
  lastProcessedIndex = 0;
}

