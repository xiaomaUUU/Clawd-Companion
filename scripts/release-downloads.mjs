#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const owner = 'Doulor';
const repo = 'Clawd-Companion';
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/releases?per_page=100`;

const headers = {
  Accept: 'application/vnd.github+json',
  'User-Agent': `${repo}-release-downloads`,
};

if (process.env.GITHUB_TOKEN) {
  headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
}

async function fetchReleases() {
  try {
    const response = await fetch(apiUrl, { headers });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    const output = execFileSync('gh', ['api', `repos/${owner}/${repo}/releases`, '--paginate'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    return JSON.parse(output);
  }
}

const releases = await fetchReleases();
let totalAssetDownloads = 0;
let totalInstallerDownloads = 0;

console.log(`Release downloads for ${owner}/${repo}\n`);

for (const release of releases) {
  const assets = release.assets ?? [];
  const releaseAssetDownloads = assets.reduce((sum, asset) => sum + asset.download_count, 0);
  const releaseInstallerDownloads = assets
    .filter((asset) => asset.name.toLowerCase().endsWith('.exe'))
    .reduce((sum, asset) => sum + asset.download_count, 0);

  totalAssetDownloads += releaseAssetDownloads;
  totalInstallerDownloads += releaseInstallerDownloads;

  console.log(`${release.tag_name}: ${releaseInstallerDownloads} installer / ${releaseAssetDownloads} assets`);

  for (const asset of assets) {
    console.log(`  ${asset.name}: ${asset.download_count}`);
  }
}

console.log(`\nInstaller downloads: ${totalInstallerDownloads}`);
console.log(`Total asset downloads: ${totalAssetDownloads}`);
