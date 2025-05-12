import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://prompttune.banter.life'; // Replace with your actual production domain

  // Add static pages you want in the sitemap
  const staticPages = [
    '/', // Your main page (landing page / app entry)
    // Add other static public pages if you create them, e.g.:
    // '/about',
    // '/features',
    // '/blog',
  ];

  const sitemapEntries: MetadataRoute.Sitemap = staticPages.map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '/' ? 'weekly' : 'monthly', // Main page might update more
    priority: path === '/' ? 1 : 0.8,
  }));

  // If you have dynamic content like blog posts fetched from a CMS/DB,
  // you would fetch their paths here and add them to sitemapEntries.
  // For now, we only have static paths.

  return sitemapEntries;
} 