import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import axios from 'axios';
import AdmZip from 'adm-zip';

const YT_DLP_URL = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const FFMPEG_URL = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip';
const DENO_URL = 'https://github.com/denoland/deno/releases/latest/download/deno-x86_64-pc-windows-msvc.zip';

export class YtDlpManager {
  private binPath: string;
  private ytDlpPath: string;
  private ffmpegPath: string;
  private denoPath: string;
  private logPath: string;

  constructor() {
    // app.setName is called in main.ts before this constructor
    const userData = app.getPath('userData');
    this.binPath = path.join(userData, 'bin');
    this.ytDlpPath = path.join(this.binPath, 'yt-dlp.exe');
    this.ffmpegPath = path.join(this.binPath, 'ffmpeg.exe');
    this.denoPath = path.join(this.binPath, 'deno.exe');
    this.logPath = path.join(this.binPath, 'debug.log');

    if (!fs.existsSync(this.binPath)) {
      fs.mkdirSync(this.binPath, { recursive: true });
    }
  }

  private log(msg: string) {
    const time = new Date().toISOString();
    const entry = `[${time}] ${msg}\n`;
    console.log(entry.trim());
    try {
      fs.appendFileSync(this.logPath, entry);
    } catch (e) {
      // ignore
    }
  }

  async checkAndDownloadBinaries(onStatus?: (data: { step: number; totalSteps: number; label: string; percent: number }) => void) {
    this.log(`Checking binaries in: ${this.binPath}`);
    this.log(`UserData path: ${app.getPath('userData')}`);

    const send = (step: number, label: string, percent: number) => {
      onStatus?.({ step, totalSteps: 3, label, percent });
    };

    if (!fs.existsSync(this.ytDlpPath)) {
      this.log('yt-dlp.exe missing, starting download...');
      try {
        await this.downloadFile(YT_DLP_URL, this.ytDlpPath, (p) => send(1, 'Downloading yt-dlp...', p));
        this.log('yt-dlp.exe downloaded successfully');
      } catch (e: any) {
        this.log(`FAILED to download yt-dlp: ${e.message}`);
        throw e;
      }
    } else {
      this.log('yt-dlp.exe exists');
    }

    if (!fs.existsSync(this.ffmpegPath)) {
      this.log('ffmpeg.exe missing, starting download...');
      try {
        send(2, 'Downloading ffmpeg...', 0);
        await this.downloadFile(FFMPEG_URL, path.join(this.binPath, 'ffmpeg-tmp.zip'), (p) => send(2, 'Downloading ffmpeg...', p));
        send(2, 'Extracting ffmpeg...', -1);
        await this.extractFfmpeg();
        this.log('ffmpeg.exe extracted successfully');
      } catch (e: any) {
        this.log(`FAILED to download/extract ffmpeg: ${e.message}`);
        throw e;
      }
    } else {
      this.log('ffmpeg.exe exists');
    }

    if (!fs.existsSync(this.denoPath)) {
      this.log('deno.exe missing, starting download...');
      try {
        send(3, 'Downloading JS runtime...', 0);
        await this.downloadFile(DENO_URL, path.join(this.binPath, 'deno-tmp.zip'), (p) => send(3, 'Downloading JS runtime...', p));
        send(3, 'Extracting JS runtime...', -1);
        await this.extractDeno();
        this.log('deno.exe extracted successfully');
      } catch (e: any) {
        this.log(`FAILED to download/extract deno: ${e.message}`);
      }
    } else {
      this.log('deno.exe exists');
    }
    send(3, 'Ready', 100);
  }

