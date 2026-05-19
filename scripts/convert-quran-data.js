#!/usr/bin/env node
/**
 * Convert mengkaji Quran CSV data into app-ready JSON for Hafaza PWA
 * Source: mengkaji/_quran/csv/quran.csv and fahras.csv
 */

const fs = require('fs');
const path = require('path');

// Paths
const QURAN_CSV = path.join(__dirname, '../../mengkaji/_quran/csv/quran.csv');
const FAHRAS_CSV = path.join(__dirname, '../../mengkaji/_quran/csv/fahras.csv');
const OUTPUT_DIR = path.join(__dirname, '../data');

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Parse fahras.csv -> surah index
// Format: order_of_revelation, surah_name, start_page, ayah_count, type
function parseFahras() {
  const content = fs.readFileSync(FAHRAS_CSV, 'utf8');
  const lines = content.trim().split('\n');
  const surahs = {};

  lines.forEach(line => {
    const parts = line.split(',');
    if (parts.length >= 5) {
      const revelationOrder = parseInt(parts[0]);
      const name = parts[1].trim();
      const startPage = parseInt(parts[2]);
      const ayahCount = parseInt(parts[3]);
      const type = parts[4].trim(); // مكيه or مدنيه

      // We'll index by surah number later after sorting
      surahs[revelationOrder] = { name, startPage, ayahCount, type };
    }
  });

  return surahs;
}

// Parse quran.csv -> structured ayahs
// Format: surah_num, ayah_num, arabic_diacritics, arabic_plain, hash, juz_fraction, page, page_arabic, line, surah_name_diacritics, surah_name_plain, ruku, sajda
function parseQuran() {
  const content = fs.readFileSync(QURAN_CSV, 'utf8');
  const lines = content.trim().split('\n');
  const surahs = {};

  lines.forEach(line => {
    // CSV with commas inside text - need careful parsing
    // The format uses commas as delimiter, Arabic text doesn't contain commas
    const parts = line.split(',');
    if (parts.length < 13) return;

    const surahNum = parseInt(parts[0]);
    const ayahNum = parseInt(parts[1]);
    const textDiacritics = parts[2];
    const textPlain = parts[3];
    const page = parseInt(parts[6]);
    const surahNameDiacritics = parts[9];
    const surahNamePlain = parts[10];
    const juz = Math.ceil(parseFloat(parts[5]) * 4); // Convert fraction to juz number

    // Skip surah title entries (ayah_num = 0 and text is surah name)
    if (ayahNum === 0 && textDiacritics === surahNameDiacritics) return;
    // Skip bismillah prefix entries (ayahNum = 0)
    if (ayahNum === 0) return;

    if (!surahs[surahNum]) {
      surahs[surahNum] = {
        number: surahNum,
        name: surahNameDiacritics,
        namePlain: surahNamePlain,
        ayahs: []
      };
    }

    surahs[surahNum].ayahs.push({
      number: ayahNum,
      text: textDiacritics,
      textPlain: textPlain,
      page: page
    });
  });

  return surahs;
}

// Build final data structure
function buildData() {
  const fahras = parseFahras();
  const quranData = parseQuran();

  // Build surah list (for index/navigation)
  const surahList = [];
  for (let i = 1; i <= 114; i++) {
    const surah = quranData[i];
    if (surah) {
      surahList.push({
        number: i,
        name: surah.name,
        namePlain: surah.namePlain,
        ayahCount: surah.ayahs.length
      });
    }
  }

  // Write surah index
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'surahs.json'),
    JSON.stringify(surahList, null, 0) // compact
  );
  console.log(`✓ surahs.json - ${surahList.length} surahs`);

  // Write individual surah files (for lazy loading)
  let totalAyahs = 0;
  for (let i = 1; i <= 114; i++) {
    const surah = quranData[i];
    if (surah) {
      const filename = `surah_${String(i).padStart(3, '0')}.json`;
      fs.writeFileSync(
        path.join(OUTPUT_DIR, filename),
        JSON.stringify(surah.ayahs, null, 0)
      );
      totalAyahs += surah.ayahs.length;
    }
  }
  console.log(`✓ Individual surah files (114 files, ${totalAyahs} total ayahs)`);

  // Write a single combined file too (for offline bundling, ~3MB)
  const allAyahs = {};
  for (let i = 1; i <= 114; i++) {
    if (quranData[i]) {
      allAyahs[i] = quranData[i].ayahs;
    }
  }
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'quran-full.json'),
    JSON.stringify(allAyahs, null, 0)
  );

  const fullSize = fs.statSync(path.join(OUTPUT_DIR, 'quran-full.json')).size;
  console.log(`✓ quran-full.json - ${(fullSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`\nDone! All data written to ${OUTPUT_DIR}`);
}

buildData();
