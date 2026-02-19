import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import axios from 'axios';

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';

export class YtDlpManager {
  private binPath: string;
  private ytDlpPath: string;

  constructor() {
    this.binPath = path.join(app.getPath('userData'), 'bin');
    this.ytDlpPath = path.join(this.binPath, 'yt-dlp.exe');
    if (!fs.existsSync(this.binPath)) {
      fs.mkdirSync(this.binPath, { recursive: true });
    }
  }

  async checkAndDownloadBinaries() {
    if (!fs.existsSync(this.ytDlpPath)) {
      await this.downloadYtDlp();
    }
    // Note: FFMPEG is complex to download and unzip in one go without 'unzipper' or similar.
    // For now, we will verify if yt-dlp is working. 
    // If we had more libs, we'd unzip the FFMPEG_URL here.
  }

  async downloadYtDlp() {
    const response = await axios({
      method: 'GET',
      url: YT_DLP_URL,
      responseType: 'arraybuffer',
    });
    fs.writeFileSync(this.ytDlpPath, Buffer.from(response.data));
  }

  async updateYtDlp() {
    return new Promise((resolve, reject) => {
      const process = spawn(this.ytDlpPath, ['-U']);
      process.on('close', (code) => {
        if (code === 0) resolve(true);
        else reject(new Error(`Exit code ${code}`));
      });
    });
  }

  async fetchInfo(url: string): Promise<{
    audioLangs: { code: string; name: string; formatId: string; isAudioOnly: boolean }[];
    debug: string;
  }> {
    return new Promise((resolve, reject) => {
      const args = ['--dump-json', '--no-download', '--no-playlist', url];
      const proc = spawn(this.ytDlpPath, args);
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Exit code ${code}`));
          return;
        }
        try {
          const info = JSON.parse(stdout);
          const formats = info.formats || [];

          // Scan ALL formats that have audio + language
          const bestPerLang = new Map<string, {
            code: string; name: string; formatId: string;
            tbr: number; isAudioOnly: boolean;
          }>();

          for (const fmt of formats) {
            const lang = fmt.language;
            if (!lang) continue;
            if (!fmt.acodec || fmt.acodec === 'none') continue;

            const isAudioOnly = !fmt.vcodec || fmt.vcodec === 'none';
            const tbr = fmt.tbr || fmt.abr || 0;
            const existing = bestPerLang.get(lang);

            // Prefer audio-only over combined (cleaner merge);
            // within same type, prefer higher bitrate
            if (!existing ||
              (isAudioOnly && !existing.isAudioOnly) ||
              (isAudioOnly === existing.isAudioOnly && tbr > existing.tbr)) {
              bestPerLang.set(lang, {
                code: lang,
                name: fmt.format_note || lang,
                formatId: fmt.format_id,
                tbr,
                isAudioOnly
              });
            }
          }

          const audioLangs = Array.from(bestPerLang.values())
            .map(({ code, name, formatId, isAudioOnly }) => ({ code, name, formatId, isAudioOnly }));
          const debug = `Detected:${audioLangs.length} [${audioLangs.map(l => `${l.code}:${l.formatId}:${l.isAudioOnly ? 'audio' : 'combined'}`).join(', ')}]`;

          console.log('[fetchInfo]', debug);
          resolve({ audioLangs, debug });
        } catch (e) {
          console.error('[fetchInfo] Parse error:', e);
          resolve({ audioLangs: [], debug: `ParseError: ${e}` });
        }
      });
    });
  }

  downloadVideo(url: string, options: {
    format?: string,
    quality?: string,
    audioOnly?: boolean,
    audioFormatId?: string,
    audioFormatIsAudioOnly?: boolean,
    audioLang?: string,
    start?: string,
    end?: string,
    outDir: string
  }, onProgress: (progress: string) => void) {
    const args = [
      '--newline',
      '--progress',
      '--progress-template', '%(progress._percent_str)s',
      url
    ];

    if (options.audioOnly) {
      if (options.audioFormatId) {
        args.push('-f', options.audioFormatId);
      }
      args.push('-x', '--audio-format', 'mp3');
    } else if (options.quality) {
      const q = options.quality.replace('p', '');
      if (options.audioFormatId && options.audioFormatIsAudioOnly) {
        // Audio-only format: merge with best video — quality controlled
        args.push('-f', `bestvideo[height<=${q}]+${options.audioFormatId}/bestvideo[height<=${q}]+bestaudio/best[height<=${q}]/best`);
      } else if (options.audioLang) {
        // Combined format: use language filter with height constraint
        args.push('-f', `best[height<=${q}][language*=${options.audioLang}]/best[language*=${options.audioLang}]/bestvideo[height<=${q}]+bestaudio/best[height<=${q}]/best`);
      } else {
        args.push('-f', `bestvideo[height<=${q}]+bestaudio/best[height<=${q}] / best[height<=${q}] / best`);
      }
      args.push('--merge-output-format', 'mp4');
    }

    console.log('[yt-dlp] Command args:', args.join(' '));

    if (options.start || options.end) {
      const start = options.start || '00:00:00';
      const downloaderArgs = `ffmpeg_i:-ss ${start}`;
      args.push('--downloader', 'ffmpeg');
      args.push('--downloader-args', downloaderArgs);
      if (options.end) {
        args.push('--download-sections', `*${start}-${options.end}`);
      }
    }

    args.push('-o', path.join(options.outDir, '%(title)s.%(ext)s'));

    const process = spawn(this.ytDlpPath, args);

    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          onProgress(line.trim());
        }
      }
    });

    process.stderr.on('data', (data) => {
      console.error(`yt-dlp error: ${data}`);
    });

    return process;
  }
}