  private async downloadFile(url: string, dest: string, onProgress?: (percent: number) => void) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'stream',
      timeout: 300000,
    });

    const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedBytes = 0;

    const writer = fs.createWriteStream(dest);

    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      if (totalBytes > 0) {
        const percent = Math.round((downloadedBytes / totalBytes) * 100);
        onProgress?.(percent);
      }
    });

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });
  }

  private async extractFfmpeg() {
    const tmpZip = path.join(this.binPath, 'ffmpeg-tmp.zip');
    this.log(`Extracting ffmpeg from ${tmpZip}...`);

    try {
      const zip = new AdmZip(tmpZip);
      const entries = zip.getEntries();
      let extracted = false;

      for (const entry of entries) {
        const name = entry.entryName.toLowerCase();
        if (!entry.isDirectory && name.endsWith('ffmpeg.exe')) {
          this.log(`Found ffmpeg entry: ${entry.entryName}`);
          fs.writeFileSync(this.ffmpegPath, entry.getData());
          extracted = true;
          break;
        }
      }

      if (!extracted) {
        throw new Error('ffmpeg.exe not found in the downloaded archive');
      }
    } finally {
      if (fs.existsSync(tmpZip)) {
        try {
          fs.unlinkSync(tmpZip);
          this.log('Temporary ffmpeg zip deleted');
        } catch (e) {
          this.log('Failed to delete temporary ffmpeg zip');
        }
      }
    }
  }

  private async extractDeno() {
    const tmpZip = path.join(this.binPath, 'deno-tmp.zip');
    this.log(`Extracting deno from ${tmpZip}...`);

    try {
      const zip = new AdmZip(tmpZip);
      const entries = zip.getEntries();
      let extracted = false;

      for (const entry of entries) {
        const name = entry.entryName.toLowerCase();
        if (!entry.isDirectory && name.endsWith('deno.exe')) {
          this.log(`Found deno entry: ${entry.entryName}`);
          fs.writeFileSync(this.denoPath, entry.getData());
          extracted = true;
          break;
        }
      }

      if (!extracted) {
        throw new Error('deno.exe not found in the downloaded archive');
      }
    } finally {
      if (fs.existsSync(tmpZip)) {
        try {
          fs.unlinkSync(tmpZip);
          this.log('Temporary deno zip deleted');
        } catch (e) {
          this.log('Failed to delete temporary deno zip');
        }
      }
    }
  }

  private getBaseArgs(): string[] {
    const args = ['--ffmpeg-location', this.binPath];
    if (fs.existsSync(this.denoPath)) {
      args.push('--js-runtimes', `deno:${this.denoPath}`);
    }
    return args;
  }

  async updateYtDlp() {
    this.log('Updating yt-dlp...');
    return new Promise((resolve, reject) => {
      const process = spawn(this.ytDlpPath, ['-U']);
      process.on('error', (err) => {
        this.log(`Update spawn error: ${err.message}`);
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });
      process.on('close', (code) => {
        this.log(`Update process closed with code ${code}`);
        if (code === 0) resolve(true);
        else reject(new Error(`Exit code ${code}`));
      });
    });
  }

  async fetchInfo(url: string): Promise<{
    audioLangs: { code: string; name: string; formatId: string; isAudioOnly: boolean }[];
    debug: string;
  }> {
    this.log(`Fetching info for: ${url}`);
    return new Promise((resolve, reject) => {
      const args = [...this.getBaseArgs(), '--dump-json', '--no-download', '--no-playlist', url];
      this.log(`Running: ${this.ytDlpPath} ${args.join(' ')}`);

      const proc = spawn(this.ytDlpPath, args);
      let stdout = '';
      let stderr = '';

      proc.on('error', (err) => {
        this.log(`FetchInfo spawn error: ${err.message}`);
        reject(new Error(`Failed to start yt-dlp: ${err.message}`));
      });

      proc.stdout.on('data', (data) => { stdout += data.toString(); });
      proc.stderr.on('data', (data) => { stderr += data.toString(); });

      proc.on('close', (code) => {
        this.log(`FetchInfo closed with code ${code}. Stdout length: ${stdout.length}`);
        if (stderr) this.log(`FetchInfo stderr: ${stderr.substring(0, 500)}`);

        if (code !== 0) {
          reject(new Error(stderr || `Exit code ${code}`));
          return;
        }
        try {
          const info = JSON.parse(stdout);
          const formats = info.formats || [];
          this.log(`Parsed ${formats.length} formats`);

          const bestPerLang = new Map<string, {
            code: string; name: string; formatId: string;
            tbr: number; isAudioOnly: boolean;
          }>();

          let withLang = 0;
          let withAudio = 0;
          for (const fmt of formats) {
            if (fmt.acodec && fmt.acodec !== 'none') withAudio++;
            const lang = fmt.language;
            if (!lang) continue;
            if (!fmt.acodec || fmt.acodec === 'none') continue;
            withLang++;

            const isAudioOnly = !fmt.vcodec || fmt.vcodec === 'none';
            const tbr = fmt.tbr || fmt.abr || 0;
            const existing = bestPerLang.get(lang);

            // Prefer audio-only over combined; among same type prefer higher bitrate
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

          for (const al of audioLangs) {
            this.log(`  Lang: ${al.code} name=${al.name} formatId=${al.formatId} isAudioOnly=${al.isAudioOnly}`);
          }
          const debugMsg = `Formats:${formats.length} Audio:${withAudio} WithLang:${withLang} Detected:${audioLangs.length}`;
          this.log(debugMsg);

          resolve({ audioLangs, debug: debugMsg });
        } catch (e: any) {
          this.log(`Parse JSON error: ${e.message}`);
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
    this.log(`Starting download for: ${url}`);
    this.log(`Options: audioFormatId=${options.audioFormatId} audioFormatIsAudioOnly=${options.audioFormatIsAudioOnly} audioLang=${options.audioLang} quality=${options.quality} audioOnly=${options.audioOnly}`);
    const args = [
      ...this.getBaseArgs(),
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
      const fmtId = options.audioFormatId;
      const lang = options.audioLang;

      if (fmtId && options.audioFormatIsAudioOnly) {
        // Audio-only format (e.g. English original): merge with quality-constrained video
        args.push('-f', `bestvideo[height<=${q}]+${fmtId}/best[height<=${q}]/best`);
        args.push('--merge-output-format', 'mp4');
        args.push('--ppa', 'Merger+ffmpeg:-c:a aac -b:a 192k');
      } else if (lang) {
        // Combined HLS format (e.g. dubbed audio): download single format with quality+language
        // YouTube provides dubbed audio only as combined HLS (91-96 = 144p-1080p)
        // Can't merge HLS with bestvideo, so download the combined format directly
        args.push('-f', `best[height<=${q}][language*=${lang}]/best[height<=${q}]/best`);
        args.push('--remux-video', 'mp4');
      } else {
        args.push('-f', `bestvideo[height<=${q}]+bestaudio[ext=m4a]/bestvideo[height<=${q}]+bestaudio/best[height<=${q}]/best`);
        args.push('--merge-output-format', 'mp4');
        args.push('--ppa', 'Merger+ffmpeg:-c:a aac -b:a 192k');
      }
    }

    this.log(`Download args: ${args.join(' ')}`);

    if (options.start || options.end) {
      const start = options.start || '00:00:00';
      args.push('--downloader', 'ffmpeg');
      args.push('--downloader-args', `ffmpeg_i:-ss ${start}`);
      if (options.end) {
        args.push('--download-sections', `*${start}-${options.end}`);
      }
    }

    args.push('-o', path.join(options.outDir, '%(title)s.%(ext)s'));

    const process = spawn(this.ytDlpPath, args);

    process.on('error', (err) => {
      this.log(`Download spawn error: ${err.message}`);
    });

    process.stdout.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          onProgress(line.trim());
        }
      }
    });

    process.stderr.on('data', (data) => {
      const msg = data.toString();
      if (msg.trim()) this.log(`yt-dlp stderr: ${msg.trim()}`);
    });

    return process;
  }
}
