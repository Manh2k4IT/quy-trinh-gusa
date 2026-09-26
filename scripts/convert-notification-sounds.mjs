import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPEGDecoder } from 'mpg123-decoder';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sounds = [
  ['de_xuat_cua_ban_da_duoc_duyet_0f638daa-fee3-4942-adb5-f8242adc7a72 (1).mp3', 'proposal_approved.wav'],
  ['de_xuat_cua_ban_da_bi_tu_choi_2a0d6172-489b-4f49-aac2-54f0f765504b.mp3', 'proposal_rejected.wav'],
];

function encodePcmWav(channelData, sampleRate) {
  const channelCount = channelData.length;
  const sampleCount = channelData[0].length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = sampleCount * blockAlign;
  const wav = Buffer.alloc(44 + dataSize);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channelCount, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(bytesPerSample * 8, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataSize, 40);

  let offset = 44;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channelIndex][sampleIndex]));
      wav.writeInt16LE(Math.round(sample < 0 ? sample * 0x8000 : sample * 0x7fff), offset);
      offset += bytesPerSample;
    }
  }

  return wav;
}

const decoder = new MPEGDecoder();
await decoder.ready;

try {
  const outputDirectory = path.join(root, 'mobile', 'sounds');
  fs.mkdirSync(outputDirectory, { recursive: true });

  for (const [sourceName, outputName] of sounds) {
    const mp3Data = new Uint8Array(fs.readFileSync(path.join(root, sourceName)));
    const decoded = decoder.decode(mp3Data);
    if (decoded.errors?.length || !decoded.channelData?.length) throw new Error(`Could not decode ${sourceName}`);
    const wavData = encodePcmWav(decoded.channelData, decoded.sampleRate);
    fs.writeFileSync(path.join(outputDirectory, outputName), wavData);
    await decoder.reset();
  }
} finally {
  decoder.free();
}