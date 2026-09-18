const fs = require('fs');
const path = require('path');

function generateWav() {
  const sampleRate = 22050;
  const totalDuration = 9.2; // 9.2 seconds duration (meets "at least 8s")
  const totalSamples = Math.floor(sampleRate * totalDuration);
  const buffer = Buffer.alloc(44 + totalSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + totalSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // AudioFormat (1 for PCM)
  buffer.writeUInt16LE(1, 22);  // NumChannels (1 = Mono)
  buffer.writeUInt32LE(sampleRate, 24); // SampleRate
  buffer.writeUInt32LE(sampleRate * 2, 28); // ByteRate
  buffer.writeUInt16LE(2, 32);  // BlockAlign
  buffer.writeUInt16LE(16, 34); // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(totalSamples * 2, 40);

  // PCM Float Array
  const samples = new Float32Array(totalSamples);

  // 5 Waves of chimes: at 0.0s, 1.8s, 3.6s, 5.4s, 7.2s -> rings till ~9.2s
  const bursts = [0.0, 1.8, 3.6, 5.4, 7.2];

  bursts.forEach((burstTime) => {
    // Note 1: 880Hz (A5)
    addTone(samples, sampleRate, burstTime + 0.00, 880, 0.45, 0.28);
    // Note 2: 1174Hz (D6)
    addTone(samples, sampleRate, burstTime + 0.18, 1174, 0.55, 0.32);
    // Note 3: 1760Hz (A6)
    addTone(samples, sampleRate, burstTime + 0.40, 1760, 1.10, 0.38);
  });

  // Write samples to buffer
  for (let i = 0; i < totalSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    const intSample = s < 0 ? s * 0x8000 : s * 0x7FFF;
    buffer.writeInt16LE(Math.floor(intSample), 44 + i * 2);
  }

  const outDir = path.join(process.cwd(), 'public', 'sounds');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPathWav = path.join(outDir, 'new-order.wav');
  fs.writeFileSync(outPathWav, buffer);
  console.log('Successfully written', outPathWav, buffer.length, 'bytes');

  const outPathMp3 = path.join(outDir, 'new-order.mp3');
  fs.writeFileSync(outPathMp3, buffer);
  console.log('Successfully written', outPathMp3, buffer.length, 'bytes');
}

function addTone(samples, sampleRate, startTime, freq, duration, amplitude) {
  const startSample = Math.floor(startTime * sampleRate);
  const numSamples = Math.floor(duration * sampleRate);

  for (let i = 0; i < numSamples; i++) {
    const idx = startSample + i;
    if (idx >= samples.length) break;

    const t = i / sampleRate;
    // Attack: 15ms
    let env = 1.0;
    if (t < 0.015) {
      env = t / 0.015;
    } else {
      // Exponential decay
      env = Math.exp(-4.2 * (t - 0.015) / duration);
    }

    // Fundamental + Octave harmonic overtone
    const wave = Math.sin(2 * Math.PI * freq * t) * 0.75 + 
                 Math.sin(2 * Math.PI * (freq * 2) * t) * 0.25;

    samples[idx] += wave * amplitude * env;
  }
}

generateWav();
