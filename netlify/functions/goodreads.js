const Parser = require('rss-parser');
const parser = new Parser();

exports.handler = async (event) => {
  // Replace with your actual Goodreads RSS URL
  const rssUrl = 'https://www.goodreads.com/review/list_rss/136088818?key=9aH9qTvMzuUaHGCcaSOArVe-PSwqRXzkAGeO49KYGWVIEJoq&shelf=read&per_page=100';
  
  try {
    const feed = await parser.parseURL(rssUrl);
    
    const books = feed.items.map(item => {
      // 1. Split out the "by Author" part if it exists
      let titleClean = item.title.split(' by ')[0].trim();
      
      // 2. NEW: Strip out any series info in parentheses (e.g., "(The Empyrean, #1)")
      titleClean = titleClean.replace(/\s*\(.*?\)\s*/g, '').trim();
      
      const authorClean = item.creator || item.title.split(' by ')[1]?.trim() || 'Unknown Author';
      
      return {
        title: titleClean,
        author: authorClean,
        readAt: new Date(item.pubDate).getTime() || Date.now(),
      };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ books }),
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};