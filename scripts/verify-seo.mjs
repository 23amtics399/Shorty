async function verify() {
  const routes = [
    '/about',
    '/help',
    '/privacy',
    '/terms',
    '/report',
    '/features',
    '/pricing',
    '/developers',
    '/'
  ];

  console.log('=== VERIFYING ROUTE CANONICALS & OG TAGS ===');
  for (const r of routes) {
    const res = await fetch('https://shorty.sji.one' + r, { cache: 'no-store' });
    const html = await res.text();
    const can = (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i) || [])[0] || 'NONE';
    const title = (html.match(/<title>.*?<\/title>/i) || [])[0] || 'NONE';
    const ogUrl = (html.match(/<meta[^>]+property=["']og:url["'][^>]*>/i) || [])[0] || 'NONE';
    const ogTitle = (html.match(/<meta[^>]+property=["']og:title["'][^>]*>/i) || [])[0] || 'NONE';
    console.log(`\nRoute: ${r}`);
    console.log(`  Title:     ${title}`);
    console.log(`  Canonical: ${can}`);
    console.log(`  og:url:    ${ogUrl}`);
    console.log(`  og:title:  ${ogTitle}`);
  }

  console.log('\n=== VERIFYING 404 NOINDEX ===');
  const res404 = await fetch('https://shorty.sji.one/nonexistent-route-404-test', { cache: 'no-store' });
  const html404 = await res404.text();
  const robots404 = (html404.match(/<meta[^>]+name=["']robots["'][^>]*>/i) || [])[0] || 'NONE';
  console.log('404 HTTP Status:', res404.status);
  console.log('404 robots tag: ', robots404);

  console.log('\n=== VERIFYING SITEMAP.XML ===');
  const resSitemap = await fetch('https://shorty.sji.one/sitemap.xml', { cache: 'no-store' });
  const sitemapText = await resSitemap.text();
  console.log('Sitemap HTTP Status:', resSitemap.status);
  console.log(sitemapText);

  console.log('\n=== VERIFYING FOOTER SJI NETWORK LINKS ===');
  const resHome = await fetch('https://shorty.sji.one/', { cache: 'no-store' });
  const homeHtml = await resHome.text();
  const hasSjiOne = homeHtml.includes('https://sji.one');
  const hasPrebase = homeHtml.includes('https://prebase.sji.one');
  const hasTempbox = homeHtml.includes('https://tempbox.sji.one');
  const hasTools = homeHtml.includes('https://tools.sji.one');
  const hasTime = homeHtml.includes('https://time.sji.one');
  const hasCalc = homeHtml.includes('https://calc.sji.one');
  const hasScratchpad = homeHtml.includes('https://scratchpad.sji.one');
  console.log('Footer contains sji.one:         ', hasSjiOne);
  console.log('Footer contains prebase.sji.one: ', hasPrebase);
  console.log('Footer contains tempbox.sji.one: ', hasTempbox);
  console.log('Footer contains tools.sji.one:   ', hasTools);
  console.log('Footer contains time.sji.one:    ', hasTime);
  console.log('Footer contains calc.sji.one:    ', hasCalc);
  console.log('Footer contains scratchpad.sji.one:', hasScratchpad);
}

verify();
