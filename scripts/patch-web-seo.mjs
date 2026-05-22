import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const distDir = path.join(rootDir, 'dist');
const htmlPath = path.join(distDir, 'index.html');
const shareImageCandidates = [
  path.join(rootDir, 'assets', 'icon.png'),
  path.join(rootDir, 'assets', 'hermes-logo.png'),
];
const shareImageSrc = shareImageCandidates.find((file) => fs.existsSync(file));
const shareImageName = 'share-cover.png';
const shareImageDest = path.join(distDir, shareImageName);

if (!fs.existsSync(htmlPath)) {
  throw new Error(`Missing file: ${htmlPath}. Run expo export before patching SEO.`);
}

if (shareImageSrc) {
  fs.copyFileSync(shareImageSrc, shareImageDest);
}

const raw = fs.readFileSync(htmlPath, 'utf8');

const siteUrlFromEnv =
  process.env.SEO_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : '') ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '');
const siteUrl = siteUrlFromEnv.replace(/\/+$/, '');
const canonicalUrl = siteUrl ? `${siteUrl}/` : '/';
const ogImage = siteUrl ? `${siteUrl}/${shareImageName}` : `/${shareImageName}`;

const title = 'iHermes App - Hermes 手机版（iOS / Android）';
const description =
  'iHermes 是 Hermes 手机版客户端，支持 iOS、Android 与 Web App，多实例连接、会话对话、工具调用可视化。';
const keywords =
  'Hermes app,Hermes iOS,Hermes Android,Hermes 手机版,本地 Hermes,AI Agent App,多实例会话';

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'iHermes',
      url: canonicalUrl,
      description,
      keywords,
      inLanguage: 'zh-CN',
    },
    {
      '@type': 'SoftwareApplication',
      name: 'iHermes',
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Web, iOS, Android',
      description,
      keywords,
      url: canonicalUrl,
      image: ogImage,
      softwareVersion: 'v0.1',
      publisher: {
        '@type': 'Organization',
        name: 'iHermes',
      },
    },
    {
      '@type': 'Organization',
      name: 'iHermes',
      url: canonicalUrl,
      logo: ogImage,
      sameAs: ['https://xhslink.com/m/1pRHxd9V2xH'],
    },
  ],
};

const seoBlock = `
<title>${title}</title>
<meta name="description" content="${description}" />
<meta name="keywords" content="${keywords}" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<link rel="canonical" href="${canonicalUrl}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="iHermes" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${canonicalUrl}" />
<meta property="og:image" content="${ogImage}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="1200" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${ogImage}" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
`;

const withoutTitle = raw.replace(/<title>[\s\S]*?<\/title>/i, '');
const withSeo = withoutTitle.replace('</head>', `${seoBlock}\n</head>`);

fs.writeFileSync(htmlPath, withSeo, 'utf8');
console.log('Patched SEO tags in dist/index.html');
