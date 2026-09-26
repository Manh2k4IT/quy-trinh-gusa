const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sounds = [
  ['mobile/sounds/proposal_approved.wav', 'proposal_approved.wav'],
  ['mobile/sounds/proposal_rejected.wav', 'proposal_rejected.wav'],
];
const androidAppDirectory = path.join(root, 'android', 'app');
const iosAppDirectory = path.join(root, 'ios', 'App', 'App');
const targets = [];

if (fs.existsSync(androidAppDirectory)) targets.push(path.join(androidAppDirectory, 'src', 'main', 'res', 'raw'));
if (fs.existsSync(iosAppDirectory)) targets.push(iosAppDirectory);

for (const targetDirectory of targets) {
  fs.mkdirSync(targetDirectory, { recursive: true });
  for (const [sourceName, targetName] of sounds) {
    fs.copyFileSync(path.join(root, sourceName), path.join(targetDirectory, targetName));
  }
}