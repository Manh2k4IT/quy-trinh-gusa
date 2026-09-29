import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MPEGDecoder } from 'mpg123-decoder';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sounds = [
  ['ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_1e969bce-ab7b-4812-a7cd-a61a981e15cd.mp3', 'proposal_new_general.wav'],
  ['ban_co_de_xuat_di_tre_tu_nhan_su_8a90c570-7e7e-4958-831a-2f1d2b366c80.mp3', 'proposal_late_submitted.wav'],
  ['ban_co_de_xuat_ve_som_tu_nhan_su_6a1da0c4-340f-44d5-8fcb-55921a3179c2.mp3', 'proposal_early_leave_submitted.wav'],
  ['ban_co_de_xuat_lam_mot_phan_hai_ngay_tu_nhan_su_fd35d92f-5a9f-437e-a0f0-4df68e3fbd14.mp3', 'proposal_half_day_submitted.wav'],
  ['ban_co_de_xuat_nghi_co_phep_tu_nhan_su_83c37535-136e-4f99-8602-573ecd286adb.mp3', 'proposal_leave_submitted.wav'],
  ['ban_co_de_xuat_nghi_khong_phep_tu_nhan_su_c3d170f6-08a2-470e-9fd4-44fa8e15a6d5.mp3', 'proposal_unauthorized_leave_submitted.wav'],
  ['ban_co_de_xuat_moi_tu_nhan_su_trong_danh_muc_de_b5e06310-5fad-4e0d-a280-47d4bca56183.mp3', 'proposal_new_payment.wav'],
  ['ban_co_de_xuat_thanh_toan_truc_tiep_tu_nhan_su_59b1405d-69b2-4eb7-aa6e-81bd7f8c45c3.mp3', 'proposal_payment_direct_accountant.wav'],
  ['ban_co_de_xuat_thanh_toan_da_duoc_duyet_tu_ceo_c69e7e0e-7155-40ae-8f27-cd3b676a2493.mp3', 'proposal_payment_ceo_approved.wav'],
  ['ke_toan_da_xac_nhan_don_duyet_cua_ban_8e3f1f90-f4ef-49c8-b578-cb2a2b1e3806.mp3', 'proposal_payment_accounting_confirmed.wav'],
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