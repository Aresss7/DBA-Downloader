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

  downloadVideo(url: string, options: {
    format?: string,
    quality?: string,
    audioOnly?: boolean,
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
      args.push('-x', '--audio-format', 'mp3');
    } else if (options.quality) {
      const q = options.quality.replace('p', '');
      // Use a more robust format selection that falls back to best if specific height fails
      args.push('-f', `bestvideo[height<=${q}]+bestaudio/best[height<=${q}] / best[height<=${q}] / best`);
      args.push('--merge-output-format', 'mp4');
    }

    if (options.start || options.end) {
      const start = options.start || '00:00:00';
      const downloaderArgs = `ffmpeg_i:-ss ${start}`;
      args.push('--downloader', 'ffmpeg');
      args.push('--downloader-args', downloaderArgs);
      if (options.end) {
        // This is tricky with yt-dlp direct, better use --download-sections
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
